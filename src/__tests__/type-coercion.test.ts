import { describe, it, expect } from 'vitest';
import { parseOpenApi } from '../utils/yamlParser';
import { stringifyOpenApiPreservingSource } from '../utils/stringifyOpenApi';

/**
 * Regression tests for silent type-coercion of implicit YAML scalars.
 *
 * The extension host parses the file, ships the object to the webview via
 * postMessage (which serializes through JSON), receives an edited object back,
 * and writes it out. Any value that js-yaml's YAML 1.1 DEFAULT_SCHEMA would
 * coerce into a non-JSON JS type (Date, sexagesimal number, ...) is silently
 * rewritten when it crosses the JSON boundary — e.g. `2021-01-01` would become
 * `2021-01-01T00:00:00.000Z`.
 *
 * These are the exact kind of "unexpected mutation on complex YAML" that
 * Stoplight-authored specs (heavy on date/date-time examples) trigger. The fix
 * is that `parseOpenApi` uses JSON_SCHEMA, keeping such values as plain strings.
 */

/** Reproduces the real extension→webview→extension pipeline. */
function pipeline(source: string, edit: (doc: Record<string, unknown>) => void): string {
  const doc = parseOpenApi(source);
  // postMessage to the webview serializes through JSON (Date → ISO string, etc.)
  const inWebview = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  edit(inWebview);
  return stringifyOpenApiPreservingSource(source, inWebview as never);
}

const bump = (doc: Record<string, unknown>) => {
  (doc.info as Record<string, unknown>).version = '9.9.9';
};

describe('Implicit scalar type coercion is not applied', () => {
  it('a date-only example stays a plain date string', () => {
    const doc = parseOpenApi(`openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Event:
      properties:
        day:
          type: string
          format: date
          example: 2021-01-01
`);
    // The value must be a string, not a Date object.
    const example = (doc as never as {
      components: { schemas: { Event: { properties: { day: { example: unknown } } } } };
    }).components.schemas.Event.properties.day.example;
    expect(typeof example).toBe('string');
    expect(example).toBe('2021-01-01');
  });

  it('a date-only example survives the postMessage JSON boundary + edit', () => {
    const out = pipeline(`openapi: 3.0.3
info:
  title: old
  version: 1.0.0
paths: {}
components:
  schemas:
    Event:
      properties:
        day:
          type: string
          format: date
          example: 2021-01-01
`, (d) => { (d.info as Record<string, unknown>).title = 'new'; });
    expect(out).toContain('example: 2021-01-01');
    expect(out).not.toContain('T00:00:00');
    expect(out).not.toContain('.000Z');
  });

  it('a full date-time example is not reformatted with milliseconds', () => {
    const out = pipeline(`openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Event:
      properties:
        at:
          type: string
          format: date-time
          example: 2021-01-01T10:30:00Z
`, bump);
    expect(out).toContain('2021-01-01T10:30:00Z');
    expect(out).not.toContain('.000Z');
  });

  it('a time-like value (HH:MM) is not read as a sexagesimal number', () => {
    const doc = parseOpenApi(`openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Slot:
      properties:
        start:
          type: string
          example: 22:22
`);
    const example = (doc as never as {
      components: { schemas: { Slot: { properties: { start: { example: unknown } } } } };
    }).components.schemas.Slot.properties.start.example;
    // Under YAML 1.1, 22:22 would resolve to the integer 1342 (base-60).
    expect(example).toBe('22:22');
  });

  it('YAML 1.1 boolean words used as string enum values stay strings', () => {
    const doc = parseOpenApi(`openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Toggle:
      type: string
      enum:
        - 'on'
        - 'off'
        - 'yes'
        - 'no'
`);
    const en = (doc as never as {
      components: { schemas: { Toggle: { enum: unknown[] } } };
    }).components.schemas.Toggle.enum;
    expect(en).toEqual(['on', 'off', 'yes', 'no']);
  });

  it('a leading-zero string example is preserved verbatim', () => {
    const out = pipeline(`openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Address:
      properties:
        zip:
          type: string
          example: "01234"
`, bump);
    expect(out).toContain('"01234"');
  });
});
