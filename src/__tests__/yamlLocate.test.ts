import { describe, it, expect } from 'vitest';
import { locateYamlNode, offsetToLineCol } from '../utils/yamlLocate';

const YAML = `openapi: 3.0.3
info:
  title: API
  version: '1.0'
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: OK
  '/users/{id}':
    delete:
      summary: Remove
tags:
  - name: users
  - name: admin
components:
  schemas:
    User:
      type: object
`;

describe('locateYamlNode', () => {
  it('locates a top-level scalar entry', () => {
    const r = locateYamlNode(YAML, ['openapi']);
    expect(r).not.toBeNull();
    expect(YAML.slice(r!.start, r!.end)).toBe('openapi: 3.0.3');
  });

  it('locates a nested operation (key included)', () => {
    const r = locateYamlNode(YAML, ['paths', '/users', 'get']);
    expect(r).not.toBeNull();
    const text = YAML.slice(r!.start, r!.end);
    expect(text.startsWith('get:')).toBe(true);
    expect(text).toContain('summary: List users');
    expect(text).toContain('description: OK');
    expect(text).not.toContain('/users/{id}');
  });

  it('locates a quoted path key', () => {
    const r = locateYamlNode(YAML, ['paths', '/users/{id}', 'delete']);
    expect(r).not.toBeNull();
    expect(YAML.slice(r!.start, r!.end)).toContain('summary: Remove');
  });

  it('locates a sequence element by index', () => {
    const r = locateYamlNode(YAML, ['tags', 1]);
    expect(r).not.toBeNull();
    expect(YAML.slice(r!.start, r!.end)).toBe('name: admin');
  });

  it('locates a component schema', () => {
    const r = locateYamlNode(YAML, ['components', 'schemas', 'User']);
    expect(r).not.toBeNull();
    const text = YAML.slice(r!.start, r!.end);
    expect(text.startsWith('User:')).toBe(true);
    expect(text).toContain('type: object');
  });

  it('locates numeric-looking quoted keys', () => {
    const r = locateYamlNode(YAML, ['paths', '/users', 'get', 'responses', '200']);
    expect(r).not.toBeNull();
    expect(YAML.slice(r!.start, r!.end)).toContain('description: OK');
  });

  it('returns null for a missing path', () => {
    expect(locateYamlNode(YAML, ['paths', '/nope'])).toBeNull();
    expect(locateYamlNode(YAML, ['tags', 99])).toBeNull();
    expect(locateYamlNode(YAML, [])).toBeNull();
  });

  it('returns null on invalid YAML', () => {
    expect(locateYamlNode('key: [unclosed', ['key'])).toBeNull();
  });
});

describe('offsetToLineCol', () => {
  it('maps offsets to 0-based line/col', () => {
    const src = 'ab\ncd\nef';
    expect(offsetToLineCol(src, 0)).toEqual({ line: 0, col: 0 });
    expect(offsetToLineCol(src, 1)).toEqual({ line: 0, col: 1 });
    expect(offsetToLineCol(src, 3)).toEqual({ line: 1, col: 0 });
    expect(offsetToLineCol(src, 7)).toEqual({ line: 2, col: 1 });
  });

  it('clamps out-of-range offsets', () => {
    expect(offsetToLineCol('abc', 999).line).toBe(0);
    expect(offsetToLineCol('abc', -5)).toEqual({ line: 0, col: 0 });
  });
});
