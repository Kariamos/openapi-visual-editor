import type { OpenApiDocument, OpenApiOperation, OpenApiSchema, OpenApiParameter, HttpMethod } from '../App';

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

export function validateDocument(doc: OpenApiDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  validateRoot(doc, diagnostics);
  validateInfo(doc, diagnostics);
  validateServers(doc, diagnostics);
  validatePaths(doc, diagnostics);
  validateComponents(doc, diagnostics);
  validateTags(doc, diagnostics);
  validateSecuritySchemes(doc, diagnostics);

  return diagnostics;
}

// ─── Root ───────────────────────────────────────────────────────────────────

function validateRoot(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.openapi) {
    out.push({
      severity: 'error',
      path: 'openapi',
      message: 'Missing required field "openapi". Should be e.g. "3.0.3" or "3.1.0".',
      category: 'structure',
    });
  } else if (!/^3\.\d+\.\d+$/.test(doc.openapi)) {
    out.push({
      severity: 'error',
      path: 'openapi',
      message: `Invalid version "${doc.openapi}". Expected a valid OpenAPI 3.x version (e.g. "3.0.3").`,
      category: 'structure',
    });
  }

  if (!doc.paths || Object.keys(doc.paths).length === 0) {
    out.push({
      severity: 'warning',
      path: 'paths',
      message: 'No paths defined. Your API has no endpoints.',
      category: 'structure',
    });
  }
}

// ─── Info ───────────────────────────────────────────────────────────────────

function validateInfo(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.info) {
    out.push({ severity: 'error', path: 'info', message: 'Missing required "info" object.', category: 'structure' });
    return;
  }

  if (!doc.info.title || doc.info.title.trim() === '') {
    out.push({ severity: 'error', path: 'info.title', message: 'API title is required and cannot be empty.', category: 'structure' });
  }

  if (!doc.info.version || doc.info.version.trim() === '') {
    out.push({ severity: 'error', path: 'info.version', message: 'API version is required and cannot be empty.', category: 'structure' });
  }

  if (!doc.info.description || doc.info.description.trim() === '') {
    out.push({ severity: 'info', path: 'info.description', message: 'Consider adding an API description for better documentation.', category: 'structure' });
  }
}

// ─── Servers ────────────────────────────────────────────────────────────────

function validateServers(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.servers || doc.servers.length === 0) {
    out.push({ severity: 'info', path: 'servers', message: 'No servers defined. Consumers won\'t know the base URL.', category: 'structure' });
    return;
  }

  doc.servers.forEach((server, i) => {
    if (!server.url || server.url.trim() === '') {
      out.push({ severity: 'error', path: `servers[${i}].url`, message: 'Server URL is required.', category: 'structure' });
    } else {
      try {
        new URL(server.url.replace(/\{[^}]+\}/g, 'placeholder'));
      } catch {
        out.push({ severity: 'warning', path: `servers[${i}].url`, message: `Server URL "${server.url}" does not look like a valid URL.`, category: 'structure' });
      }
    }
  });
}

// ─── Paths & Operations ────────────────────────────────────────────────────

function validatePaths(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.paths) return;

  const allMethods: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
  const operationIds = new Map<string, string>(); // operationId → "METHOD /path"
  const definedSchemas = Object.keys(doc.components?.schemas ?? {});
  const definedSecuritySchemes = Object.keys(doc.components?.securitySchemes ?? {});

  for (const [pathKey, pathItem] of Object.entries(doc.paths)) {
    if (!pathItem) continue;

    // Path must start with /
    if (!pathKey.startsWith('/')) {
      out.push({ severity: 'error', path: `paths.${pathKey}`, message: `Path "${pathKey}" must start with "/".`, category: 'paths' });
    }

    // Extract path parameters from the URL template
    const pathParams = (pathKey.match(/\{([^}]+)\}/g) ?? []).map((p) => p.slice(1, -1));

    for (const method of allMethods) {
      const op = pathItem[method];
      if (!op) continue;

      const opPath = `paths.${pathKey}.${method.toUpperCase()}`;

      validateOperation(op, opPath, method, pathKey, pathParams, operationIds, definedSchemas, definedSecuritySchemes, doc, out);
    }
  }
}

