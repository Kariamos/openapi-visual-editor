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
});
