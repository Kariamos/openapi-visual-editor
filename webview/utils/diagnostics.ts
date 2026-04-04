import type { OpenApiDocument, OpenApiOperation, OpenApiSchema, HttpMethod } from '../App';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Human-readable location path, e.g. "paths./pets.get.parameters[0]" */
  path: string;
  /** Clear message explaining the issue */
  message: string;
  /** Category for grouping in the panel */
  category: DiagnosticCategory;
  /** Source of the diagnostic */
  source?: 'custom' | 'spectral';
  /** Rule code (for Spectral diagnostics) */
  ruleCode?: string;
}

export type DiagnosticCategory =
  | 'structure'    // Missing required fields, wrong types
  | 'paths'        // Path-level issues
  | 'operations'   // Operation-level issues
  | 'parameters'   // Parameter issues
  | 'schemas'      // Schema/component issues
  | 'responses'    // Response issues
  | 'examples'     // Example issues
  | 'security'     // Security scheme issues
  | 'references';  // $ref issues

// ─── Main validation ────────────────────────────────────────────────────────
// Only UX-specific hints not covered by Spectral's OAS ruleset.
// Structural/spec-compliance rules are handled by Spectral in the extension host.

export function validateDocument(doc: OpenApiDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  validateOperationHints(doc, diagnostics);
  validateSchemaHints(doc, diagnostics);
  validateUnusedTags(doc, diagnostics);

  return diagnostics;
}

// ─── Operation hints ───────────────────────────────────────────────────────

function validateOperationHints(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.paths) return;

  const allMethods: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];

  for (const [pathKey, pathItem] of Object.entries(doc.paths)) {
    if (!pathItem) continue;

    for (const method of allMethods) {
      const op = pathItem[method];
      if (!op) continue;

      const opPath = `paths.${pathKey}.${method.toUpperCase()}`;

      // Request body on GET/DELETE/HEAD is unusual — Spectral doesn't check this
      if (op.requestBody && ['get', 'head', 'delete'].includes(method)) {
        out.push({
          severity: 'warning',
          path: `${opPath}.requestBody`,
          message: `${method.toUpperCase()} with a request body is unusual and may not be supported by all clients.`,
          category: 'operations',
        });
      }

      // Validate media type format in request body
      if (op.requestBody?.content) {
        validateMediaTypes(op.requestBody.content, `${opPath}.requestBody`, out);
      }

      // Validate response hints
      validateResponseContentHints(op.responses, opPath, out);
    }
  }
}

function validateResponseContentHints(
  responses: Record<string, unknown> | undefined,
  basePath: string,
  out: Diagnostic[]
): void {
  if (!responses) return;

  for (const [code, respObj] of Object.entries(responses)) {
    const respPath = `${basePath}.responses.${code}`;
    const resp = respObj as Record<string, unknown>;

    // 200/201 with no content body — suggest 204 or adding a schema
    if (['200', '201'].includes(code) && !resp.content) {
      out.push({
        severity: 'info',
        path: respPath,
        message: `Response ${code} has no content body. Consider adding a response schema, or use 204 for no-content responses.`,
        category: 'responses',
      });
    }

    // Validate media type format in responses
    if (resp.content && typeof resp.content === 'object') {
      validateMediaTypes(resp.content as Record<string, unknown>, respPath, out);
    }
  }
}

// ─── Media type format ─────────────────────────────────────────────────────

function validateMediaTypes(
  content: Record<string, unknown>,
  basePath: string,
  out: Diagnostic[]
): void {
  for (const mediaType of Object.keys(content)) {
    if (!/^[a-z]+\/[a-z0-9.+\-]+$/.test(mediaType)) {
      out.push({
        severity: 'warning',
        path: `${basePath}.content.${mediaType}`,
        message: `Media type "${mediaType}" does not look valid. Expected format like "application/json".`,
        category: 'schemas',
      });
    }
  }
}

// ─── Schema hints ──────────────────────────────────────────────────────────

function validateSchemaHints(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.components?.schemas) return;

  for (const [name, schema] of Object.entries(doc.components.schemas)) {
    checkSchemaHints(schema, `components.schemas.${name}`, out, 0);
  }
}

function checkSchemaHints(
  schema: OpenApiSchema,
  basePath: string,
  out: Diagnostic[],
  depth: number
): void {
  if (depth > 8 || schema.$ref) return;

  // Object with no properties and no composition — Spectral doesn't flag this
  if (schema.type === 'object' && (!schema.properties || Object.keys(schema.properties).length === 0) && !schema.allOf && !schema.oneOf && !schema.anyOf) {
    out.push({
      severity: 'info',
      path: basePath,
      message: 'Object schema has no properties defined.',
      category: 'schemas',
    });
  }

  // Non-standard format hint — Spectral doesn't validate format values
  if (schema.format && schema.type) {
    const standardFormats: Record<string, string[]> = {
      string: ['date', 'date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid', 'byte', 'binary', 'password'],
      integer: ['int32', 'int64'],
      number: ['float', 'double'],
    };
    const allowed = standardFormats[schema.type];
    if (allowed && !allowed.includes(schema.format)) {
      out.push({
        severity: 'info',
        path: `${basePath}.format`,
        message: `Format "${schema.format}" is not a standard format for type "${schema.type}". Standard formats: ${allowed.join(', ')}.`,
        category: 'schemas',
      });
    }
  }

  // Recurse
  if (schema.properties) {
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      checkSchemaHints(propSchema, `${basePath}.properties.${prop}`, out, depth + 1);
    }
  }
  if (schema.items) {
    checkSchemaHints(schema.items, `${basePath}.items`, out, depth + 1);
  }
  for (const keyword of ['allOf', 'oneOf', 'anyOf'] as const) {
    const arr = schema[keyword];
    if (Array.isArray(arr)) {
      arr.forEach((s, i) => checkSchemaHints(s as OpenApiSchema, `${basePath}.${keyword}[${i}]`, out, depth + 1));
    }
  }
}

// ─── Unused tags ───────────────────────────────────────────────────────────
// Spectral checks the reverse (tag used but not defined), but not this direction.

function validateUnusedTags(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.tags || !doc.paths) return;

  const usedTags = new Set<string>();
  for (const pathItem of Object.values(doc.paths)) {
    if (!pathItem) continue;
    for (const op of Object.values(pathItem)) {
      if (op && (op as OpenApiOperation).tags) {
        for (const t of (op as OpenApiOperation).tags!) usedTags.add(t);
      }
    }
  }

  for (const tag of doc.tags) {
    if (tag.name && !usedTags.has(tag.name)) {
      out.push({
        severity: 'info',
        path: `tags.${tag.name}`,
        message: `Tag "${tag.name}" is defined but not used by any operation.`,
        category: 'structure',
      });
    }
  }
}
