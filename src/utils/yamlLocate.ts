import { parseDocument, isMap, isSeq, isScalar, Scalar, YAMLMap, YAMLSeq, Node as YamlNode } from 'yaml';

export interface YamlRange {
  /** Byte offset of the first character of the located node (its key line for map entries). */
  start: number;
  /** Byte offset just past the end of the node's value. */
  end: number;
}

export interface LineCol {
  /** 0-based line index. */
  line: number;
  /** 0-based column index. */
  col: number;
}

/**
 * Locates the byte range in `source` covering the node at `path` (an array of
 * map keys / sequence indices, e.g. ['paths', '/users', 'get']).
 *
 * For map entries the range starts at the KEY (so revealing an operation
 * highlights `get:` onward) and ends at the end of the value. Returns null
 * when the path cannot be resolved.
 */
export function locateYamlNode(source: string, path: Array<string | number>): YamlRange | null {
  if (path.length === 0) return null;
  let doc;
  try {
    doc = parseDocument(source, { uniqueKeys: false });
  } catch {
    return null;
  }
  if (doc.errors.length > 0 || !doc.contents) return null;

  let node: YamlNode | null = doc.contents as YamlNode;
  let start: number | null = null;
  let end: number | null = null;

  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (isMap(node)) {
      const pair = (node as YAMLMap).items.find(
        (p) => isScalar(p.key) && String((p.key as Scalar).value) === String(seg)
      );
      if (!pair) return null;
      const keyRange = (pair.key as Scalar).range;
      const valNode = pair.value as YamlNode | null;
      const valRange = valNode && (valNode as Scalar).range;
      if (!keyRange) return null;
      start = keyRange[0];
      end = valRange ? valRange[1] : keyRange[2];
      node = valNode;
    } else if (isSeq(node)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= (node as YAMLSeq).items.length) return null;
      const item = (node as YAMLSeq).items[idx] as YamlNode | null;
      const range = item && (item as Scalar).range;
      if (!range) return null;
      start = range[0];
      end = range[1];
      node = item;
    } else {
      return null;
    }
  }

  if (start === null || end === null) return null;
  // Node ranges may include trailing whitespace/newlines — trim them so the
  // reveal selection ends at the last meaningful character.
  while (end > start && /\s/.test(source[end - 1])) end--;
  return { start, end };
}

/** Converts a byte offset into a 0-based line/column position. */
export function offsetToLineCol(source: string, offset: number): LineCol {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 0;
  let lastNl = -1;
  for (let i = 0; i < clamped; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lastNl = i;
    }
  }
  return { line, col: clamped - lastNl - 1 };
}
