import { yamlOverwrite } from 'yaml-diff-patch';
import { parseDocument, parse as yamlParse } from 'yaml';
import { compare } from 'fast-json-patch';
import { serializeOpenApi, OpenApiDocument } from './yamlParser';
import { detectFormat } from './inputFormat';
import { applyJsonPatchToYamlSource, JsonPatchOp } from './yamlSurgicalPatch';

/**
 * Produces a serialized form of `doc` that preserves the formatting of the
 * original `source` string whenever possible.
 *
 * Strategy, in order:
 *
 * 1. Empty source (brand-new file) → full YAML serialization.
 * 2. JSON source → re-emit JSON so the file does not silently become YAML.
 * 3. Diff `source` against `doc` (RFC-6902 via fast-json-patch, comparing
 *    against the same eemeli parse that the patcher uses):
 *    a. Empty diff → return `source` byte-for-byte. This guarantees that
 *       opening a document and saving without changes NEVER rewrites the file.
 *    b. Apply the diff surgically (see yamlSurgicalPatch.ts): only the byte
 *       ranges of the changed nodes are spliced; every untouched line —
 *       including 1000+ character single-line strings that any re-emit would
 *       re-wrap — survives verbatim. The surgical result is verified by
 *       re-parsing before being trusted.
 *    c. Fallback: yaml-diff-patch whole-document patch. Its output re-wraps
 *       long lines at 80 columns (it calls Document.toString() with default
 *       options), so we re-emit with lineWidth: 0 and restore the original
 *       line-ending style. Semantically always correct, cosmetically lossy.
 */
export function stringifyOpenApiPreservingSource(
  source: string,
  doc: OpenApiDocument
): string {
  if (!source || source.trim().length === 0) {
    return serializeOpenApi(doc);
  }
  if (detectFormat(source) === 'json') {
    return JSON.stringify(doc, null, 2) + '\n';
  }

  let oldJson: unknown;
  try {
    oldJson = yamlParse(source, { uniqueKeys: false });
  } catch {
    oldJson = undefined;
  }

  if (oldJson !== undefined && oldJson !== null && typeof oldJson === 'object') {
    const ops = compare(oldJson as object, doc as object) as JsonPatchOp[];
    // No changes: return the original source byte-for-byte to preserve
    // everything (comments, line endings, long lines, trailing whitespace).
    if (ops.length === 0) return source;

    const surgical = applyJsonPatchToYamlSource(source, ops, doc);
    if (surgical !== null) return surgical;
  }

  // Legacy fallback: whole-document patch + global re-emit.
  const patched = yamlOverwrite(source, doc as Record<string, unknown>);
  if (patched === source) return source;
  // yaml-diff-patch serializes with lineWidth:80, which inserts unwanted line
  // breaks into long strings. Re-emit without wrapping, then restore the
  // original line-ending style. doubleQuotedMinMultiLineLength is raised so a
  // double-quoted scalar containing `\r\n` escapes stays on one line instead of
  // being folded into a multi-line block (see EMIT_OPTS in yamlSurgicalPatch).
  const usesCRLF = source.includes('\r\n');
  const fixed = parseDocument(patched).toString({
    lineWidth: 0,
    doubleQuotedMinMultiLineLength: Number.MAX_SAFE_INTEGER,
  });
  return usesCRLF ? fixed.replace(/\n/g, '\r\n') : fixed;
}
