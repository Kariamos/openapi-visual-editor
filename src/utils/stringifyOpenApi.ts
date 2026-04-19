import { yamlOverwrite } from 'yaml-diff-patch';
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
  return yamlOverwrite(source, doc as Record<string, unknown>);
}
