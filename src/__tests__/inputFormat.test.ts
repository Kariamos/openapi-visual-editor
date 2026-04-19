import { describe, it, expect } from 'vitest';
import { detectFormat } from '../utils/inputFormat';
import { stringifyOpenApiPreservingSource } from '../utils/stringifyOpenApi';
import { parseOpenApi } from '../utils/yamlParser';

describe('detectFormat', () => {
  it('identifies JSON starting with {', () => {
    expect(detectFormat('{"openapi":"3.0.3"}')).toBe('json');
  });
  it('identifies JSON starting with [ (array root)', () => {
    expect(detectFormat('[1,2,3]')).toBe('json');
  });
  it('identifies YAML for anything else', () => {
    expect(detectFormat('openapi: 3.0.3\ninfo: {}')).toBe('yaml');
  });
  it('ignores leading whitespace', () => {
    expect(detectFormat('   \n\n  {"a":1}')).toBe('json');
    expect(detectFormat('\n\nkey: value')).toBe('yaml');
  });
  it('ignores UTF-8 BOM', () => {
    expect(detectFormat('\uFEFF{"a":1}')).toBe('json');
    expect(detectFormat('\uFEFFopenapi: 3.0.3')).toBe('yaml');
  });
  it('returns yaml for empty string', () => {
    expect(detectFormat('')).toBe('yaml');
  });
});

describe('stringifyOpenApiPreservingSource', () => {
  const YAML_DOC = `openapi: 3.0.3
info:
  title: 'API'
  version: 1.0.0
paths: {}
`;

  it('YAML input round-trips as YAML preserving quotes', () => {
    const doc = parseOpenApi(YAML_DOC);
    const out = stringifyOpenApiPreservingSource(YAML_DOC, doc);
    expect(out).toContain("title: 'API'");
    expect(out).not.toMatch(/^\{/);
  });

  it('JSON input round-trips as JSON (not YAML)', () => {
    const json = JSON.stringify(
      { openapi: '3.0.3', info: { title: 'API', version: '1.0.0' }, paths: {} },
      null,
      2
    );
    const doc = parseOpenApi(json);
    const out = stringifyOpenApiPreservingSource(json, doc);
    expect(out.trimStart().startsWith('{')).toBe(true);
    // Round-trips back to an equivalent document.
    expect(JSON.parse(out)).toEqual(doc);
  });

  it('falls back to full YAML serialization when source is empty', () => {
    const doc = parseOpenApi(YAML_DOC);
    const out = stringifyOpenApiPreservingSource('', doc);
    expect(out).toContain('openapi:');
    expect(out).toContain('title:');
  });

  it('falls back to full YAML serialization when source is whitespace only', () => {
    const doc = parseOpenApi(YAML_DOC);
    const out = stringifyOpenApiPreservingSource('   \n\n  ', doc);
    expect(out).toContain('openapi:');
  });
});
