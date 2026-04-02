import React, { useCallback, useState } from 'react';
import type { OpenApiOperation, OpenApiParameter, OpenApiResponse, HttpMethod } from '../App';

// ─── Method color map ───────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  get: '#61affe',
  post: '#49cc90',
  put: '#fca130',
  delete: '#f93e3e',
  patch: '#50e3c2',
  head: '#9012fe',
  options: '#0d5aa7',
  trace: '#666',
};

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
  availableSchemes?: string[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EndpointEditor({
  path,
  method,
  operation,
  onChange,
  availableSchemes = [],
}: EndpointEditorProps): React.ReactElement {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true,
    parameters: true,
    requestBody: false,
    responses: true,
    security: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
    (code: string, field: string, value: string) => {
      const responses = { ...(operation.responses ?? {}) };
      responses[code] = { ...responses[code], [field]: value };
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

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span
          style={{
            ...styles.methodBadge,
            background: METHOD_COLORS[method] ?? '#666',
          }}
        >
          {method}
        </span>
        <span style={styles.pathText}>{path}</span>
      </div>

      {/* General section */}
      <div style={styles.section}>
        <div
          style={{ ...styles.sectionTitle, ...styles.collapsible }}
          onClick={() => toggleSection('general')}
        >
          <span>{expandedSections.general ? '▾' : '▸'} General</span>
        </div>
        {expandedSections.general && (
          <>
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
                  <span key={tag} style={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Parameters section */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionTitle, ...styles.collapsible }}>
          <span onClick={() => toggleSection('parameters')}>
            {expandedSections.parameters ? '▾' : '▸'} Parameters
            {operation.parameters && operation.parameters.length > 0 && (
              <span style={{ fontWeight: 400, marginLeft: 6 }}>
                ({operation.parameters.length})
              </span>
            )}
          </span>
          <button style={styles.addBtn} onClick={addParameter}>
            + Add
          </button>
        </div>
        {expandedSections.parameters &&
          (operation.parameters ?? []).map((param, idx) => (
            <ParameterCard
              key={idx}
              param={param}
              index={idx}
              onUpdate={updateParameter}
              onRemove={removeParameter}
            />
          ))}
      </div>

      {/* Security section */}
      {availableSchemes.length > 0 && (
        <div style={styles.section}>
          <div
            style={{ ...styles.sectionTitle, ...styles.collapsible }}
            onClick={() => toggleSection('security')}
          >
            <span>{expandedSections.security ? '▾' : '▸'} Security</span>
          </div>
          {expandedSections.security && (
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
      )}

      {/* Responses section */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionTitle, ...styles.collapsible }}>
          <span onClick={() => toggleSection('responses')}>
            {expandedSections.responses ? '▾' : '▸'} Responses
            {operation.responses && (
              <span style={{ fontWeight: 400, marginLeft: 6 }}>
                ({Object.keys(operation.responses).length})
              </span>
            )}
          </span>
          <button style={styles.addBtn} onClick={addResponse}>
            + Add
          </button>
        </div>
        {expandedSections.responses &&
          Object.entries(operation.responses ?? {}).map(([code, response]) => (
            <ResponseCard
              key={code}
              code={code}
              response={response}
              onUpdate={updateResponse}
              onRemove={removeResponse}
            />
          ))}
      </div>
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
  onUpdate,
  onRemove,
}: {
  code: string;
  response: OpenApiResponse;
  onUpdate: (code: string, field: string, value: string) => void;
  onRemove: (code: string) => void;
}): React.ReactElement {
  const codeNum = parseInt(code, 10);
  let codeColor = '#49cc90'; // 2xx green
  if (codeNum >= 300 && codeNum < 400) codeColor = '#fca130'; // 3xx orange
  if (codeNum >= 400 && codeNum < 500) codeColor = '#f93e3e'; // 4xx red
  if (codeNum >= 500) codeColor = '#f93e3e'; // 5xx red

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: codeColor }}>
          {code}
        </span>
        <button style={styles.removeBtn} onClick={() => onRemove(code)}>
          Remove
        </button>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Description</label>
        <input
          style={styles.input}
          type="text"
          value={response.description ?? ''}
          onChange={(e) => onUpdate(code, 'description', e.target.value)}
          placeholder="Response description"
        />
      </div>
    </div>
  );
}
