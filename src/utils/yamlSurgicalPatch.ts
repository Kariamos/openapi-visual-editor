import {
  parseDocument,
  parse as yamlParse,
  stringify as yamlStringify,
  isMap,
  isSeq,
  isScalar,
  Scalar,
  YAMLMap,
  YAMLSeq,
  Pair,
  Node as YamlNode,
} from 'yaml';

/**
 * Surgical application of an RFC-6902 JSON patch onto a YAML source string.
 *
 * Rationale: any "parse + re-emit the whole document" strategy (js-yaml dump,
 * eemeli Document.toString(), yaml-diff-patch — which calls toString() even for
 * an empty patch) re-wraps long lines and re-styles scalars, so on large
 * real-world files (e.g. Stoplight Studio exports with 1000+ character lines)
 * a one-line edit rewrites the entire file. This module instead locates each
 * patched node's exact byte range in the ORIGINAL source (eemeli's
 * parseDocument keeps `node.range` offsets) and splices in only the changed
 * text, leaving every untouched byte of the file exactly as it was.
 *
 * The function is deliberately conservative: any situation it cannot handle
 * with certainty returns `null`, and the caller falls back to the legacy
 * whole-document strategy. As a final safety net the spliced result is
 * re-parsed and structurally compared against the intended document — if they
 * differ in ANY way, `null` is returned. The surgical path therefore can never
 * produce a semantically wrong file.
 */

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
}

interface Splice {
  start: number;
  end: number;
  text: string;
}

/** RFC 6901 unescape for a single path segment. */
function unescapeSegment(seg: string): string {
  return seg.replace(/~1/g, '/').replace(/~0/g, '~');
}

function splitPointer(path: string): string[] | null {
  if (path === '' || path === '/') return null; // root ops are not surgical
  if (!path.startsWith('/')) return null;
  return path.slice(1).split('/').map(unescapeSegment);
}

/** Start-of-line offset for a given position. */
function lineStart(source: string, offset: number): number {
  return source.lastIndexOf('\n', offset - 1) + 1;
}

/**
 * Offset just PAST the newline that terminates the line containing/after
 * `offset`. If `offset` sits right after a newline already, it is returned
 * unchanged (the node consumed its own trailing newline).
 */
function endOfLineInclusive(source: string, offset: number): number {
  if (offset > 0 && source[offset - 1] === '\n') return offset;
  const nl = source.indexOf('\n', offset);
  return nl === -1 ? source.length : nl + 1;
}

/** Indentation (leading spaces) of the line containing `offset`. */
function indentOfLine(source: string, offset: number): number {
  const ls = lineStart(source, offset);
  let i = ls;
  while (i < source.length && source[i] === ' ') i++;
  return i - ls;
}

function reindent(block: string, indent: number, eol: string): string {
  const pad = ' '.repeat(indent);
  return block
    .replace(/\n$/, '')
    .split('\n')
    .map((l) => (l.length > 0 ? pad + l : l))
    .join(eol);
}

/**
 * Emitter options shared by every write path.
 *
 * `lineWidth: 0` disables width-based wrapping, but on its own it does NOT stop
 * a double-quoted scalar that contains newlines from being split across lines:
 * that is governed by `doubleQuotedMinMultiLineLength` (default 40). Without
 * raising it, a value written as
 *
 *     description: "First line.\r\nSecond line."
 *
 * comes back as a folded multi-line block with a literal `\r` at each line end
 * and blank continuation lines. It round-trips to the same string, but it churns
 * the file and is far less readable, so keep such scalars on a single line.
 */
const EMIT_OPTS = {
  lineWidth: 0,
  indent: 2,
  doubleQuotedMinMultiLineLength: Number.MAX_SAFE_INTEGER,
} as const;

/** Emit a single value as YAML (no wrapping, 2-space indent). */
function emitValue(value: unknown): string {
  return yamlStringify(value, EMIT_OPTS);
}

/** Emit `key: value` as a standalone YAML block. */
function emitPair(key: string, value: unknown): string {
  return yamlStringify({ [key]: value }, EMIT_OPTS);
}

/** Emit `- value` as a standalone YAML sequence-item block. */
function emitSeqItem(value: unknown): string {
  return yamlStringify([value], EMIT_OPTS);
}

/** True when the emitted YAML for a scalar fits inline on one line. */
function inlineScalarText(value: unknown): string | null {
  if (value !== null && typeof value === 'object') return null;
  const emitted = emitValue(value).replace(/\n$/, '');
  if (emitted.includes('\n')) return null;
  return emitted;
}

