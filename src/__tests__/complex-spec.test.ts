import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { yamlOverwrite } from 'yaml-diff-patch';
import { parseOpenApi } from '../utils/yamlParser';
import { extractBlock, diffLines } from './helpers/yamlDiff';

const FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'complex-api.yaml'),
  'utf8'
);

describe('Complex spec fixture — localized edit safety', () => {
  it('no-op round-trip is byte-identical', () => {
    const doc = parseOpenApi(FIXTURE);
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    expect(out).toBe(FIXTURE);
  });

  it('adding a tag does not reformat the existing tags', () => {
    const doc = parseOpenApi(FIXTURE);
    doc.tags = [...(doc.tags ?? []), { name: 'newtag', description: 'Newly added' }];
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    // Each pre-existing tag line must still be present verbatim.
    expect(out).toContain('- name: users');
    expect(out).toContain('- name: products');
    expect(out).toContain('- name: reports');
    expect(out).toContain('- name: newtag');
  });

  it('adding a new path does not reorder or reformat existing paths', () => {
    const doc = parseOpenApi(FIXTURE);
    doc.paths!['/health'] = {
      get: {
        summary: 'Health probe',
        responses: { '200': { description: 'OK' } },
      },
    };
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    const usersBefore = extractBlock(FIXTURE, '  /users:');
    const usersAfter = extractBlock(out, '  /users:');
    expect(usersAfter).toBe(usersBefore);
    expect(out).toContain('/health:');
  });

  it('changing a response description touches only that line', () => {
    const doc = parseOpenApi(FIXTURE);
    const resp = doc.paths!['/users']!.get!.responses!['200'];
    resp.description = 'Edited response description';
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    const changes = diffLines(FIXTURE, out);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('changed');
    expect(changes[0].after).toContain('Edited response description');
  });

  it('updating a nested allOf property only touches that property', () => {
    const doc = parseOpenApi(FIXTURE);
    const user = doc.components!.schemas!['User'] as Record<string, unknown>;
    const allOf = user.allOf as Array<Record<string, unknown>>;
    const props = (allOf[1].properties as Record<string, Record<string, unknown>>);
    // Edit an existing property's description — stays inside the allOf body.
    (props.name as Record<string, unknown>).description = 'Full display name';
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    expect(out).toContain('description: Full display name');
    // The Identifiable subschema block is untouched.
    const idBefore = extractBlock(FIXTURE, '    Identifiable:');
    const idAfter = extractBlock(out, '    Identifiable:');
    expect(idAfter).toBe(idBefore);
  });

  it('deleting one endpoint does not modify components', () => {
    const doc = parseOpenApi(FIXTURE);
    delete doc.paths!['/reports/sales'];
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    expect(out).not.toContain('/reports/sales:');
    const compBefore = extractBlock(FIXTURE, 'components:');
    const compAfter = extractBlock(out, 'components:');
    expect(compAfter).toBe(compBefore);
  });

  it('deleting a schema referenced by $ref leaves YAML syntactically valid', () => {
    const doc = parseOpenApi(FIXTURE);
    delete doc.components!.schemas!['Error'];
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    // Output is still parseable even if $ref pointers are now dangling.
    expect(() => parseOpenApi(out)).not.toThrow();
    expect(out).not.toMatch(/^ {4}Error:$/m);
    // The validation of dangling refs is Spectral's job, not the editor's.
  });

  it('matches snapshot after a standard surface-level edit', () => {
    const doc = parseOpenApi(FIXTURE);
    doc.info.version = '2.5.0';
    const out = yamlOverwrite(FIXTURE, doc as Record<string, unknown>);
    expect(out).toMatchSnapshot();
  });
});
