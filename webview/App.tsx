import React, { useState, useEffect, useCallback, useRef } from 'react';
import { vscode } from './main';
import { Sidebar } from './components/Sidebar';
import { InfoEditor } from './components/InfoEditor';
import { EndpointEditor } from './components/EndpointEditor';

// ─── Type definitions (mirrors yamlParser.ts on the Node side) ───────────────

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
  security?: Array<Record<string, string[]>>;
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    overflow: 'hidden',
  },
  errorBanner: {
    background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
    borderBottom: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
    color: 'var(--vscode-inputValidation-errorForeground, #f48771)',
    padding: '6px 12px',
    fontSize: '12px',
    maxHeight: '80px',
    overflowY: 'auto' as const,
  },
  warningBanner: {
    background: 'var(--vscode-inputValidation-warningBackground, #352a05)',
    borderBottom: '1px solid var(--vscode-inputValidation-warningBorder, #b89500)',
    color: 'var(--vscode-inputValidation-warningForeground, #cca700)',
    padding: '6px 12px',
    fontSize: '12px',
  },
  mainArea: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  scrollable: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
  },
  divider: {
    height: '1px',
    background: 'var(--vscode-widget-border, #444)',
    margin: '0 0 12px 0',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function App(): React.ReactElement {
  const [doc, setDoc] = useState<OpenApiDocument | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<HttpMethod | null>(null);

  // Use a ref to debounce outgoing edits so we don't flood the extension with
  // a postMessage on every keystroke.
  const pendingEdit = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Receive messages from extension ──────────────────────────────────────
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as { type: string; content?: unknown; errors?: string[] };

      switch (message.type) {
        case 'update': {
          const incoming = message.content as OpenApiDocument;
          setDoc(incoming);
          setErrors(message.errors ?? []);
          setFatalError(null);

          // If the currently-selected path/method no longer exists after a
          // file-change sync, reset the selection.
          if (selectedPath && !incoming.paths?.[selectedPath]) {
            setSelectedPath(null);
            setSelectedMethod(null);
          }
          break;
        }

        case 'error': {
          setFatalError(message.content as string);
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedPath]);

  // ── Send edited document back to extension (debounced 400 ms) ────────────
  const notifyExtension = useCallback((updated: OpenApiDocument) => {
    if (pendingEdit.current !== null) {
      clearTimeout(pendingEdit.current);
    }
    pendingEdit.current = setTimeout(() => {
      vscode.postMessage({ type: 'edit', content: updated });
      pendingEdit.current = null;
    }, 400);
  }, []);

  // ── Info block changes ────────────────────────────────────────────────────
  const handleInfoChange = useCallback(
    (newInfo: OpenApiInfo) => {
      if (!doc) { return; }
      const updated = { ...doc, info: newInfo };
      setDoc(updated);
      notifyExtension(updated);
    },
    [doc, notifyExtension]
  );

  // ── Endpoint selection ────────────────────────────────────────────────────
  const handleSelect = useCallback((pathKey: string, method: HttpMethod) => {
    setSelectedPath(pathKey);
    setSelectedMethod(method);
  }, []);

  // ── Add new endpoint ──────────────────────────────────────────────────────
  const handleAddEndpoint = useCallback(() => {
    if (!doc) { return; }
    const newPath = '/new-path';
    const uniquePath = getUniquePath(newPath, doc.paths ?? {});
    const newOperation: OpenApiOperation = {
      summary: 'New endpoint',
      description: '',
      operationId: 'newEndpoint',
      parameters: [],
      responses: {
        '200': { description: 'OK' },
      },
    };
    const updated: OpenApiDocument = {
      ...doc,
      paths: {
        ...(doc.paths ?? {}),
        [uniquePath]: { get: newOperation },
      },
    };
    setDoc(updated);
    notifyExtension(updated);
    setSelectedPath(uniquePath);
    setSelectedMethod('get');
  }, [doc, notifyExtension]);

  // ── Delete endpoint ───────────────────────────────────────────────────────
  const handleDeleteEndpoint = useCallback(
    (pathKey: string, method: HttpMethod) => {
      if (!doc) { return; }
      const pathItem = { ...(doc.paths?.[pathKey] ?? {}) };
      delete pathItem[method];

      let newPaths: OpenApiPaths;
      if (Object.keys(pathItem).length === 0) {
        newPaths = { ...(doc.paths ?? {}) };
        delete newPaths[pathKey];
      } else {
        newPaths = { ...(doc.paths ?? {}), [pathKey]: pathItem };
      }

      const updated = { ...doc, paths: newPaths };
      setDoc(updated);
      notifyExtension(updated);

      if (selectedPath === pathKey && selectedMethod === method) {
        setSelectedPath(null);
        setSelectedMethod(null);
      }
    },
    [doc, notifyExtension, selectedPath, selectedMethod]
  );

  // ── Operation changes ─────────────────────────────────────────────────────
  const handleOperationChange = useCallback(
    (pathKey: string, method: HttpMethod, operation: OpenApiOperation) => {
      if (!doc) { return; }
      const updated: OpenApiDocument = {
        ...doc,
        paths: {
          ...(doc.paths ?? {}),
          [pathKey]: {
            ...(doc.paths?.[pathKey] ?? {}),
            [method]: operation,
          },
        },
      };
      setDoc(updated);
      notifyExtension(updated);
    },
    [doc, notifyExtension]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (fatalError) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBanner}>
          <strong>Error:</strong> {fatalError}
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>Loading…</div>
      </div>
    );
  }

  const currentOperation =
    selectedPath && selectedMethod
      ? doc.paths?.[selectedPath]?.[selectedMethod] ?? null
      : null;

  return (
    <div style={styles.container}>
      {errors.length > 0 && (
        <div style={styles.warningBanner}>
          <strong>Validation warnings:</strong>{' '}
          {errors.join(' · ')}
        </div>
      )}

      <div style={styles.mainArea}>
        <Sidebar
          paths={doc.paths ?? {}}
          selectedPath={selectedPath}
          selectedMethod={selectedMethod}
          onSelect={handleSelect}
          onAdd={handleAddEndpoint}
          onDelete={handleDeleteEndpoint}
        />

        <div style={styles.rightPanel}>
          <div style={styles.scrollable}>
            <InfoEditor info={doc.info} onChange={handleInfoChange} />
            <div style={styles.divider} />

            {currentOperation && selectedPath && selectedMethod ? (
              <EndpointEditor
                path={selectedPath}
                method={selectedMethod}
                operation={currentOperation}
                onChange={(op) => handleOperationChange(selectedPath, selectedMethod, op)}
                availableSchemes={Object.keys(doc.components?.securitySchemes ?? {})}
                availableRefs={Object.keys(doc.components?.schemas ?? {}).map(k => `#/components/schemas/${k}`)}
              />
            ) : (
              <div style={styles.emptyState}>
                <div>
                  <p>Select an endpoint from the sidebar</p>
                  <p style={{ marginTop: 8, fontSize: '12px' }}>
                    or click <strong>+ Add Endpoint</strong> to create one
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUniquePath(base: string, existingPaths: OpenApiPaths): string {
  if (!(base in existingPaths)) { return base; }
  let counter = 1;
  while (`${base}-${counter}` in existingPaths) {
    counter++;
  }
  return `${base}-${counter}`;
}