interface Located {
  parent: YAMLMap | YAMLSeq;
  /** Pair within a map parent (undefined for seq parents). */
  pair?: Pair;
  /** Index within a seq parent (undefined for map parents). */
  index?: number;
  /** The target node (undefined for `add` of a new key). */
  node?: YamlNode | null;
}

/** Walk the document to the parent collection of the last path segment. */
function locate(root: YamlNode | null, segments: string[]): Located | null {
  let node: YamlNode | null = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (isMap(node)) {
      const pair = (node as YAMLMap).items.find(
        (p) => isScalar(p.key) && String((p.key as Scalar).value) === seg
      );
      if (!pair) return null;
      node = pair.value as YamlNode | null;
    } else if (isSeq(node)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= (node as YAMLSeq).items.length) return null;
      node = (node as YAMLSeq).items[idx] as YamlNode | null;
    } else {
      return null;
    }
  }
  const last = segments[segments.length - 1];
  if (isMap(node)) {
    const map = node as YAMLMap;
    const pair = map.items.find(
      (p) => isScalar(p.key) && String((p.key as Scalar).value) === last
    );
    return { parent: map, pair, node: pair ? (pair.value as YamlNode | null) : undefined };
  }
  if (isSeq(node)) {
    const seq = node as YAMLSeq;
    if (last === '-') return { parent: seq, index: seq.items.length };
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0) return null;
    return { parent: seq, index: idx, node: seq.items[idx] as YamlNode | undefined };
  }
  return null;
}

function nodeEnd(pair: Pair): number | null {
  const v = (pair.value ?? pair.key) as YamlNode | null;
  const range = v && (v as Scalar).range;
  return range ? range[2] : null;
}

/** Structural deep-equality (order-insensitive for object keys). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    );
  }
  return false;
}

/**
 * Applies `ops` to `source` by splicing only the affected byte ranges.
 * Returns the patched YAML, or `null` when the patch cannot be applied
 * surgically with full confidence (caller must fall back).
 *
 * `expected` (when provided) is the full intended document; the spliced
 * result is re-parsed and compared against it as a safety net.
 */
