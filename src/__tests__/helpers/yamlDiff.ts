/**
 * Helpers used by YAML round-trip tests to assert that a transformation touches
 * only the expected lines.
 */

export interface LineDiff {
  /** 1-based line number in the original text. */
  line: number;
  kind: 'added' | 'removed' | 'changed';
  before?: string;
  after?: string;
}

/**
 * Produces a naive line-aligned diff between two strings. Two lines at the same
 * 1-based index are compared directly: equal lines are skipped, everything else
 * becomes a LineDiff entry. Useful to assert that a patch affected only the
 * lines we expect, regardless of ordering issues.
 *
 * Not a full Myers diff — intended for tests where the two sides have the same
 * length or at most differ by a handful of inserted/removed lines.
 */
export function diffLines(a: string, b: string): LineDiff[] {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const max = Math.max(aLines.length, bLines.length);
  const out: LineDiff[] = [];
  for (let i = 0; i < max; i++) {
    const before = aLines[i];
    const after = bLines[i];
    if (before === after) continue;
    if (before === undefined) {
      out.push({ line: i + 1, kind: 'added', after });
    } else if (after === undefined) {
      out.push({ line: i + 1, kind: 'removed', before });
    } else {
      out.push({ line: i + 1, kind: 'changed', before, after });
    }
  }
  return out;
}

/**
 * Returns the lines that are present in `original` but missing from `updated`,
 * and vice versa. Order-insensitive: useful when yaml-diff-patch may reorder
 * items in a mapping but the line content is the same.
 */
export function lineSetDiff(
  original: string,
  updated: string
): { removed: string[]; added: string[] } {
  const o = new Set(original.split('\n'));
  const u = new Set(updated.split('\n'));
  const removed: string[] = [];
  const added: string[] = [];
  for (const l of o) if (!u.has(l)) removed.push(l);
  for (const l of u) if (!o.has(l)) added.push(l);
  return { removed, added };
}

/**
 * Counts runs of blank lines (empty or whitespace-only) of at least
 * `minLength` consecutive lines. Helps assert that an edit did not introduce
 * stray blank lines.
 */
export function countBlankRuns(text: string, minLength = 2): number {
  const lines = text.split('\n');
  let run = 0;
  let runs = 0;
  for (const line of lines) {
    if (line.trim().length === 0) {
      run += 1;
      continue;
    }
    if (run >= minLength) runs += 1;
    run = 0;
  }
  if (run >= minLength) runs += 1;
  return runs;
}

/**
 * Extracts the slice of text corresponding to a top-level or nested block
 * starting at the given key (e.g. "components:", "  schemas:"). Reads until the
 * next line whose indentation is less-than-or-equal-to the starting key's
 * indent.
 */
export function extractBlock(text: string, headerLine: string): string {
  const lines = text.split('\n');
  const startIdx = lines.findIndex((l) => l === headerLine);
  if (startIdx === -1) {
    throw new Error(`extractBlock: header not found: ${JSON.stringify(headerLine)}`);
  }
  const baseIndent = headerLine.match(/^ */)?.[0].length ?? 0;
  const chunk: string[] = [headerLine];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) {
      chunk.push(line);
      continue;
    }
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent <= baseIndent) break;
    chunk.push(line);
  }
  // Trim trailing blank lines so comparisons are not sensitive to whitespace.
  while (chunk.length > 0 && chunk[chunk.length - 1].trim().length === 0) {
    chunk.pop();
  }
  return chunk.join('\n');
}
