import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { yamlOverwrite } from 'yaml-diff-patch';
import { parseOpenApi } from '../utils/yamlParser';
import { diffLines, countBlankRuns, extractBlock } from './helpers/yamlDiff';

const readFixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

// Simulates a file created by Stoplight: single-quoted strings, specific style
const STOPLIGHT_YAML = `\
openapi: '3.0.1'
info:
  title: 'My API'
  version: '1.0.0'
  description: 'A sample API created with Stoplight'
paths:
  '/users':
    get:
      summary: 'Get users'
      operationId: 'getUsers'
      responses:
        '200':
          description: 'A list of users'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: 'object'
      properties:
        id:
          type: 'integer'
        name:
          type: 'string'
`;

describe('YAML round-trip with yamlOverwrite', () => {
  it('adding a schema preserves single quotes in unchanged sections', () => {
    const doc = parseOpenApi(STOPLIGHT_YAML);
    doc.components!.schemas!['NewSchema'] = { type: 'object', properties: { code: { type: 'string' } } };

    const result = yamlOverwrite(STOPLIGHT_YAML, doc as Record<string, unknown>);

    expect(result).toContain("title: 'My API'");
    expect(result).toContain("version: '1.0.0'");
    expect(result).toContain("description: 'A sample API created with Stoplight'");
    expect(result).toContain("summary: 'Get users'");
    expect(result).toContain('NewSchema');
    expect(result).toContain('User:');
  });

  it('removing a schema does not touch unrelated content', () => {
    const doc = parseOpenApi(STOPLIGHT_YAML);
    delete doc.components!.schemas!['User'];

    const result = yamlOverwrite(STOPLIGHT_YAML, doc as Record<string, unknown>);

    expect(result).toContain("title: 'My API'");
    expect(result).toContain("'/users':");
    expect(result).not.toContain('User:');
  });

  it('no-op edit produces identical YAML', () => {
    const doc = parseOpenApi(STOPLIGHT_YAML);
    const result = yamlOverwrite(STOPLIGHT_YAML, doc as Record<string, unknown>);
    expect(result).toBe(STOPLIGHT_YAML);
  });

  it('updating a scalar value preserves surrounding formatting', () => {
    const doc = parseOpenApi(STOPLIGHT_YAML);
    doc.info.version = '2.0.0';

    const result = yamlOverwrite(STOPLIGHT_YAML, doc as Record<string, unknown>);

    expect(result).toContain("title: 'My API'");
    expect(result).toContain('2.0.0');
    expect(result).not.toContain("version: '1.0.0'");
  });

  it('adding a path does not change existing paths formatting', () => {
    const doc = parseOpenApi(STOPLIGHT_YAML);
    doc.paths!['/health'] = {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'OK' } },
      },
    };

    const result = yamlOverwrite(STOPLIGHT_YAML, doc as Record<string, unknown>);

    expect(result).toContain("'/users':");
    expect(result).toContain("summary: 'Get users'");
    expect(result).toContain('/health');
  });

  // Regression for bug: yaml-diff-patch v2.0.0 failed to unescape intermediate
  // JSON Pointer segments, so path keys containing "/" (every OpenAPI path)
  // produced "Can't add node at path ... /paths is undefined". Patched via
  // patches/yaml-diff-patch+2.0.0.patch.
  it('adding response to path with slashes and {params} works', () => {
    const yaml = `\
openapi: '3.0.1'
info:
  title: 'API'
  version: '1.0.0'
paths:
  '/campaigns/{campaign}/bugs/{bugId}/tags':
    get:
      summary: 'Get tags'
      responses:
        '200':
          description: 'OK'
`;
    const doc = parseOpenApi(yaml);
    const op = doc.paths!['/campaigns/{campaign}/bugs/{bugId}/tags']!.get!;
    op.responses!['500'] = { description: 'Server Error' };

    const result = yamlOverwrite(yaml, doc as Record<string, unknown>);

    // New keys may be quoted with either style; key presence + surrounding
    // preservation is what matters.
    expect(result).toMatch(/['"]500['"]:/);
    expect(result).toContain('Server Error');
    expect(result).toContain("'200':");
    expect(result).toContain("summary: 'Get tags'");
  });

  it('modifying deeply nested field under parametrized path', () => {
    const yaml = `\
openapi: '3.0.1'
info:
  title: 'API'
  version: '1.0.0'
paths:
  '/users/{id}/posts/{postId}':
    get:
      responses:
        '200':
          description: 'OK'
`;
    const doc = parseOpenApi(yaml);
    doc.paths!['/users/{id}/posts/{postId}']!.get!.responses!['200'].description = 'Found';

    const result = yamlOverwrite(yaml, doc as Record<string, unknown>);

    expect(result).toContain('Found');
    expect(result).not.toContain("description: 'OK'");
  });
});