function validateOperation(
  op: OpenApiOperation,
  opPath: string,
  method: HttpMethod,
  pathKey: string,
  pathParams: string[],
  operationIds: Map<string, string>,
  definedSchemas: string[],
  definedSecuritySchemes: string[],
  doc: OpenApiDocument,
  out: Diagnostic[]
): void {
  // Summary recommended
  if (!op.summary || op.summary.trim() === '') {
    out.push({ severity: 'info', path: opPath, message: 'Consider adding a summary for this endpoint.', category: 'operations' });
  }

  // OperationId checks
  if (!op.operationId || op.operationId.trim() === '') {
    out.push({ severity: 'warning', path: `${opPath}.operationId`, message: 'Missing operationId. Code generators will use auto-generated names.', category: 'operations' });
  } else {
    // Check uniqueness
    const existing = operationIds.get(op.operationId);
    if (existing) {
      out.push({
        severity: 'error',
        path: `${opPath}.operationId`,
        message: `Duplicate operationId "${op.operationId}" — already used by ${existing}.`,
        category: 'operations',
      });
    } else {
      operationIds.set(op.operationId, `${method.toUpperCase()} ${pathKey}`);
    }

    // Check format (should be camelCase identifier)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(op.operationId)) {
      out.push({
        severity: 'warning',
        path: `${opPath}.operationId`,
        message: `operationId "${op.operationId}" contains special characters. Use camelCase for best code generation compatibility.`,
        category: 'operations',
      });
    }
  }

  // Path parameters must be declared
  const declaredPathParams = (op.parameters ?? [])
    .filter((p) => p.in === 'path')
    .map((p) => p.name);

  for (const pp of pathParams) {
    if (!declaredPathParams.includes(pp)) {
      out.push({
        severity: 'error',
        path: `${opPath}.parameters`,
        message: `Path parameter "{${pp}}" in URL but not declared in parameters.`,
        category: 'parameters',
      });
    }
  }

  // Declared path parameters must be required
  for (const param of (op.parameters ?? [])) {
    if (param.in === 'path' && !param.required) {
      out.push({
        severity: 'error',
        path: `${opPath}.parameters.${param.name}`,
        message: `Path parameter "${param.name}" must have required: true.`,
        category: 'parameters',
      });
    }
  }

  // Validate parameters
  validateParameters(op.parameters ?? [], opPath, out);

  // Responses
  validateResponses(op.responses, opPath, definedSchemas, out);

  // Request body on GET/DELETE/HEAD is unusual
  if (op.requestBody && ['get', 'head', 'delete'].includes(method)) {
    out.push({
      severity: 'warning',
      path: `${opPath}.requestBody`,
      message: `${method.toUpperCase()} with a request body is unusual and may not be supported by all clients.`,
      category: 'operations',
    });
  }

  // Request body validation
  if (op.requestBody?.content) {
    validateContentMap(op.requestBody.content, `${opPath}.requestBody`, definedSchemas, out);

    // Validate examples in request body
    for (const [mediaType, mediaObj] of Object.entries(op.requestBody.content)) {
      if (mediaObj.examples) {
        validateExamples(mediaObj.examples, mediaObj.schema, `${opPath}.requestBody.${mediaType}`, out);
      }
    }
  }

  // Tags reference check
  const docTags = (doc.tags ?? []).map((t) => t.name);
  for (const tag of op.tags ?? []) {
    if (docTags.length > 0 && !docTags.includes(tag)) {
      out.push({
        severity: 'warning',
        path: `${opPath}.tags`,
        message: `Tag "${tag}" is used but not defined in the top-level "tags" array.`,
        category: 'operations',
      });
    }
  }

  // Security scheme references
  for (const secReq of op.security ?? []) {
    for (const scheme of Object.keys(secReq)) {
      if (!definedSecuritySchemes.includes(scheme)) {
        out.push({
          severity: 'error',
          path: `${opPath}.security`,
          message: `Security scheme "${scheme}" is referenced but not defined in components.securitySchemes.`,
          category: 'security',
        });
      }
    }
  }
}

// ─── Parameters ─────────────────────────────────────────────────────────────

