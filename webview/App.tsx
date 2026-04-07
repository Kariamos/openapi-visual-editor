import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { vscode } from './main';
import { Sidebar, type SortMode } from './components/Sidebar';
import { InfoEditor } from './components/InfoEditor';
import { EndpointEditor } from './components/EndpointEditor';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { validateDocument, type Diagnostic } from './utils/diagnostics';
import { HTTP_METHODS } from './utils/constants';

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
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  not?: OpenApiSchema;
  [key: string]: unknown;
}

export interface OpenApiExample {
  summary?: string;
  description?: string;
  value?: unknown;
  [key: string]: unknown;
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema;
  example?: unknown;
  examples?: Record<string, OpenApiExample>;
  [key: string]: unknown;
}

export interface OpenApiResponse {
  description: string;
  content?: Record<string, OpenApiMediaType>;
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
    content: Record<string, OpenApiMediaType>;
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
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<HttpMethod | null>(null);
  const [spectralDiagnostics, setSpectralDiagnostics] = useState<Diagnostic[]>([]);

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

        case 'diagnostics': {
          const incoming = (message as { type: string; diagnostics: Diagnostic[] }).diagnostics;
          setSpectralDiagnostics(incoming ?? []);
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

  // ── Path rename ───────────────────────────────────────────────────────────
  const handlePathChange = useCallback(
    (oldPath: string, newPath: string) => {
      if (!doc || oldPath === newPath) { return; }
      // Ensure new path starts with /
      const sanitized = newPath.startsWith('/') ? newPath : `/${newPath}`;
      if (sanitized === oldPath) { return; }
      // Avoid overwriting an existing path
      if (doc.paths?.[sanitized]) { return; }

      const oldPaths = doc.paths ?? {};
      const newPaths: OpenApiPaths = {};
      // Rebuild paths, replacing the old key with the new one (preserves order)
      for (const [key, value] of Object.entries(oldPaths)) {
        if (key === oldPath) {
          newPaths[sanitized] = value;
        } else {
          newPaths[key] = value;
        }
      }

      const updated = { ...doc, paths: newPaths };
      setDoc(updated);
      notifyExtension(updated);
      if (selectedPath === oldPath) {
        setSelectedPath(sanitized);
      }
    },
    [doc, notifyExtension, selectedPath]
  );

  // ── Method change ─────────────────────────────────────────────────────────
  const handleMethodChange = useCallback(
    (pathKey: string, oldMethod: HttpMethod, newMethod: HttpMethod) => {
      if (!doc || oldMethod === newMethod) { return; }
      const pathItem = doc.paths?.[pathKey];
      if (!pathItem) { return; }
      // Don't overwrite an existing method on this path
      if (pathItem[newMethod]) { return; }

      const operation = pathItem[oldMethod];
      if (!operation) { return; }

      // Rebuild the path item: remove old method, add new one
      const newPathItem = { ...pathItem };
      delete newPathItem[oldMethod];
      newPathItem[newMethod] = operation;

      const updated: OpenApiDocument = {
        ...doc,
        paths: { ...(doc.paths ?? {}), [pathKey]: newPathItem },
      };
      setDoc(updated);
      notifyExtension(updated);
      setSelectedMethod(newMethod);
    },
    [doc, notifyExtension]
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

  // ── Sort endpoints ────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (mode: SortMode) => {
      if (!doc || !doc.paths) return;

      const pathEntries = Object.entries(doc.paths);

      let sorted: typeof pathEntries;

      switch (mode) {
        case 'path-asc':
          sorted = [...pathEntries].sort((a, b) => a[0].localeCompare(b[0]));
          break;
        case 'path-desc':
          sorted = [...pathEntries].sort((a, b) => b[0].localeCompare(a[0]));
          break;
        case 'method': {
          // Sort by the first HTTP method found in each path item
          const methodOrder = (entry: typeof pathEntries[0]): number => {
            const pathItem = entry[1];
            if (!pathItem) return 99;
            for (let i = 0; i < HTTP_METHODS.length; i++) {
              if (pathItem[HTTP_METHODS[i]]) return i;
            }
            return 99;
          };
          sorted = [...pathEntries].sort((a, b) => {
            const diff = methodOrder(a) - methodOrder(b);
            return diff !== 0 ? diff : a[0].localeCompare(b[0]);
          });
          break;
        }
        case 'tag': {
          // Sort by the first tag of the first operation
          const firstTag = (entry: typeof pathEntries[0]): string => {
            const pathItem = entry[1];
            if (!pathItem) return '\uffff';
            for (const m of HTTP_METHODS) {
              const op = pathItem[m];
              if (op?.tags && op.tags.length > 0) return op.tags[0].toLowerCase();
            }
            return '\uffff';
          };
          sorted = [...pathEntries].sort((a, b) => {
            const diff = firstTag(a).localeCompare(firstTag(b));
            return diff !== 0 ? diff : a[0].localeCompare(b[0]);
          });
          break;
        }
        default:
          sorted = pathEntries;
      }

      const newPaths: OpenApiPaths = {};
      for (const [key, value] of sorted) {
        newPaths[key] = value;
      }

      const updated = { ...doc, paths: newPaths };
      setDoc(updated);
      notifyExtension(updated);
    },
    [doc, notifyExtension]
  );

  // ── Real-time diagnostics (must be before any early returns — hooks rule) ──
  const customDiagnostics = useMemo(() => {
    if (!doc) return [];
    return validateDocument(doc).map(d => ({ ...d, source: 'custom' as const }));
  }, [doc]);

  // Merge custom (instant) + Spectral (async) diagnostics
  const diagnostics = useMemo(() => {
    return [...customDiagnostics, ...spectralDiagnostics];
  }, [customDiagnostics, spectralDiagnostics]);

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
      {/* Main content area */}
      <div style={styles.mainArea}>
        <Sidebar
          paths={doc.paths ?? {}}
          selectedPath={selectedPath}
          selectedMethod={selectedMethod}
          onSelect={handleSelect}
          onAdd={handleAddEndpoint}
          onDelete={handleDeleteEndpoint}
          onSort={handleSort}
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
                onPathChange={(newPath) => handlePathChange(selectedPath, newPath)}
                onMethodChange={(m) => handleMethodChange(selectedPath, selectedMethod, m)}
                usedMethods={Object.keys(doc.paths?.[selectedPath] ?? {}) as HttpMethod[]}
                availableSchemes={Object.keys(doc.components?.securitySchemes ?? {})}
                availableRefs={Object.keys(doc.components?.schemas ?? {}).map(k => `#/components/schemas/${k}`)}
                components={doc.components?.schemas ?? {}}
                servers={doc.servers ?? []}
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

      {/* Diagnostics panel — bottom, like VS Code's Problems panel */}
      <DiagnosticsPanel diagnostics={diagnostics} />
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
