import { describe, it, expect } from 'vitest';
import { yamlOverwrite } from 'yaml-diff-patch';
import { parseOpenApi } from '../utils/yamlParser';

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
