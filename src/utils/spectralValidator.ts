import { Spectral, type RulesetDefinition } from '@stoplight/spectral-core';
import { truthy, falsy } from '@stoplight/spectral-functions';
import { oas } from '@stoplight/spectral-rulesets';

// ─── Types (matches the webview Diagnostic interface) ───────────────────────

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type DiagnosticCategory =
  | 'structure'
  | 'paths'
  | 'operations'
  | 'parameters'
  | 'schemas'
  | 'responses'
  | 'examples'
  | 'security'
  | 'references';

export interface SpectralDiagnostic {
  severity: DiagnosticSeverity;
  path: string;
  message: string;
  category: DiagnosticCategory;
  source: 'spectral';
  /** Spectral rule code for reference */
  ruleCode: string;
}

// ─── Spectral singleton ────────────────────────────────────────────────────

let spectralInstance: Spectral | null = null;

async function getSpectral(): Promise<Spectral> {
  if (!spectralInstance) {
    spectralInstance = new Spectral();
    spectralInstance.setRuleset({
      extends: [oas as RulesetDefinition],
      rules: {
        // ── Custom rules not covered by Spectral OAS ──────────────────────

        // Warn when GET/DELETE/HEAD has a request body
        'custom-no-request-body-on-get': {
          message: 'GET/DELETE/HEAD with a request body is unusual and may not be supported by all clients.',
          given: [
            '$.paths[*].get.requestBody',
            '$.paths[*].delete.requestBody',
            '$.paths[*].head.requestBody',
          ],
          severity: 1, // warning
          then: {
            function: falsy,
          },
        },

        // Suggest using 204 when 200/201 has no content
        'custom-success-response-body': {
          message: 'Response has no content body. Consider adding a response schema, or use 204 for no-content responses.',
          given: [
            '$.paths[*][*].responses.200',
            '$.paths[*][*].responses.201',
          ],
          severity: 3, // hint → maps to info
          then: {
            field: 'content',
            function: truthy,
          },
        },
      },
    });
  }
  return spectralInstance;
}

// ─── Severity mapping ──────────────────────────────────────────────────────

// Spectral severity: 0 = error, 1 = warning, 2 = info, 3 = hint
function mapSeverity(spectralSeverity: number): DiagnosticSeverity {
  switch (spectralSeverity) {
    case 0: return 'error';
    case 1: return 'warning';
    case 2: return 'info';
    case 3: return 'info'; // Map hint → info
    default: return 'info';
  }
}

// ─── Category mapping ──────────────────────────────────────────────────────

// Map Spectral rule codes to our diagnostic categories
function mapCategory(ruleCode: string, pathSegments: (string | number)[]): DiagnosticCategory {
  const code = String(ruleCode).toLowerCase();

  // Security-related rules
  if (code.includes('security') || code.includes('auth')) return 'security';

  // Schema-related rules
  if (code.includes('schema') || code.includes('typed-enum') || code.includes('component')) return 'schemas';

  // Parameter-related rules
  if (code.includes('parameter') || code.includes('param')) return 'parameters';

  // Response-related rules
  if (code.includes('response') || code.includes('success-response')) return 'responses';

  // Operation-related rules
  if (code.includes('operation') || code.includes('operationId')) return 'operations';

  // Path-related rules
  if (code.includes('path')) return 'paths';

  // Reference-related rules
  if (code.includes('ref')) return 'references';

  // Example-related rules
  if (code.includes('example')) return 'examples';

  // Try to infer from path segments
  if (pathSegments.length > 0) {
    const firstSegment = String(pathSegments[0]).toLowerCase();
    if (firstSegment === 'paths') {
      // Check deeper segments for more specific categorization
      if (pathSegments.some(s => String(s) === 'parameters')) return 'parameters';
      if (pathSegments.some(s => String(s) === 'responses')) return 'responses';
      if (pathSegments.some(s => String(s) === 'requestBody')) return 'operations';
      if (pathSegments.some(s => String(s) === 'security')) return 'security';
      return 'operations';
    }
    if (firstSegment === 'components') return 'schemas';
    if (firstSegment === 'servers') return 'structure';
    if (firstSegment === 'info') return 'structure';
    if (firstSegment === 'tags') return 'structure';
  }

  return 'structure';
}

// ─── Path formatting ───────────────────────────────────────────────────────

// Convert Spectral path array ['paths', '/pets', 'get', 'responses', '200']
// to dot-notation string: "paths./pets.GET.responses.200"
function formatPath(segments: (string | number)[]): string {
  if (segments.length === 0) return '(root)';

  return segments.map((seg, i) => {
    const str = String(seg);
    // Uppercase HTTP methods for readability
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
    if (i >= 2 && httpMethods.includes(str)) return str.toUpperCase();
    // Array indices → bracket notation
    if (typeof seg === 'number') return `[${seg}]`;
    return str;
  }).join('.');
}

// ─── Main validation function ──────────────────────────────────────────────

/**
 * Runs Spectral OAS validation on a YAML string and returns diagnostics
 * in the same format used by the webview DiagnosticsPanel.
 *
 * @param yamlString - Raw YAML content of the OpenAPI document
 * @returns Array of diagnostics with source: 'spectral'
 */
export async function runSpectralValidation(yamlString: string): Promise<SpectralDiagnostic[]> {
  const spectral = await getSpectral();

  const results = await spectral.run(yamlString);

  return results.map((result) => ({
    severity: mapSeverity(result.severity),
    path: formatPath(result.path),
    message: result.message,
    category: mapCategory(String(result.code), result.path),
    source: 'spectral' as const,
    ruleCode: String(result.code),
  }));
}