function validateParameters(params: OpenApiParameter[], basePath: string, out: Diagnostic[]): void {
  const seen = new Map<string, number>(); // "in:name" → count

  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const paramPath = `${basePath}.parameters[${i}]`;

    // Name required
    if (!param.name || param.name.trim() === '') {
      out.push({ severity: 'error', path: paramPath, message: 'Parameter name is required.', category: 'parameters' });
    }

    // Schema recommended
    if (!param.schema) {
      out.push({ severity: 'warning', path: `${paramPath}.schema`, message: `Parameter "${param.name}" has no schema defined.`, category: 'parameters' });
    }

    // Duplicate check (same name + same location)
    const key = `${param.in}:${param.name}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) {
      out.push({
        severity: 'error',
        path: paramPath,
        message: `Duplicate parameter "${param.name}" in "${param.in}". Each name+location combination must be unique.`,
        category: 'parameters',
      });
    }
  }
}

// ─── Responses ──────────────────────────────────────────────────────────────

function validateResponses(
  responses: Record<string, unknown> | undefined,
  basePath: string,
  definedSchemas: string[],
  out: Diagnostic[]
): void {
  if (!responses || Object.keys(responses).length === 0) {
    out.push({ severity: 'error', path: `${basePath}.responses`, message: 'At least one response is required.', category: 'responses' });
    return;
  }

  for (const [code, respObj] of Object.entries(responses)) {
    const respPath = `${basePath}.responses.${code}`;
    const resp = respObj as Record<string, unknown>;

    // Status code format
    if (!/^[1-5]\d{2}$/.test(code) && code !== 'default') {
      out.push({ severity: 'warning', path: respPath, message: `Response code "${code}" is not a standard HTTP status code.`, category: 'responses' });
    }

    // Description required
    if (!resp.description || (typeof resp.description === 'string' && resp.description.trim() === '')) {
      out.push({ severity: 'warning', path: `${respPath}.description`, message: `Response ${code} has an empty description.`, category: 'responses' });
    }

    // Validate content map if present
    if (resp.content && typeof resp.content === 'object') {
      validateContentMap(resp.content as Record<string, Record<string, unknown>>, respPath, definedSchemas, out);

      // Validate examples in response
      for (const [mediaType, mediaObj] of Object.entries(resp.content as Record<string, Record<string, unknown>>)) {
        if (mediaObj.examples && typeof mediaObj.examples === 'object') {
          validateExamples(
            mediaObj.examples as Record<string, { summary?: string; value?: unknown }>,
            mediaObj.schema as OpenApiSchema | undefined,
            `${respPath}.${mediaType}`,
            out
          );
        }
      }
    }

    // 2xx success with no content body — might be intentional (204) but warn for 200/201
    if (['200', '201'].includes(code) && !resp.content) {
      out.push({
        severity: 'info',
        path: respPath,
        message: `Response ${code} has no content body. Consider adding a response schema, or use 204 for no-content responses.`,
        category: 'responses',
      });
    }
  }
}

// ─── Content map (shared by requestBody and responses) ──────────────────────

function validateContentMap(
  content: Record<string, Record<string, unknown>>,
  basePath: string,
  definedSchemas: string[],
  out: Diagnostic[]
): void {
  for (const [mediaType, mediaObj] of Object.entries(content)) {
    const mtPath = `${basePath}.content.${mediaType}`;

    // Check media type format
    if (!/^[a-z]+\/[a-z0-9.+\-]+$/.test(mediaType)) {
      out.push({
        severity: 'warning',
        path: mtPath,
        message: `Media type "${mediaType}" does not look valid. Expected format like "application/json".`,
        category: 'schemas',
      });
    }

    // Schema should exist
    if (!mediaObj.schema) {
      out.push({ severity: 'warning', path: `${mtPath}.schema`, message: 'No schema defined for this content type.', category: 'schemas' });
    } else {
      validateSchema(mediaObj.schema as OpenApiSchema, `${mtPath}.schema`, definedSchemas, out, 0);
    }
  }
}

// ─── Schema validation (recursive) ─────────────────────────────────────────

function validateSchema(
  schema: OpenApiSchema,
  basePath: string,
  definedSchemas: string[],
  out: Diagnostic[],
  depth: number
): void {
  if (depth > 8) return; // Prevent infinite recursion

  // $ref validation
  if (schema.$ref) {
    const refMatch = schema.$ref.match(/^#\/components\/schemas\/(.+)$/);
    if (refMatch) {
      if (!definedSchemas.includes(refMatch[1])) {
        out.push({
          severity: 'error',
          path: basePath,
          message: `$ref "${schema.$ref}" points to undefined schema "${refMatch[1]}".`,
          category: 'references',
        });
      }
    } else if (!schema.$ref.startsWith('#/')) {
      out.push({
        severity: 'info',
        path: basePath,
        message: `External $ref "${schema.$ref}" — cannot be validated locally.`,
        category: 'references',
      });
    }
    return; // $ref overrides other schema properties
  }

  // Type check
  const validTypes = ['string', 'integer', 'number', 'boolean', 'object', 'array'];
  if (schema.type && !validTypes.includes(schema.type)) {
    out.push({
      severity: 'error',
      path: `${basePath}.type`,
      message: `Invalid schema type "${schema.type}". Must be one of: ${validTypes.join(', ')}.`,
      category: 'schemas',
    });
  }

  // Array must have items
  if (schema.type === 'array' && !schema.items) {
    out.push({
      severity: 'error',
      path: `${basePath}.items`,
      message: 'Array schema must define "items".',
      category: 'schemas',
    });
  }

  // Object with properties — check required fields match
  if (schema.type === 'object' && schema.properties && schema.required) {
    for (const reqField of schema.required) {
      if (!schema.properties[reqField]) {
        out.push({
          severity: 'error',
          path: `${basePath}.required`,
          message: `Required field "${reqField}" is not defined in properties.`,
          category: 'schemas',
        });
      }
    }
  }

  // Object with no properties
  if (schema.type === 'object' && (!schema.properties || Object.keys(schema.properties).length === 0) && !schema.allOf && !schema.oneOf && !schema.anyOf) {
    out.push({
      severity: 'info',
      path: basePath,
      message: 'Object schema has no properties defined.',
      category: 'schemas',
    });
  }

  // Enum validation
  if (schema.enum) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      out.push({ severity: 'warning', path: `${basePath}.enum`, message: 'Enum is empty.', category: 'schemas' });
    }
    if (schema.enum && new Set(schema.enum.map((v) => JSON.stringify(v))).size !== schema.enum.length) {
      out.push({ severity: 'warning', path: `${basePath}.enum`, message: 'Enum contains duplicate values.', category: 'schemas' });
    }
  }

  // Format validation
  if (schema.format && schema.type) {
    const validFormats: Record<string, string[]> = {
      string: ['date', 'date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid', 'byte', 'binary', 'password'],
      integer: ['int32', 'int64'],
      number: ['float', 'double'],
    };
    const allowedFormats = validFormats[schema.type];
    if (allowedFormats && !allowedFormats.includes(schema.format)) {
      out.push({
        severity: 'info',
        path: `${basePath}.format`,
        message: `Format "${schema.format}" is not a standard format for type "${schema.type}". Standard formats: ${allowedFormats.join(', ')}.`,
        category: 'schemas',
      });
    }
  }

  // Recurse into nested schemas
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      validateSchema(propSchema, `${basePath}.properties.${propName}`, definedSchemas, out, depth + 1);
    }
  }
  if (schema.items) {
    validateSchema(schema.items, `${basePath}.items`, definedSchemas, out, depth + 1);
  }
  for (const keyword of ['allOf', 'oneOf', 'anyOf'] as const) {
    const arr = schema[keyword];
    if (Array.isArray(arr)) {
      if (arr.length === 0) {
        out.push({ severity: 'warning', path: `${basePath}.${keyword}`, message: `${keyword} is empty.`, category: 'schemas' });
      }
      arr.forEach((s, i) => validateSchema(s as OpenApiSchema, `${basePath}.${keyword}[${i}]`, definedSchemas, out, depth + 1));
    }
  }
}

// ─── Examples ───────────────────────────────────────────────────────────────

function validateExamples(
  examples: Record<string, { summary?: string; value?: unknown; [key: string]: unknown }>,
  schema: OpenApiSchema | undefined,
  basePath: string,
  out: Diagnostic[]
): void {
  for (const [name, example] of Object.entries(examples)) {
    const exPath = `${basePath}.examples.${name}`;

    // Example must have a value
    if (example.value === undefined || example.value === null) {
      out.push({
        severity: 'warning',
        path: exPath,
        message: `Example "${name}" has no value defined.`,
        category: 'examples',
      });
      continue;
    }

    // Type mismatch between example and schema
    if (schema && !schema.$ref) {
      validateExampleAgainstSchema(example.value, schema, exPath, name, out);
    }
  }
}

function validateExampleAgainstSchema(
  value: unknown,
  schema: OpenApiSchema,
  basePath: string,
  exampleName: string,
  out: Diagnostic[]
): void {
  if (!schema.type) return;

  const actualType = getJsonType(value);

  const typeMap: Record<string, string[]> = {
    string: ['string'],
    integer: ['number'],
    number: ['number'],
    boolean: ['boolean'],
    object: ['object'],
    array: ['array'],
  };

  const expectedTypes = typeMap[schema.type];
  if (expectedTypes && !expectedTypes.includes(actualType)) {
    out.push({
      severity: 'error',
      path: basePath,
      message: `Example "${exampleName}" has type "${actualType}" but schema expects "${schema.type}".`,
      category: 'examples',
    });
    return;
  }

  // Check required properties in example objects
  if (schema.type === 'object' && schema.required && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const objValue = value as Record<string, unknown>;
    for (const reqField of schema.required) {
      if (!(reqField in objValue)) {
        out.push({
          severity: 'warning',
          path: basePath,
          message: `Example "${exampleName}" is missing required property "${reqField}".`,
          category: 'examples',
        });
      }
    }
  }
}

function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// ─── Components ─────────────────────────────────────────────────────────────

function validateComponents(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.components?.schemas) return;

  const definedSchemas = Object.keys(doc.components.schemas);

  for (const [name, schema] of Object.entries(doc.components.schemas)) {
    validateSchema(schema, `components.schemas.${name}`, definedSchemas, out, 0);
  }

  // Check for unused schemas
  const usedRefs = collectAllRefs(doc);
  for (const name of definedSchemas) {
    const refStr = `#/components/schemas/${name}`;
    if (!usedRefs.has(refStr)) {
      out.push({
        severity: 'info',
        path: `components.schemas.${name}`,
        message: `Schema "${name}" is defined but never referenced.`,
        category: 'schemas',
      });
    }
  }
}

