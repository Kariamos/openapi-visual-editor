import { yamlOverwrite } from 'yaml-diff-patch';
import { parseDocument } from 'yaml';
import { serializeOpenApi, OpenApiDocument } from './yamlParser';
import { detectFormat } from './inputFormat';

/**
 * Produces a serialized form of `doc` that preserves the formatting of the
 * original `source` string whenever possible.
 *
 * - For a YAML source, uses yaml-diff-patch to apply a minimal in-place patch
 *   so that untouched sections keep their quoting, indentation, and key order.
 * - For a JSON source, re-emits JSON with 2-space indent so the file keeps its
 *   original format instead of silently becoming YAML.
 * - When the source is empty (first write on a brand-new file), falls back to
 *   a full YAML serialization.
 *
 * yaml-diff-patch hard-codes lineWidth:80 when serializing patched values, so
 * we re-parse its output and re-stringify with lineWidth:0 to prevent it from
 * inserting unwanted line breaks into long description strings.
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
  const patched = yamlOverwrite(source, doc as Record<string, unknown>);
  // No changes: return the original source byte-for-byte to preserve everything
  // (comments, line endings, trailing whitespace, etc.).
  if (patched === source) return source;
  // yaml-diff-patch serializes changed string values with lineWidth:80, which
  // inserts unwanted line breaks into long descriptions. Re-parse and re-stringify
  // with lineWidth:0 to remove them, then restore the original line-ending style.
  const usesCRLF = source.includes('\r\n');
  const fixed = parseDocument(patched).toString({ lineWidth: 0 });
  return usesCRLF ? fixed.replace(/\n/g, '\r\n') : fixed;
}
