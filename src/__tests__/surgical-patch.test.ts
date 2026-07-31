import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseOpenApi } from '../utils/yamlParser';
import { stringifyOpenApiPreservingSource } from '../utils/stringifyOpenApi';
import { applyJsonPatchToYamlSource } from '../utils/yamlSurgicalPatch';

const FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'stoplight-like.yaml'),
  'utf8'
);

/**
 * Runs the real pipeline: parse from disk, cross the webview JSON boundary,
 * mutate, and stringify against the original source.
 */
function pipeline(source: string, edit: (doc: Record<string, any>) => void): string {
  const doc = parseOpenApi(source);
  const w = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
  edit(w);
  return stringifyOpenApiPreservingSource(source, w as never);
}

/** LCS-free helper: lines present in only one of the two strings. */
function addedRemovedLines(before: string, after: string) {
  const a = before.split('\n');
  const b = after.split('\n');
  const counts = new Map<string, number>();
  for (const l of a) counts.set(l, (counts.get(l) ?? 0) + 1);
  for (const l of b) counts.set(l, (counts.get(l) ?? 0) - 1);
  const removed: string[] = [];
  const added: string[] = [];
  for (const [line, n] of counts) {
    if (n > 0) for (let i = 0; i < n; i++) removed.push(line);
    if (n < 0) for (let i = 0; i < -n; i++) added.push(line);
  }
  return { removed, added };
}

