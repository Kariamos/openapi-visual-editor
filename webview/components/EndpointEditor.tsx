import React, { useCallback, useState } from 'react';
import type { OpenApiOperation, OpenApiParameter, OpenApiResponse, OpenApiSchema, HttpMethod } from '../App';
import { ContentBodyEditor } from './SchemaEditor';
import { ExamplesEditor } from './ExamplesEditor';
import { METHOD_COLORS } from '../utils/constants';

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  container: {
    fontSize: '13px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  methodBadge: {
    fontWeight: 700,
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    padding: '4px 10px',
    borderRadius: 4,
    color: '#fff',
  },
  pathText: {
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    color: 'var(--vscode-editor-foreground, #ccc)',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--vscode-sideBarTitle-foreground, #bbb)',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldGroup: {
    marginBottom: 10,
  },
  label: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    marginBottom: 3,
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '5px 8px',
    fontSize: '13px',
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: 3,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '5px 8px',
    fontSize: '13px',
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: 3,
    outline: 'none',
    minHeight: 50,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '5px 8px',
    fontSize: '13px',
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: 3,
    outline: 'none',
  },
  row: {
    display: 'flex',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  addBtn: {
    background: 'transparent',
    color: 'var(--vscode-textLink-foreground, #3794ff)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    padding: 0,
  },
  removeBtn: {
    background: 'transparent',
    color: 'var(--vscode-errorForeground, #f48771)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 6px',
    borderRadius: 3,
  },
  card: {
    background: 'var(--vscode-editor-background, #1e1e1e)',
    border: '1px solid var(--vscode-widget-border, #444)',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tag: {
    display: 'inline-block',
    background: 'var(--vscode-badge-background, #4d4d4d)',
    color: 'var(--vscode-badge-foreground, #ccc)',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: '11px',
    marginRight: 4,
    marginBottom: 4,
  },
  checkbox: {
    marginRight: 6,
    accentColor: 'var(--vscode-checkbox-background, #007fd4)',
  },
  collapsible: {
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface EndpointEditorProps {
  path: string;
  method: HttpMethod;
  operation: OpenApiOperation;
  onChange: (operation: OpenApiOperation) => void;
  onPathChange?: (newPath: string) => void;
  availableSchemes?: string[];
  availableRefs?: string[];
  components?: Record<string, OpenApiSchema>;
  servers?: Array<{ url: string; description?: string }>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EndpointEditor({
  path,
  method,
  operation,
  onChange,
  onPathChange,
  availableSchemes = [],
  availableRefs = [],
  components = {},
  servers = [],
}: EndpointEditorProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState('general');
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState(path);

  const updateField = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...operation, [field]: value });
    },
    [operation, onChange]
  );

  // ── Parameters ──────────────────────────────────────────────────────────

  const addParameter = useCallback(() => {
    const params = [...(operation.parameters ?? [])];
    params.push({ name: '', in: 'query', description: '' });
    updateField('parameters', params);
  }, [operation.parameters, updateField]);

  const updateParameter = useCallback(
    (index: number, field: string, value: unknown) => {
      const params = [...(operation.parameters ?? [])];
      params[index] = { ...params[index], [field]: value };
      onChange({ ...operation, parameters: params });
    },
    [operation, onChange]
  );

  const removeParameter = useCallback(
    (index: number) => {
      const params = [...(operation.parameters ?? [])];
      params.splice(index, 1);
      updateField('parameters', params);
    },
    [operation.parameters, updateField]
  );

  // ── Request Body ─────────────────────────────────────────────────────────

  const addRequestBody = useCallback(() => {
    onChange({
      ...operation,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', properties: {} } } },
      },
    });
    setActiveTab('requestBody');
  }, [operation, onChange]);

  const removeRequestBody = useCallback(() => {
    const updated = { ...operation };
    delete updated.requestBody;
    onChange(updated);
  }, [operation, onChange]);

  // ── Responses ───────────────────────────────────────────────────────────

  const addResponse = useCallback(() => {
    const responses = { ...(operation.responses ?? {}) };
    // Find an unused status code
    let code = '200';
    const codes = ['200', '201', '204', '400', '401', '403', '404', '500'];
    for (const c of codes) {
      if (!(c in responses)) {
        code = c;
        break;
      }
    }
    responses[code] = { description: '' };
    updateField('responses', responses);
  }, [operation.responses, updateField]);

  const updateResponse = useCallback(
    (code: string, response: OpenApiResponse) => {
      const responses = { ...(operation.responses ?? {}) };
      responses[code] = response;
      onChange({ ...operation, responses });
    },
    [operation, onChange]
  );

  const removeResponse = useCallback(
    (code: string) => {
      const responses = { ...(operation.responses ?? {}) };
      delete responses[code];
      updateField('responses', responses);
    },
    [operation.responses, updateField]
  );

  // ── Security ─────────────────────────────────────────────────────────────

  const activeSchemes = (operation.security ?? []).map((s) => Object.keys(s)[0]).filter(Boolean);

  const toggleScheme = useCallback(
    (scheme: string, enabled: boolean) => {
      const current = operation.security ?? [];
      let updated: Array<Record<string, string[]>>;
      if (enabled) {
        updated = [...current, { [scheme]: [] }];
      } else {
        updated = current.filter((s) => Object.keys(s)[0] !== scheme);
      }
      onChange({ ...operation, security: updated.length > 0 ? updated : undefined });
    },
    [operation, onChange]
  );

  // ── Tags ────────────────────────────────────────────────────────────────

  const handleTagsChange = useCallback(
    (tagsStr: string) => {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      updateField('tags', tags.length > 0 ? tags : undefined);
    },
    [updateField]
  );

  // ── Render ──────────────────────────────────────────────────────────────

  const showRequestBodyTab =
    operation.requestBody !== undefined || ['post', 'put', 'patch'].includes(method);

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'parameters', label: 'Parameters', count: operation.parameters?.length ?? 0 },
    ...(showRequestBodyTab ? [{ id: 'requestBody', label: 'Request Body' }] : []),
    { id: 'responses', label: 'Responses', count: Object.keys(operation.responses ?? {}).length },
    { id: 'examples', label: 'Examples' },
    ...(availableSchemes.length > 0 ? [{ id: 'security', label: 'Security' }] : []),
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ ...styles.methodBadge, background: METHOD_COLORS[method] ?? '#666' }}>
          {method}
        </span>
        {editingPath ? (
          <input
            autoFocus
            style={{
              ...styles.pathText,
              background: 'var(--vscode-input-background, #3c3c3c)',
              border: '1px solid var(--vscode-focusBorder, #007fd4)',
              borderRadius: 3,
              padding: '2px 6px',
              outline: 'none',
              flex: 1,
            }}
            value={pathDraft}
            onChange={(e) => setPathDraft(e.target.value)}
            onBlur={() => {
              setEditingPath(false);
              if (pathDraft && pathDraft !== path) {
                onPathChange?.(pathDraft);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingPath(false);
                if (pathDraft && pathDraft !== path) {
                  onPathChange?.(pathDraft);
                }
              } else if (e.key === 'Escape') {
                setEditingPath(false);
                setPathDraft(path);
              }
            }}
          />
        ) : (
          <span
            style={{ ...styles.pathText, cursor: 'pointer' }}
            onClick={() => { setPathDraft(path); setEditingPath(true); }}
            title="Click to edit path"
          >
            {path}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-widget-border, #444)', marginBottom: 16 }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--vscode-textLink-foreground, #3794ff)'
                  : '2px solid transparent',
                color: isActive
                  ? 'var(--vscode-textLink-foreground, #3794ff)'
                  : 'var(--vscode-foreground, #ccc)',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginBottom: -1,
                whiteSpace: 'nowrap' as const,
              }}
            >
              {tab.label}
              {'count' in tab && (tab.count ?? 0) > 0 && (
                <span style={{
                  background: 'var(--vscode-badge-background, #4d4d4d)',
                  color: 'var(--vscode-badge-foreground, #ccc)',
                  borderRadius: 8,
                  padding: '1px 5px',
                  fontSize: '10px',
                  fontWeight: 600,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── General ── */}
      {activeTab === 'general' && (
        <div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Summary</label>
            <input
              style={styles.input}
              type="text"
              value={operation.summary ?? ''}
              onChange={(e) => updateField('summary', e.target.value)}
              placeholder="Brief summary of the endpoint"
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              style={styles.textarea}
              value={operation.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Detailed description..."
            />
          </div>
          <div style={styles.row}>
            <div style={styles.col}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Operation ID</label>
                <input
                  style={styles.input}
                  type="text"
                  value={operation.operationId ?? ''}
                  onChange={(e) => updateField('operationId', e.target.value)}
                  placeholder="getUsers"
                />
              </div>
            </div>
            <div style={styles.col}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tags (comma-separated)</label>
                <input
                  style={styles.input}
                  type="text"
                  value={(operation.tags ?? []).join(', ')}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  placeholder="users, admin"
                />
              </div>
            </div>
          </div>
          {operation.tags && operation.tags.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {operation.tags.map((tag) => (
                <span key={tag} style={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Parameters ── */}
      {activeTab === 'parameters' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button style={styles.addBtn} onClick={addParameter}>+ Add Parameter</button>
          </div>
          {(operation.parameters ?? []).length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground, #9d9d9d)', textAlign: 'center', padding: '24px 0' }}>
              No parameters. Click "+ Add Parameter" to create one.
            </div>
          )}
          {(operation.parameters ?? []).map((param, idx) => (
            <ParameterCard
              key={idx}
              param={param}
              index={idx}
              onUpdate={updateParameter}
              onRemove={removeParameter}
            />
          ))}
        </div>
      )}

      {/* ── Request Body ── */}
      {activeTab === 'requestBody' && showRequestBodyTab && (
        <div>
          {operation.requestBody ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ ...styles.label, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={operation.requestBody.required ?? false}
                    onChange={e => updateField('requestBody', { ...operation.requestBody, required: e.target.checked })}
                    style={styles.checkbox}
                  />
                  Required
                </label>
                <button style={styles.removeBtn} onClick={removeRequestBody}>Remove body</button>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Description</label>
                <input
                  style={styles.input}
                  value={operation.requestBody.description ?? ''}
                  onChange={e => updateField('requestBody', { ...operation.requestBody!, description: e.target.value || undefined })}
                  placeholder="Describe the request body…"
                />
              </div>
              <ContentBodyEditor
                content={operation.requestBody.content ?? {}}
                onChange={content => updateField('requestBody', { ...operation.requestBody!, content })}
                availableRefs={availableRefs}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground, #9d9d9d)', marginBottom: 12 }}>
                No request body defined.
              </div>
              <button style={{ ...styles.addBtn, fontSize: '13px' }} onClick={addRequestBody}>
                + Add Request Body
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Responses ── */}
      {activeTab === 'responses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button style={styles.addBtn} onClick={addResponse}>+ Add Response</button>
          </div>
          {Object.keys(operation.responses ?? {}).length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground, #9d9d9d)', textAlign: 'center', padding: '24px 0' }}>
              No responses defined. Click "+ Add Response" to create one.
            </div>
          )}
          {Object.entries(operation.responses ?? {}).map(([code, response]) => (
            <ResponseCard
              key={code}
              code={code}
              response={response}
              onChange={updateResponse}
              onRemove={removeResponse}
              availableRefs={availableRefs}
            />
          ))}
        </div>
      )}

      {/* ── Examples ── */}
      {activeTab === 'examples' && (
        <ExamplesEditor
          operation={operation}
          onChange={onChange}
          method={method}
          path={path}
          servers={servers}
          components={components}
        />
      )}

      {/* ── Security ── */}
      {activeTab === 'security' && availableSchemes.length > 0 && (
        <div style={styles.card}>
          {availableSchemes.map((scheme) => (
            <label
              key={scheme}
              style={{ ...styles.label, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginBottom: 8 }}
            >
              <input
                type="checkbox"
                checked={activeSchemes.includes(scheme)}
                onChange={(e) => toggleScheme(scheme, e.target.checked)}
                style={styles.checkbox}
              />
              {scheme}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Parameter Card ─────────────────────────────────────────────────────────

function ParameterCard({
  param,
  index,
  onUpdate,
  onRemove,
}: {
  param: OpenApiParameter;
  index: number;
  onUpdate: (index: number, field: string, value: unknown) => void;
  onRemove: (index: number) => void;
}): React.ReactElement {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>
          Parameter #{index + 1}
        </span>
        <button style={styles.removeBtn} onClick={() => onRemove(index)}>
          Remove
        </button>
      </div>

      <div style={styles.row}>
        <div style={styles.col}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Name</label>
            <input
              style={styles.input}
              type="text"
              value={param.name}
              onChange={(e) => onUpdate(index, 'name', e.target.value)}
              placeholder="paramName"
            />
          </div>
        </div>
        <div style={{ ...styles.col, maxWidth: 130 }}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Location</label>
            <select
              style={{ ...styles.select, width: '100%' }}
              value={param.in}
              onChange={(e) => onUpdate(index, 'in', e.target.value)}
            >
              <option value="query">query</option>
              <option value="path">path</option>
              <option value="header">header</option>
              <option value="cookie">cookie</option>
            </select>
          </div>
        </div>
        <div style={{ ...styles.col, maxWidth: 100 }}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Type</label>
            <select
              style={{ ...styles.select, width: '100%' }}
              value={param.schema?.type ?? 'string'}
              onChange={(e) => onUpdate(index, 'schema', { ...param.schema, type: e.target.value })}
            >
              <option value="string">string</option>
              <option value="integer">integer</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="array">array</option>
            </select>
          </div>
        </div>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Description</label>
        <input
          style={styles.input}
          type="text"
          value={param.description ?? ''}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder="Parameter description"
        />
      </div>

      <div>
        <label style={{ ...styles.label, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={param.required ?? false}
            onChange={(e) => onUpdate(index, 'required', e.target.checked)}
            style={styles.checkbox}
          />
          Required
        </label>
      </div>
    </div>
  );
}

// ─── Response Card ──────────────────────────────────────────────────────────

function ResponseCard({
  code,
  response,
  onChange,
  onRemove,
  availableRefs,
}: {
  code: string;
  response: OpenApiResponse;
  onChange: (code: string, response: OpenApiResponse) => void;
  onRemove: (code: string) => void;
  availableRefs: string[];
}): React.ReactElement {
  const [bodyExpanded, setBodyExpanded] = useState(!!response.content && Object.keys(response.content).length > 0);

  const codeNum = parseInt(code, 10);
  let codeColor = '#49cc90';
  if (codeNum >= 300 && codeNum < 400) codeColor = '#fca130';
  if (codeNum >= 400) codeColor = '#f93e3e';

  const hasBody = !!response.content && Object.keys(response.content).length > 0;

  const addBody = () => {
    onChange(code, {
      ...response,
      content: { 'application/json': { schema: { type: 'object', properties: {} } } },
    });
    setBodyExpanded(true);
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: codeColor }}>{code}</span>
        <button style={styles.removeBtn} onClick={() => onRemove(code)}>Remove</button>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Description</label>
        <input
          style={styles.input}
          type="text"
          value={response.description ?? ''}
          onChange={e => onChange(code, { ...response, description: e.target.value })}
          placeholder="Response description"
        />
      </div>

      {/* Body section */}
      <div>
        <div style={{ ...styles.sectionTitle, ...styles.collapsible, marginBottom: 8 }}>
          <span onClick={() => setBodyExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {bodyExpanded ? '▾' : '▸'}
            <span>Body</span>
            {hasBody && <span style={{ fontWeight: 400 }}>({Object.keys(response.content!).join(', ')})</span>}
          </span>
          {!hasBody && (
            <button style={styles.addBtn} onClick={addBody}>+ Add</button>
          )}
        </div>
        {bodyExpanded && hasBody && (
          <ContentBodyEditor
            content={response.content!}
            onChange={content => onChange(code, { ...response, content })}
            availableRefs={availableRefs}
          />
        )}
      </div>
    </div>
  );
}