export function applyJsonPatchToYamlSource(
  source: string,
  ops: JsonPatchOp[],
  expected?: unknown
): string | null {
  if (ops.length === 0) return source;

  let doc;
  try {
    doc = parseDocument(source, { uniqueKeys: false });
  } catch {
    return null;
  }
  if (doc.errors.length > 0 || !doc.contents) return null;

  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const splices: Splice[] = [];

  for (const op of ops) {
    const segments = splitPointer(op.path);
    if (!segments) return null;
    if (op.op !== 'add' && op.op !== 'remove' && op.op !== 'replace') return null;

    const loc = locate(doc.contents as YamlNode, segments);
    if (!loc) return null;
    const { parent } = loc;
    // Non-empty flow collections are too entangled for line surgery.
    if ((parent as YAMLMap).flow && (parent as YAMLMap).items.length > 0) return null;

    const lastSeg = segments[segments.length - 1];

    if (op.op === 'replace') {
      if (loc.node === undefined) return null;
      const target = loc.node;
      // Fast path: plain scalar → plain scalar, spliced in place.
      if (
        target &&
        isScalar(target) &&
        (target as Scalar).type !== Scalar.BLOCK_LITERAL &&
        (target as Scalar).type !== Scalar.BLOCK_FOLDED
      ) {
        const inline = inlineScalarText(op.value);
        const range = (target as Scalar).range;
        if (inline !== null && range) {
          splices.push({ start: range[0], end: range[1], text: inline });
          continue;
        }
      }
      // General path: replace the whole pair / seq item.
      if (isMap(parent) && loc.pair) {
        const keyRange = (loc.pair.key as Scalar).range;
        const end = nodeEnd(loc.pair);
        if (!keyRange || end === null) return null;
        const start = lineStart(source, keyRange[0]);
        const stop = endOfLineInclusive(source, end);
        const indent = keyRange[0] - start;
        const text = reindent(emitPair(lastSeg, op.value), indent, eol) + eol;
        splices.push({ start, end: stop, text });
      } else if (isSeq(parent) && loc.node) {
        const range = (loc.node as Scalar).range;
        if (!range) return null;
        const start = lineStart(source, range[0]);
        const stop = endOfLineInclusive(source, range[2]);
        const indent = indentOfLine(source, range[0] - 2 >= start ? range[0] - 2 : range[0]);
        const text = reindent(emitSeqItem(op.value), indent, eol) + eol;
        splices.push({ start, end: stop, text });
      } else {
        return null;
      }
    } else if (op.op === 'remove') {
      if (isMap(parent)) {
        if (!loc.pair) return null;
        if (parent.items.length <= 1) return null; // would leave an empty map
        const keyRange = (loc.pair.key as Scalar).range;
        const end = nodeEnd(loc.pair);
        if (!keyRange || end === null) return null;
        splices.push({
          start: lineStart(source, keyRange[0]),
          end: endOfLineInclusive(source, end),
          text: '',
        });
      } else if (isSeq(parent)) {
        if (loc.node === undefined) return null;
        if (parent.items.length <= 1) return null; // would leave an empty seq
        const range = (loc.node as Scalar).range;
        if (!range) return null;
        splices.push({
          start: lineStart(source, range[0]),
          end: endOfLineInclusive(source, range[2]),
          text: '',
        });
      } else {
        return null;
      }
    } else {
      // add
      if (isMap(parent)) {
        if (loc.pair) return null; // key already exists — compare shouldn't do this
        if (parent.flow) {
          // Empty flow map `{}` → replace it with a block map.
          const range = (parent as YAMLMap).range;
          if (!range || parent.items.length > 0) return null;
          const ownerIndent = indentOfLine(source, range[0]);
          const start = source[range[0] - 1] === ' ' ? range[0] - 1 : range[0];
          const text = eol + reindent(emitPair(lastSeg, op.value), ownerIndent + 2, eol);
          splices.push({ start, end: range[1], text });
        } else {
          const lastPair = parent.items[parent.items.length - 1];
          const keyRange = (lastPair.key as Scalar).range;
          const end = nodeEnd(lastPair);
          if (!keyRange || end === null) return null;
          const indent = keyRange[0] - lineStart(source, keyRange[0]);
          const insertAt = endOfLineInclusive(source, end);
          const text = reindent(emitPair(lastSeg, op.value), indent, eol) + eol;
          splices.push({ start: insertAt, end: insertAt, text });
        }
      } else if (isSeq(parent)) {
        const idx = loc.index;
        if (idx === undefined) return null;
        if (parent.flow) {
          // Empty flow seq `[]` → replace it with a block seq.
          const range = (parent as YAMLSeq).range;
          if (!range || parent.items.length > 0) return null;
          const ownerIndent = indentOfLine(source, range[0]);
          const start = source[range[0] - 1] === ' ' ? range[0] - 1 : range[0];
          const text = eol + reindent(emitSeqItem(op.value), ownerIndent + 2, eol);
          splices.push({ start, end: range[1], text });
        } else if (idx >= parent.items.length) {
          // Append after the last item.
          const last = parent.items[parent.items.length - 1] as YamlNode;
          const range = (last as Scalar).range;
          if (!range) return null;
          const dashIndent = indentOfLine(source, lineStart(source, range[0]));
          const insertAt = endOfLineInclusive(source, range[2]);
          const text = reindent(emitSeqItem(op.value), dashIndent, eol) + eol;
          splices.push({ start: insertAt, end: insertAt, text });
        } else {
          // Insert before the item currently at idx.
          const at = parent.items[idx] as YamlNode;
          const range = (at as Scalar).range;
          if (!range) return null;
          const start = lineStart(source, range[0]);
          const dashIndent = indentOfLine(source, start);
          const text = reindent(emitSeqItem(op.value), dashIndent, eol) + eol;
          splices.push({ start, end: start, text });
        }
      } else {
        return null;
      }
    }
  }

  // Apply splices from the end of the file backwards; overlapping ranges mean
  // two ops touched intersecting regions — bail out.
  splices.sort((a, b) => b.start - a.start || b.end - a.end);
  for (let i = 1; i < splices.length; i++) {
    if (splices[i].end > splices[i - 1].start) return null;
  }
  let result = source;
  for (const s of splices) {
    result = result.slice(0, s.start) + s.text + result.slice(s.end);
  }

  // Safety net: the surgical result must parse to EXACTLY the intended doc.
  if (expected !== undefined) {
    try {
      const reparsed = yamlParse(result, { uniqueKeys: false });
      if (!deepEqual(reparsed, expected)) return null;
    } catch {
      return null;
    }
  }

  return result;
}
