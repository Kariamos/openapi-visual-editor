import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { yamlOverwrite } from 'yaml-diff-patch';
import { parseOpenApi } from '../utils/yamlParser';
import { extractBlock } from './helpers/yamlDiff';

const COMPLEX = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'complex-api.yaml'),
  'utf8'
);

/**
 * Applies a single surface-level edit to the complex fixture and asserts that a
 * specific passthrough block is byte-identical before and after. Each test
 * chooses a different edit point to stress a different passthrough.
 */
function editAndCompareBlock(mutate: (doc: ReturnType<typeof parseOpenApi>) => void, blockHeader: string) {
  const doc = parseOpenApi(COMPLEX);
  mutate(doc);
  const out = yamlOverwrite(COMPLEX, doc as Record<string, unknown>);
  const before = extractBlock(COMPLEX, blockHeader);
  const after = extractBlock(out, blockHeader);
  expect(after).toBe(before);
  return out;
}

describe('Data-loss prevention under local edits', () => {
  it('root x-* survives edit of info.version', () => {
    const doc = parseOpenApi(COMPLEX);
    doc.info.version = '9.9.9';
    const out = yamlOverwrite(COMPLEX, doc as Record<string, unknown>);
    expect(out).toContain('x-api-id: sample-marketplace');
    expect(out).toContain('x-audience: external-public');
  });

  it('components.parameters survives edit of a path', () => {
    const out = editAndCompareBlock((doc) => {
      doc.paths!['/users']!.get!.summary = 'List users (edited)';
    }, '  parameters:');
    expect(out).toContain('PageParam:');
    expect(out).toContain('PageSizeParam:');
    expect(out).toContain('UserIdPath:');
  });

  it('components.responses survives edit of operation.summary', () => {
    const out = editAndCompareBlock((doc) => {
      doc.paths!['/users']!.post!.summary = 'Create user (edited)';
    }, '  responses:');
    expect(out).toContain('BadRequest:');
    expect(out).toContain('Unauthorized:');
    expect(out).toContain('NotFound:');
  });

  it('components.headers survives edit elsewhere', () => {
    const out = editAndCompareBlock((doc) => {
      doc.info.title = 'Edited title';
    }, '  headers:');
    expect(out).toContain('TotalCount:');
  });

  it('components.securitySchemes including all OAuth2 flows survives', () => {
    const out = editAndCompareBlock((doc) => {
      doc.info.title = 'Security edit';
    }, '  securitySchemes:');
    expect(out).toContain('bearerAuth:');
    expect(out).toContain('apiKeyAuth:');
    expect(out).toContain('oauth2:');
    expect(out).toContain('authorizationCode:');
    expect(out).toContain('authorizationUrl: https://auth.example.com/authorize');
    expect(out).toContain('tokenUrl: https://auth.example.com/token');
  });

  it('global security survives edit in info', () => {
    const doc = parseOpenApi(COMPLEX);
    doc.info.version = '3.0.0';
    const out = yamlOverwrite(COMPLEX, doc as Record<string, unknown>);
    // Global security appears above paths: in the fixture.
    expect(out).toMatch(/^security:\n {2}- bearerAuth: \[\]/m);
  });

  it('servers (top-level) with variables survives edit', () => {
    const out = editAndCompareBlock((doc) => {
      doc.info.version = '3.1.0';
    }, 'servers:');
    expect(out).toContain('https://{env}.api.example.com/{basePath}');
    expect(out).toContain('variables:');
    expect(out).toContain('env:');
    expect(out).toContain('basePath:');
  });

  it('tags (top-level) with externalDocs survives edit', () => {
    const out = editAndCompareBlock((doc) => {
      doc.info.version = '3.2.0';
    }, 'tags:');
    expect(out).toContain('externalDocs:');
    expect(out).toContain('https://example.com/docs/users');
  });

  it('parameter with style/explode/enum array survives a distant edit', () => {
    const doc = parseOpenApi(COMPLEX);
    doc.info.version = '3.3.0';
    const out = yamlOverwrite(COMPLEX, doc as Record<string, unknown>);
    expect(out).toContain('style: form');
    expect(out).toContain('explode: true');
  });

  it('operation-level x-* survives edit of its summary', () => {
    const doc = parseOpenApi(COMPLEX);
    doc.paths!['/users']!.get!.summary = 'List users (edited again)';
    const out = yamlOverwrite(COMPLEX, doc as Record<string, unknown>);
    expect(out).toContain('x-rate-limit: 120');
  });

  it('requestBody with multipart/form-data and encoding survives edit', () => {
    const out = editAndCompareBlock((doc) => {
      doc.info.version = '3.4.0';
    }, '  /uploads:');
    expect(out).toContain('multipart/form-data:');
    expect(out).toContain('encoding:');
    expect(out).toContain('contentType: application/octet-stream');
  });

  it('callbacks on an operation survive distant edit', () => {
    const out = editAndCompareBlock((doc) => {
      doc.info.version = '3.5.0';
    }, '  /orders:');
    expect(out).toContain('callbacks:');
    expect(out).toContain('orderStatus:');
    expect(out).toContain('{$request.body#/callbackUrl}');
  });

  it('discriminator mapping on oneOf survives a distant edit', () => {
    const out = editAndCompareBlock((doc) => {
      doc.info.version = '3.6.0';
    }, '    PaymentInstruction:');
    expect(out).toContain('discriminator:');
    expect(out).toContain('propertyName: method');
    expect(out).toContain("card: '#/components/schemas/CardPayment'");
  });

  it('contact and license under info are preserved across edits of other info fields', () => {
    const doc = parseOpenApi(COMPLEX);
    doc.info.version = '4.0.0';
    const out = yamlOverwrite(COMPLEX, doc as Record<string, unknown>);
    expect(out).toContain('contact:');
    expect(out).toContain('name: API Support');
    expect(out).toContain('license:');
    expect(out).toContain('name: Apache-2.0');
    expect(out).toContain('x-logo:');
  });

  it('info.description block scalar is preserved when editing version', () => {
    const doc = parseOpenApi(COMPLEX);
    doc.info.version = '5.0.0';
    const out = yamlOverwrite(COMPLEX, doc as Record<string, unknown>);
    expect(out).toMatch(/description: \|/);
    expect(out).toContain('A generic, multi-domain API used as a fixture for round-trip tests.');
  });
});