function collectAllRefs(obj: unknown, refs: Set<string> = new Set()): Set<string> {
  if (typeof obj !== 'object' || obj === null) return refs;
  if (Array.isArray(obj)) {
    for (const item of obj) collectAllRefs(item, refs);
    return refs;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record['$ref'] === 'string') {
    refs.add(record['$ref']);
  }
  for (const value of Object.values(record)) {
    collectAllRefs(value, refs);
  }
  return refs;
}

// ─── Tags ───────────────────────────────────────────────────────────────────

function validateTags(doc: OpenApiDocument, out: Diagnostic[]): void {
  if (!doc.tags) return;

  const seen = new Set<string>();
  for (const tag of doc.tags) {
    if (!tag.name || tag.name.trim() === '') {
      out.push({ severity: 'error', path: 'tags', message: 'Tag with empty name found.', category: 'structure' });
    } else if (seen.has(tag.name)) {
      out.push({ severity: 'warning', path: `tags.${tag.name}`, message: `Duplicate tag "${tag.name}".`, category: 'structure' });
    } else {
      seen.add(tag.name);
    }

    if (!tag.description || tag.description.trim() === '') {
      out.push({ severity: 'info', path: `tags.${tag.name}`, message: `Tag "${tag.name}" has no description.`, category: 'structure' });
    }
  }

  // Check for tags defined but never used in any operation
  if (doc.paths) {
    const usedTags = new Set<string>();
    for (const pathItem of Object.values(doc.paths)) {
      if (!pathItem) continue;
      for (const op of Object.values(pathItem)) {
        if (op && op.tags) {
          for (const t of op.tags) usedTags.add(t);
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
}

// ─── Security Schemes ───────────────────────────────────────────────────────

function validateSecuritySchemes(doc: OpenApiDocument, out: Diagnostic[]): void {
  const secSchemes = doc.components?.securitySchemes as Record<string, Record<string, unknown>> | undefined;
  if (!secSchemes) return;

  for (const [name, scheme] of Object.entries(secSchemes)) {
    const sPath = `components.securitySchemes.${name}`;

    if (!scheme.type) {
      out.push({ severity: 'error', path: sPath, message: `Security scheme "${name}" is missing required "type" field.`, category: 'security' });
    } else {
      const validTypes = ['apiKey', 'http', 'oauth2', 'openIdConnect'];
      if (!validTypes.includes(scheme.type as string)) {
        out.push({
          severity: 'error',
          path: `${sPath}.type`,
          message: `Invalid security scheme type "${scheme.type}". Must be one of: ${validTypes.join(', ')}.`,
          category: 'security',
        });
      }

      if (scheme.type === 'apiKey') {
        if (!scheme.name) out.push({ severity: 'error', path: sPath, message: `apiKey scheme "${name}" requires a "name" field.`, category: 'security' });
        if (!scheme.in) out.push({ severity: 'error', path: sPath, message: `apiKey scheme "${name}" requires an "in" field (query, header, or cookie).`, category: 'security' });
      }

      if (scheme.type === 'http' && !scheme.scheme) {
        out.push({ severity: 'error', path: sPath, message: `HTTP scheme "${name}" requires a "scheme" field (e.g. "bearer").`, category: 'security' });
      }
    }
  }
}
