import { describe, it, expect } from 'vitest';
import { parseOpenApi, serializeOpenApi, looksLikeOpenApi } from '../utils/yamlParser';

const MINIMAL_OPENAPI = `
openapi: '3.0.1'
info:
  title: 'Test API'
  version: '1.0.0'
paths: {}
`.trim();

describe('parseOpenApi', () => {
  it('parses valid OpenAPI YAML', () => {
    const doc = parseOpenApi(MINIMAL_OPENAPI);
    expect(doc.openapi).toBe('3.0.1');
    expect(doc.info.title).toBe('Test API');
    expect(doc.info.version).toBe('1.0.0');
  });

  it('throws with line info on invalid YAML', () => {
    expect(() => parseOpenApi('key: [unclosed')).toThrowError(/YAML parse error.*line/i);
  });

  it('throws when YAML root is not an object', () => {
    expect(() => parseOpenApi('- item1\n- item2')).toThrowError(/not an object/i);
  });

  it('throws when YAML is a plain string', () => {
    expect(() => parseOpenApi('"just a string"')).toThrowError(/not an object/i);
  });

  it('handles double-quoted YAML', () => {
    const doc = parseOpenApi(`
openapi: "3.0.1"
info:
  title: "My API"
  version: "2.0.0"
paths: {}
`.trim());
    expect(doc.openapi).toBe('3.0.1');
    expect(doc.info.title).toBe('My API');
  });

  it('reports line/column info for illegal tab indentation', () => {
    // Tab as indentation is invalid YAML — js-yaml emits a YAMLException with mark.
    const bad = 'openapi: 3.0.3\ninfo:\n\ttitle: Bad\n';
    expect(() => parseOpenApi(bad)).toThrowError(/line \d+/i);
  });

  it('accepts UTF-8 BOM at the start of the file', () => {
    const doc = parseOpenApi('\uFEFFopenapi: 3.0.3\ninfo:\n  title: BOM\n  version: 1.0.0\npaths: {}\n');
    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.title).toBe('BOM');
  });

  it('accepts CRLF line endings', () => {
    const doc = parseOpenApi('openapi: 3.0.3\r\ninfo:\r\n  title: CRLF\r\n  version: 1.0.0\r\npaths: {}\r\n');
    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.title).toBe('CRLF');
  });

  it.todo('preserves YAML comments across parse+serialize (js-yaml limitation)');
});