// ── Advanced preservation cases ────────────────────────────────────────────

describe('YAML round-trip — advanced preservation', () => {
  describe('quote preservation', () => {
    it('preserves single-quoted strings in unchanged sections', () => {
      const yaml = readFixture('quoted-single.yaml');
      const doc = parseOpenApi(yaml);
      doc.info.version = '9.9.9';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain("title: 'Quoted API'");
      expect(result).toContain("description: 'All strings use single quotes'");
      expect(result).toContain("summary: 'List items'");
      expect(result).toContain("$ref: '#/components/schemas/Item'");
    });

    it('preserves double-quoted strings in unchanged sections', () => {
      const yaml = `\
openapi: "3.0.3"
info:
  title: "Double API"
  version: "1.0.0"
paths:
  "/ping":
    get:
      summary: "Ping"
      responses:
        "200":
          description: "OK"
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('title: "Double API"');
      expect(result).toContain('summary: "Ping"');
      expect(result).toContain('description: "OK"');
    });

    it('preserves unquoted scalars', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: Plain API
  version: 1.0.0
paths:
  /ping:
    get:
      summary: Ping
      responses:
        '200':
          description: OK
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('title: Plain API');
      expect(result).toContain('summary: Ping');
    });

    it('preserves block folded scalars (>)', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: Folded API
  version: 1.0.0
  description: >
    Multi line description
    folded onto one logical line
paths: {}
`;
      const doc = parseOpenApi(yaml);
      doc.info.title = 'Folded API (edited)';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toMatch(/description: >\n/);
      expect(result).toContain('Multi line description');
    });

    it('preserves block literal scalars (|)', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: Literal API
  version: 1.0.0
  description: |
    Line 1
    Line 2
paths: {}
`;
      const doc = parseOpenApi(yaml);
      doc.info.title = 'Literal API (edited)';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toMatch(/description: \|\n/);
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });
  });

  describe('indentation preservation', () => {
    // yaml-diff-patch normalizes to js-yaml's default 2-space indent whenever
    // it has to re-serialize a section. Preserving non-standard (4-space)
    // indentation would require forking the library — documented limitation.
    it.skip('preserves 4-space indentation across edits (yaml-diff-patch normalizes to 2-space)', () => {
      const yaml = readFixture('indent-4.yaml');
      const doc = parseOpenApi(yaml);
      doc.info.version = '1.1.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const pathsBefore = extractBlock(yaml, 'paths:');
      const pathsAfter = extractBlock(result, 'paths:');
      expect(pathsAfter).toBe(pathsBefore);
    });

    it('4-space fixture parses and produces valid YAML on round-trip', () => {
      const yaml = readFixture('indent-4.yaml');
      const doc = parseOpenApi(yaml);
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      // Result is syntactically valid YAML and preserves data, even if indent
      // has been normalized to 2 spaces by yaml-diff-patch.
      expect(() => parseOpenApi(result)).not.toThrow();
      const reparsed = parseOpenApi(result);
      expect(reparsed.info.title).toBe(doc.info.title);
      expect(reparsed.paths).toEqual(doc.paths);
    });

    it('preserves 2-space indentation on unchanged sections', () => {
      const yaml = readFixture('quoted-single.yaml');
      const doc = parseOpenApi(yaml);
      doc.info.version = '9.9.9';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      // Each nested level uses exactly 2 spaces of additional indent.
      expect(result).toMatch(/^ {8}id:/m);
      expect(result).toMatch(/^ {10}type: 'string'/m);
    });
  });

  describe('key order preservation', () => {
    it('editing info.description does not reorder title/version/description', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: Order API
  version: 1.0.0
  description: Original description
paths: {}
`;
      const doc = parseOpenApi(yaml);
      doc.info.description = 'Updated description';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const titleIdx = result.indexOf('title:');
      const versionIdx = result.indexOf('version:');
      const descIdx = result.indexOf('description:');
      expect(titleIdx).toBeLessThan(versionIdx);
      expect(versionIdx).toBeLessThan(descIdx);
      expect(result).toContain('Updated description');
    });

    it('preserves property order inside components.schemas.*.properties', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    User:
      type: object
      properties:
        zz:
          type: string
        aa:
          type: integer
        mm:
          type: boolean
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const zz = result.indexOf('zz:');
      const aa = result.indexOf('aa:');
      const mm = result.indexOf('mm:');
      expect(zz).toBeLessThan(aa);
      expect(aa).toBeLessThan(mm);
    });
  });

  describe('vendor extension (x-*) preservation', () => {
    it('root-level x-* survives edit of info.version', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
x-internal-id: ABC-123
x-audience: public
paths: {}
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('x-internal-id: ABC-123');
      expect(result).toContain('x-audience: public');
    });

    it('operation-level x-* survives edit of another field', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths:
  /ping:
    get:
      summary: Ping
      x-rate-limit: 60
      x-team: platform
      responses:
        '200':
          description: OK
`;
      const doc = parseOpenApi(yaml);
      doc.paths!['/ping']!.get!.summary = 'Pong';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('x-rate-limit: 60');
      expect(result).toContain('x-team: platform');
      expect(result).toContain('summary: Pong');
    });

    it('schema-level x-* survives edit of another schema property', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    User:
      type: object
      x-persistence: primary-db
      x-indexed: true
      properties:
        id:
          type: string
`;
      const doc = parseOpenApi(yaml);
      (doc.components!.schemas!['User'] as Record<string, unknown>).description = 'A user';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('x-persistence: primary-db');
      expect(result).toContain('x-indexed: true');
    });
  });

  describe('composition preservation', () => {
    it('allOf/oneOf/anyOf with $ref remain byte-identical after distant edit', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Base:
      type: object
      properties:
        id:
          type: string
    Composed:
      allOf:
        - $ref: '#/components/schemas/Base'
        - oneOf:
            - $ref: '#/components/schemas/VariantA'
            - $ref: '#/components/schemas/VariantB'
        - anyOf:
            - type: object
              properties:
                extra:
                  type: string
    VariantA:
      type: object
      properties:
        a:
          type: string
    VariantB:
      type: object
      properties:
        b:
          type: integer
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const beforeBlock = extractBlock(yaml, '    Composed:');
      const afterBlock = extractBlock(result, '    Composed:');
      expect(afterBlock).toBe(beforeBlock);
    });
  });

  describe('special values', () => {
    it('distinguishes security: [] (empty array) from missing security', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
security: []
paths:
  /open:
    get:
      summary: Public
      security: []
      responses:
        '200':
          description: OK
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toMatch(/^security: \[\]/m);
      expect(result).toMatch(/security: \[\]/);
    });

    it('preserves scientific notation numbers (up to js-yaml canonicalization)', () => {
      // js-yaml canonicalizes scientific notation: 1e3 → 1e+3. Acceptable as
      // long as the value is still a valid scientific-notation number.
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    S:
      type: number
      minimum: 1e3
      maximum: 1.5e6
`;
      const doc = parseOpenApi(yaml);
      doc.info.description = 'Added';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toMatch(/minimum: 1e\+?3/);
      expect(result).toMatch(/maximum: 1\.5e\+?6/);
    });

    it.skip('preserves float trailing zero (3.10) — js-yaml parses as 3.1', () => {
      // js-yaml parses "3.10" as number 3.1 and loses trailing zero at serialize.
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    S:
      type: number
      default: 3.10
`;
      const doc = parseOpenApi(yaml);
      doc.info.description = 'Added';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('default: 3.10');
    });

    it('preserves YAML 1.1 boolean literals (yes/no) in unchanged sections', () => {
      // js-yaml loads "yes"/"no" as boolean under the default (v1.1) schema.
      // Round-trip re-serializes as true/false, but yaml-diff-patch touches only
      // changed nodes, so unchanged yes/no lines should stay verbatim.
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    S:
      type: object
      x-flag: yes
      x-other: no
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('x-flag: yes');
      expect(result).toContain('x-other: no');
    });

    it('distinguishes explicit null (~) from missing key in unchanged sections', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
x-maybe: ~
x-also: null
paths: {}
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toMatch(/x-maybe: ~/);
      expect(result).toMatch(/x-also: null/);
    });
  });

  describe('YAML anchors and aliases', () => {
    it.skip('preserves anchor/alias (&name / *name) through round-trip — limitation', () => {
      // js-yaml dump uses noRefs: true (see yamlParser.ts) so anchors are not
      // emitted on serialization. yaml-diff-patch preserves the original source
      // for untouched nodes, but a re-serialized branch loses the alias.
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Common: &common
      type: string
      maxLength: 100
    Reused:
      <<: *common
      description: Reuses Common
`;
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.0.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('&common');
      expect(result).toContain('*common');
    });
  });

  describe('deep-depth edits', () => {
    it('modifying a deeply nested field only changes that line', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths:
  /x:
    get:
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        nested:
                          type: object
                          properties:
                            deep:
                              type: string
                              description: original
`;
      const doc = parseOpenApi(yaml);
      const schema = doc.paths!['/x']!.get!.responses!['200'].content!['application/json'].schema!;
      (schema.properties!['data'].items!.properties!['nested'].properties!['deep'] as Record<string, unknown>)
        .description = 'updated';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const diffs = diffLines(yaml, result);
      expect(diffs.length).toBe(1);
      expect(diffs[0].kind).toBe('changed');
      expect(diffs[0].after).toContain('updated');
    });
  });

  describe('path-level edits', () => {
    it('deleting a path does not modify other paths', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths:
  /a:
    get:
      summary: A
      responses:
        '200':
          description: OK
  /b:
    get:
      summary: B
      responses:
        '200':
          description: OK
  /c:
    get:
      summary: C
      responses:
        '200':
          description: OK
`;
      const doc = parseOpenApi(yaml);
      delete doc.paths!['/b'];
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const blockABefore = extractBlock(yaml, '  /a:');
      const blockCBefore = extractBlock(yaml, '  /c:');
      const blockAAfter = extractBlock(result, '  /a:');
      const blockCAfter = extractBlock(result, '  /c:');
      expect(blockAAfter).toBe(blockABefore);
      expect(blockCAfter).toBe(blockCBefore);
      expect(result).not.toContain('/b:');
      expect(result).not.toContain('summary: B');
    });

    it('adding a path does not reformat existing paths', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths:
  /a:
    get:
      summary: A
      responses:
        '200':
          description: OK
`;
      const doc = parseOpenApi(yaml);
      doc.paths!['/b'] = {
        get: { summary: 'B', responses: { '200': { description: 'OK' } } },
      };
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const blockABefore = extractBlock(yaml, '  /a:');
      const blockAAfter = extractBlock(result, '  /a:');
      expect(blockAAfter).toBe(blockABefore);
      expect(result).toContain('/b:');
    });

    it('handles path keys with JSON-pointer-escape characters (/{id}/sub~1path)', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths:
  '/items/{id}/sub~1path':
    get:
      summary: Sub
      responses:
        '200':
          description: OK
`;
      const doc = parseOpenApi(yaml);
      doc.paths!['/items/{id}/sub~1path']!.get!.summary = 'Sub (edited)';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain("'/items/{id}/sub~1path':");
      expect(result).toContain('Sub (edited)');
    });

    it('handles unicode path keys (/café)', () => {
      const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths:
  /café:
    get:
      summary: Cafe
      responses:
        '200':
          description: OK
`;
      const doc = parseOpenApi(yaml);
      doc.paths!['/café']!.get!.summary = 'Café';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toContain('/café:');
      expect(result).toContain('Café');
    });
  });

  describe('determinism and stability', () => {
    it('yamlOverwrite is deterministic across repeated invocations', () => {
      const yaml = readFixture('quoted-single.yaml');
      const doc = parseOpenApi(yaml);
      doc.info.version = '9.0.0';
      const r1 = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const r2 = yamlOverwrite(yaml, doc as Record<string, unknown>);
      const r3 = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
    });

    it('no-op round-trip on the complex fixture is byte-identical', () => {
      const yaml = readFixture('complex-api.yaml');
      const doc = parseOpenApi(yaml);
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(result).toBe(yaml);
    });

    it('does not introduce 3+ consecutive blank lines after an edit', () => {
      const yaml = readFixture('complex-api.yaml');
      const doc = parseOpenApi(yaml);
      doc.info.version = '2.5.0';
      const result = yamlOverwrite(yaml, doc as Record<string, unknown>);
      expect(countBlankRuns(result, 3)).toBe(0);
    });
  });
});
