import * as yaml from 'js-yaml';

export interface OpenApiInfo {
  title: string;
  description?: string;
  version: string;
  [key: string]: unknown;
}

export interface OpenApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: OpenApiSchema;
  [key: string]: unknown;
}

export interface OpenApiSchema {
  type?: string;
  description?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  enum?: unknown[];
  format?: string;
  example?: unknown;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  title?: string;
  $ref?: string;
  [key: string]: unknown;
}

export interface OpenApiResponse {
  description: string;
  content?: Record<string, { schema?: OpenApiSchema }>;
  [key: string]: unknown;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content: Record<string, { schema?: OpenApiSchema }>;
  };
  responses: Record<string, OpenApiResponse>;
  [key: string]: unknown;
}

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace';

export type OpenApiPaths = Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;

export interface OpenApiDocument {
  openapi: string;
  info: OpenApiInfo;
  paths?: OpenApiPaths;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    [key: string]: unknown;
  };
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  [key: string]: unknown;
}

/**
 * Parses a YAML string into an OpenAPI document object.
 * Throws an error with line information if the YAML is invalid.
 * NOTE: js-yaml does not preserve YAML comments — comments will be lost
 * when the document is serialized back to YAML.
 */
export function parseOpenApi(yamlString: string): OpenApiDocument {
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlString, { schema: yaml.DEFAULT_SCHEMA });
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      const mark = err.mark;
      const lineInfo = mark ? ` (line ${mark.line + 1}, column ${mark.column + 1})` : '';
      throw new Error(`YAML parse error${lineInfo}: ${err.reason}`);
    }
    throw err;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('YAML content is not an object — not a valid OpenAPI document.');
  }

  return parsed as OpenApiDocument;
}

/**
 * Serializes an OpenAPI document object back to a YAML string.
 * Produces human-readable output with 2-space indentation.
 * NOTE: YAML comments are not preserved by js-yaml and will be absent
 * from the output even if the original file contained them.
 */
export function serializeOpenApi(obj: OpenApiDocument): string {
  return yaml.dump(obj, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
    // noCompatMode prevents YAML 1.1 tokens (yes/no/on/off) from being emitted
    // for booleans — we keep strict true/false.
    noCompatMode: true,
    schema: yaml.DEFAULT_SCHEMA,
  });
}

/**
 * Checks whether a parsed object looks like it could be an OpenAPI document
 * (has openapi or swagger field, or has paths/info). Used for auto-detection.
 */
export function looksLikeOpenApi(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }
  const doc = obj as Record<string, unknown>;
  return (
    typeof doc['openapi'] === 'string' ||
    typeof doc['swagger'] === 'string' ||
    ('paths' in doc && 'info' in doc)
  );
}