describe('Surgical patch — Stoplight-like fixture', () => {
  it('no-op returns the source byte-for-byte', () => {
    const out = pipeline(FIXTURE, () => undefined);
    expect(out).toBe(FIXTURE);
  });

  it('editing one scalar changes exactly one line', () => {
    const out = pipeline(FIXTURE, (d) => {
      d.info.title = 'SampleApi Edited';
    });
    const { removed, added } = addedRemovedLines(FIXTURE, out);
    expect(removed).toEqual(['  title: SampleApi']);
    expect(added).toEqual(['  title: SampleApi Edited']);
  });

  it('long single-line strings survive any edit untouched', () => {
    const out = pipeline(FIXTURE, (d) => {
      d.info.version = '2.0.0';
    });
    // The >80-column description, single-quoted note, and \r\n-escaped steps
    // must all remain exactly as authored.
    for (const line of FIXTURE.split('\n')) {
      if (line.length > 100) expect(out).toContain(line);
    }
  });

  it('editing a deep scalar changes only that line', () => {
    const out = pipeline(FIXTURE, (d) => {
      d.paths['/widgets'].get.summary = 'List widgets (edited)';
    });
    const { removed, added } = addedRemovedLines(FIXTURE, out);
    expect(removed).toEqual(['      summary: List widgets']);
    expect(added).toEqual(['      summary: List widgets (edited)']);
  });

  it('adding an endpoint only inserts new lines', () => {
    const out = pipeline(FIXTURE, (d) => {
      d.paths['/health'] = {
        get: { summary: 'Health probe', responses: { '200': { description: 'OK' } } },
      };
    });
    const { removed, added } = addedRemovedLines(FIXTURE, out);
    expect(removed).toEqual([]);
    expect(added).toContain('  /health:');
    expect(added.length).toBeLessThanOrEqual(6);
    expect(() => parseOpenApi(out)).not.toThrow();
  });

  it('deleting an endpoint only removes its lines', () => {
    const out = pipeline(FIXTURE, (d) => {
      delete d.paths['/'];
    });
    const { removed, added } = addedRemovedLines(FIXTURE, out);
    expect(added).toEqual([]);
    expect(removed).toContain('  /:');
    expect(out).not.toContain('operationId: get-root');
    // Everything else still present.
    expect(out).toContain('operationId: get-widgets');
    expect(() => parseOpenApi(out)).not.toThrow();
  });

  it('appending to a sequence adds a single line', () => {
    const out = pipeline(FIXTURE, (d) => {
      d.tags.push({ name: 'admin' });
    });
    const { removed, added } = addedRemovedLines(FIXTURE, out);
    expect(removed).toEqual([]);
    expect(added).toEqual(['  - name: admin']);
  });

  it('populating an empty flow map ({}) converts it to a block map', () => {
    const out = pipeline(FIXTURE, (d) => {
      d.paths['/'].get.responses['200'].content['application/json'].schema.properties = {
        status: { type: 'string' },
      };
    });
    expect(out).toContain('status:');
    const reparsed = parseOpenApi(out);
    expect(
      (reparsed.paths!['/']!.get!.responses['200'] as any).content['application/json'].schema
        .properties.status.type
    ).toBe('string');
    // Distant regions untouched.
    expect(out).toContain("summary: Get a single widget with a very long single-line summary");
  });

  it('two scalar edits change exactly two lines', () => {
    const out = pipeline(FIXTURE, (d) => {
      d.info.title = 'X';
      d.info.version = '3.0';
    });
    const { removed, added } = addedRemovedLines(FIXTURE, out);
    expect(removed).toHaveLength(2);
    expect(added).toHaveLength(2);
  });

  it('CRLF sources keep CRLF line endings on surgical edits', () => {
    const crlfSource = FIXTURE.replace(/\n/g, '\r\n');
    const doc = parseOpenApi(crlfSource);
    const w = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
    w.info.title = 'CRLF Edited';
    const out = stringifyOpenApiPreservingSource(crlfSource, w as never);
    expect(out).toContain('title: CRLF Edited');
    expect(out.split('\r\n').length).toBeGreaterThan(100);
    // No stray lone-LF lines introduced.
    expect(out.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('result always reparses to exactly the intended document', () => {
    const doc = parseOpenApi(FIXTURE);
    const w = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
    w.info.title = 'Verify';
    delete w.paths['/widgets'];
    w.tags.push({ name: 'extra' });
    const out = stringifyOpenApiPreservingSource(FIXTURE, w as never);
    const reparsed = JSON.parse(JSON.stringify(parseOpenApi(out)));
    expect(reparsed).toEqual(w);
  });
});

describe('applyJsonPatchToYamlSource — unit behavior', () => {
  const SMALL = `a: 1
b:
  c: hello
  d:
    - x
    - y
`;

  it('empty ops returns source unchanged', () => {
    expect(applyJsonPatchToYamlSource(SMALL, [])).toBe(SMALL);
  });

  it('replaces a nested scalar in place', () => {
    const out = applyJsonPatchToYamlSource(SMALL, [
      { op: 'replace', path: '/b/c', value: 'world' },
    ]);
    expect(out).toBe(SMALL.replace('c: hello', 'c: world'));
  });

  it('replaces a scalar inside a sequence', () => {
    const out = applyJsonPatchToYamlSource(SMALL, [
      { op: 'replace', path: '/b/d/1', value: 'z' },
    ]);
    expect(out).toBe(SMALL.replace('    - y', '    - z'));
  });

  it('adds a new key to a block map', () => {
    const out = applyJsonPatchToYamlSource(SMALL, [
      { op: 'add', path: '/b/e', value: 42 },
    ]);
    expect(out).toContain('  e: 42');
    // Existing lines untouched.
    expect(out).toContain('  c: hello');
  });

  it('removes a key including its whole block', () => {
    const out = applyJsonPatchToYamlSource(SMALL, [
      { op: 'remove', path: '/b/d' },
    ]);
    expect(out).toBe('a: 1\nb:\n  c: hello\n');
  });

  it('unescapes ~1 and ~0 in JSON-pointer segments', () => {
    const src = 'paths:\n  /a/b: 1\n  "x~y": 2\n';
    const out = applyJsonPatchToYamlSource(src, [
      { op: 'replace', path: '/paths/~1a~1b', value: 9 },
    ]);
    expect(out).toBe('paths:\n  /a/b: 9\n  "x~y": 2\n');
    const out2 = applyJsonPatchToYamlSource(src, [
      { op: 'replace', path: '/paths/x~0y', value: 7 },
    ]);
    expect(out2).toBe('paths:\n  /a/b: 1\n  "x~y": 7\n');
  });

  it('returns null when the target cannot be located', () => {
    expect(
      applyJsonPatchToYamlSource(SMALL, [{ op: 'replace', path: '/nope/missing', value: 1 }])
    ).toBeNull();
  });

  it('returns null rather than producing a semantically wrong result', () => {
    // expected disagrees with what the patch produces → safety net trips.
    const out = applyJsonPatchToYamlSource(
      SMALL,
      [{ op: 'replace', path: '/a', value: 2 }],
      { a: 999, b: { c: 'hello', d: ['x', 'y'] } }
    );
    expect(out).toBeNull();
  });

  it('removing the last remaining key of a map falls back (null)', () => {
    const src = 'only:\n  key: 1\n';
    expect(
      applyJsonPatchToYamlSource(src, [{ op: 'remove', path: '/only/key' }])
    ).toBeNull();
  });
});

describe('Escaped newlines stay on a single line', () => {
  // A double-quoted scalar carrying \r\n escapes must not be re-emitted as a
  // folded multi-line block. eemeli does that by default for any such string
  // longer than doubleQuotedMinMultiLineLength (40); the emitters raise it.
  const ESCAPED = `openapi: 3.0.3
info:
  title: API
  version: '1.0'
paths:
  /token:
    post:
      summary: Token
      description: "Exchanges authorization code for tokens.\\r\\nSupports three grant types:\\r\\n1. **authorization_code** - Exchange code for tokens\\r\\n2. **refresh_token** - Refresh expired access token\\r\\n\\r\\n**PKCE Flow:**\\r\\n- Provide \`code_verifier\` instead of \`client_secret\`"
components:
  schemas:
    Keep:
      only: 1
`;

  /** The description must occupy exactly one physical line. */
  const descriptionLines = (yaml: string) =>
    yaml.split('\n').filter((l) => l.includes('description:'));

  it('an unrelated edit leaves the escaped string byte-identical', () => {
    const out = pipeline(ESCAPED, (d) => {
      d.info.title = 'Edited';
    });
    const original = ESCAPED.split('\n').find((l) => l.includes('description:'))!;
    expect(out).toContain(original);
    expect(descriptionLines(out)).toHaveLength(1);
  });

  it('editing the escaped string itself keeps it on one line', () => {
    const out = pipeline(ESCAPED, (d) => {
      d.paths['/token'].post.description = 'First line.\r\nSecond line.\r\n\r\nAfter a blank line.';
    });
    const lines = descriptionLines(out);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('\\r\\n');
    // No folded continuation lines were introduced.
    expect(out.split('\n').length).toBe(ESCAPED.split('\n').length);
    // Round-trips to exactly the intended value.
    expect(
      (parseOpenApi(out).paths!['/token']!.post as any).description
    ).toBe('First line.\r\nSecond line.\r\n\r\nAfter a blank line.');
  });

  it('the whole-document fallback path also keeps it on one line', () => {
    // Removing the only key of a map is a case the surgical patcher refuses,
    // so this exercises the yaml-diff-patch fallback (which re-emits the file).
    const doc = parseOpenApi(ESCAPED);
    const w = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
    delete w.components.schemas.Keep.only;
    const out = stringifyOpenApiPreservingSource(ESCAPED, w as never);
    expect(descriptionLines(out)).toHaveLength(1);
    expect(descriptionLines(out)[0]).toContain('\\r\\n');
  });

  it('applyJsonPatchToYamlSource splices such a value inline', () => {
    const out = applyJsonPatchToYamlSource(ESCAPED, [
      { op: 'replace', path: '/paths/~1token/post/description', value: 'a\r\nb' },
    ]);
    expect(out).not.toBeNull();
    expect(descriptionLines(out!)).toHaveLength(1);
    expect(out!).toContain('description: "a\\r\\nb"');
  });
});
