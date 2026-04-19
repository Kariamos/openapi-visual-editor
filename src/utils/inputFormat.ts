/**
 * Detects whether a text buffer is JSON or YAML. The heuristic is
 * intentionally minimal — it only inspects the first non-whitespace character
 * (after stripping a UTF-8 BOM). An OpenAPI document that starts with `{` or
 * `[` is JSON; anything else is treated as YAML.
 */
export function detectFormat(text: string): 'yaml' | 'json' {
  if (!text) return 'yaml';
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'yaml';
}
