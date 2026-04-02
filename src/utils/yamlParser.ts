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

export interface ValidationError {
  path: string;
  message: string;
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
    schema: yaml.DEFAULT_SCHEMA,
  });
}

/**
 * Performs basic structural validation on a parsed OpenAPI document.
 * Returns an array of human-readable error strings. An empty array means
 * the document passed all checks.
 */
export function validateOpenApi(obj: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    errors.push({ path: '(root)', message: 'Document must be an object.' });
    return errors;
  }

  const doc = obj as Record<string, unknown>;

  // openapi field
  if (!('openapi' in doc)) {
    errors.push({ path: 'openapi', message: 'Missing required field "openapi".' });
  } else if (typeof doc['openapi'] !== 'string') {
    errors.push({ path: 'openapi', message: '"openapi" must be a string (e.g. "3.0.3").' });
  } else if (!/^3\.\d+\.\d+$/.test(doc['openapi'] as string)) {
    errors.push({
      path: 'openapi',
      message: `"openapi" value "${doc['openapi']}" does not look like an OpenAPI 3.x version string.`,
    });
  }

  // info block
  if (!('info' in doc)) {
    errors.push({ path: 'info', message: 'Missing required field "info".' });
  } else {
    const info = doc['info'] as Record<string, unknown>;
    if (typeof info !== 'object' || info === null) {
      errors.push({ path: 'info', message: '"info" must be an object.' });
    } else {
      if (!info['title'] || typeof info['title'] !== 'string') {
        errors.push({ path: 'info.title', message: '"info.title" is required and must be a non-empty string.' });
      }
      if (!info['version'] || typeof info['version'] !== 'string') {
        errors.push({ path: 'info.version', message: '"info.version" is required and must be a non-empty string.' });
      }
    }
  }

  // paths block (optional but must be object if present)
  if ('paths' in doc && doc['paths'] !== null) {
    if (typeof doc['paths'] !== 'object' || Array.isArray(doc['paths'])) {
      errors.push({ path: 'paths', message: '"paths" must be an object.' });
    } else {
      const paths = doc['paths'] as Record<string, unknown>;
      const validMethods: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];

      for (const [pathKey, pathItem] of Object.entries(paths)) {
        if (!pathKey.startsWith('/')) {
          errors.push({ path: `paths.${pathKey}`, message: `Path "${pathKey}" must start with "/".` });
        }
        if (typeof pathItem !== 'object' || pathItem === null) {
          errors.push({ path: `paths.${pathKey}`, message: `Path item for "${pathKey}" must be an object.` });
          continue;
        }
        const pathObj = pathItem as Record<string, unknown>;
        for (const method of validMethods) {
          if (method in pathObj) {
            const op = pathObj[method] as Record<string, unknown>;
            if (typeof op !== 'object' || op === null) {
              errors.push({ path: `paths.${pathKey}.${method}`, message: 'Operation must be an object.' });
              continue;
            }
            if (!('responses' in op)) {
              errors.push({
                path: `paths.${pathKey}.${method}.responses`,
                message: `Operation ${method.toUpperCase()} ${pathKey} is missing "responses".`,
              });
            }
          }
        }
      }
    }
  }

  return errors;
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