describe('serializeOpenApi', () => {
  it('produces valid YAML that round-trips back to the same structure', () => {
    const doc = parseOpenApi(MINIMAL_OPENAPI);
    const serialized = serializeOpenApi(doc);
    const reparsed = parseOpenApi(serialized);
    expect(reparsed.openapi).toBe(doc.openapi);
    expect(reparsed.info.title).toBe(doc.info.title);
    expect(reparsed.info.version).toBe(doc.info.version);
  });

  it('preserves paths and components on round-trip', () => {
    const yaml = `
openapi: '3.0.1'
info:
  title: 'API'
  version: '1.0.0'
paths:
  /users:
    get:
      summary: 'List users'
      responses:
        '200':
          description: 'OK'
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
`.trim();
    const doc = parseOpenApi(yaml);
    const serialized = serializeOpenApi(doc);
    const reparsed = parseOpenApi(serialized);
    expect(reparsed.paths!['/users']!.get!.summary).toBe('List users');
    expect(reparsed.components!.schemas!['User'].type).toBe('object');
  });

  it('outputs string with 2-space indentation', () => {
    const doc = parseOpenApi(MINIMAL_OPENAPI);
    const serialized = serializeOpenApi(doc);
    expect(serialized).toMatch(/^  /m);
  });

  it('does not wrap long URL-like strings across lines', () => {
    const longUrl = 'https://example.com/' + 'x'.repeat(200);
    const doc = parseOpenApi(MINIMAL_OPENAPI);
    (doc.info as Record<string, unknown>).termsOfService = longUrl;
    const serialized = serializeOpenApi(doc);
    expect(serialized).toContain(longUrl);
  });

  it('keeps numeric response codes as string keys (quoted, regardless of quote style)', () => {
    const yaml = `
openapi: '3.0.1'
info:
  title: 'API'
  version: '1.0.0'
paths:
  /ping:
    get:
      responses:
        '200':
          description: 'OK'
        '404':
          description: 'Not found'
`.trim();
    const doc = parseOpenApi(yaml);
    const serialized = serializeOpenApi(doc);
    // Single or double quotes are both acceptable — what matters is that
    // status codes remain string keys, not integers.
    expect(serialized).toMatch(/['"]200['"]:/);
    expect(serialized).toMatch(/['"]404['"]:/);
  });

  it('serializer is idempotent (serialize(parse(serialize(x))) === serialize(x))', () => {
    const doc = parseOpenApi(MINIMAL_OPENAPI);
    const s1 = serializeOpenApi(doc);
    const s2 = serializeOpenApi(parseOpenApi(s1));
    expect(s2).toBe(s1);
  });

  it('does not emit boolean yes/no for true/false (noCompatMode)', () => {
    // Under YAML 1.1 compat mode, js-yaml could emit boolean as yes/no. We set
    // noCompatMode to ensure it emits true/false.
    const doc = parseOpenApi(MINIMAL_OPENAPI);
    (doc as Record<string, unknown>)['x-enabled'] = true;
    (doc as Record<string, unknown>)['x-disabled'] = false;
    const serialized = serializeOpenApi(doc);
    expect(serialized).toMatch(/x-enabled: true/);
    expect(serialized).toMatch(/x-disabled: false/);
    expect(serialized).not.toMatch(/x-enabled: yes/);
    expect(serialized).not.toMatch(/x-disabled: no/);
  });
});

describe('looksLikeOpenApi', () => {
  it('returns true for object with openapi field', () => {
    expect(looksLikeOpenApi({ openapi: '3.0.1', info: {}, paths: {} })).toBe(true);
  });

  it('returns true for object with swagger field', () => {
    expect(looksLikeOpenApi({ swagger: '2.0', info: {}, paths: {} })).toBe(true);
  });

  it('returns true for object with both paths and info', () => {
    expect(looksLikeOpenApi({ paths: {}, info: {} })).toBe(true);
  });

  it('returns false for null', () => {
    expect(looksLikeOpenApi(null)).toBe(false);
  });

  it('returns false for array', () => {
    expect(looksLikeOpenApi([])).toBe(false);
  });

  it('returns false for plain object without recognizable fields', () => {
    expect(looksLikeOpenApi({ foo: 'bar' })).toBe(false);
  });

  it('returns false for string', () => {
    expect(looksLikeOpenApi('openapi: 3.0.1')).toBe(false);
  });

  it('detects OpenAPI 3.1 documents with jsonSchemaDialect and webhooks', () => {
    expect(looksLikeOpenApi({
      openapi: '3.1.0',
      info: { title: 'x', version: '1' },
      jsonSchemaDialect: 'https://spec.openapis.org/oas/3.1/dialect/base',
      webhooks: {},
    })).toBe(true);
  });

  it('detects Swagger 2.0 documents with basePath and schemes', () => {
    expect(looksLikeOpenApi({
      swagger: '2.0',
      info: { title: 'x', version: '1' },
      basePath: '/v2',
      schemes: ['https'],
      paths: {},
    })).toBe(true);
  });

  it('accepts object with paths+info even when openapi field is missing or non-string', () => {
    // Fallback heuristic: if both paths and info are present, treat as an
    // OpenAPI document. A numeric openapi is unusual but should not be
    // rejected — the real schema check belongs to Spectral.
    expect(looksLikeOpenApi({ openapi: 3, info: {}, paths: {} })).toBe(true);
    expect(looksLikeOpenApi({ info: {}, paths: {} })).toBe(true);
  });
});
