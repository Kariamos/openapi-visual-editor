import React, { useState } from 'react';
import type { OpenApiSchema, OpenApiMediaType } from '../App';
import { SchemaEditor, ContentBodyEditor } from './SchemaEditor';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ComponentCategory =
  | 'securitySchemes'
  | 'parameters'
  | 'responses'
  | 'headers'
  | 'requestBodies';

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  'securitySchemes',
  'parameters',
  'responses',
  'headers',
  'requestBodies',
];

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  securitySchemes: 'Security Schemes',
  parameters: 'Parameters',
  responses: 'Responses',
  headers: 'Headers',
  requestBodies: 'Request Bodies',
};

type AnyComponent = Record<string, unknown>;

interface ComponentsEditorProps {
  category: ComponentCategory;
  name: string;
  value: AnyComponent;
  onChange: (value: AnyComponent) => void;
  onRename: (oldName: string, newName: string) => void;
  existingNames: string[];
  availableRefs: string[];
  onReveal?: () => void;
}

// ─── Styles (mirrors ModelsEditor) ──────────────────────────────────────────

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  label: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    fontWeight: 500 as const,
    flexShrink: 0,
  },
  fieldLabel: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    marginBottom: 3,
    fontWeight: 500 as const,
  },
  nameInput: {
    padding: '4px 8px',
    fontSize: '15px',
    fontWeight: 600 as const,
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: 3,
    outline: 'none',
    flex: 1,
  },
  nameDisplay: {
    fontSize: '15px',
    fontWeight: 600 as const,
    color: 'var(--vscode-foreground, #ccc)',
    flex: 1,
    cursor: 'pointer',
    padding: '4px 2px',
    borderRadius: 3,
    border: '1px solid transparent',
  },
  refBadge: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    background: 'var(--vscode-badge-background, #4d4d4d)',
    borderRadius: 3,
    padding: '2px 6px',
    fontFamily: 'monospace',
    flexShrink: 0,
    userSelect: 'all' as const,
  },
  revealBtn: {
    background: 'transparent',
    color: 'var(--vscode-textLink-foreground, #3794ff)',
    border: '1px solid var(--vscode-widget-border, #444)',
    borderRadius: 3,
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  input: {
    padding: '4px 7px',
    fontSize: '12px',
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: 3,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '4px 6px',
    fontSize: '12px',
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: 3,
    outline: 'none',
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: '12px',
    color: 'var(--vscode-foreground, #ccc)',
    cursor: 'pointer',
    paddingBottom: 5,
  },
  sectionHeader: {
    fontSize: '12px',
    fontWeight: 600 as const,
    color: 'var(--vscode-foreground, #ccc)',
    margin: '14px 0 8px',
    paddingBottom: 4,
    borderBottom: '1px solid var(--vscode-widget-border, #2d2d2d)',
  },
  errorMsg: {
    fontSize: '11px',
    color: 'var(--vscode-errorForeground, #f48771)',
    marginBottom: 8,
  },
  flowCard: {
    border: '1px solid var(--vscode-widget-border, #2d2d2d)',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  scopeRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 6,
    alignItems: 'center',
  },
  addBtn: {
    background: 'transparent',
    color: 'var(--vscode-textLink-foreground, #3794ff)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600 as const,
    padding: '2px 0',
  },
  removeBtn: {
    background: 'transparent',
    color: 'var(--vscode-errorForeground, #f48771)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: '1px 4px',
    flexShrink: 0 as const,
  },
};

// ─── Shared field helpers ───────────────────────────────────────────────────

function TextField({
  label,
  value,
  onChange,
  placeholder,
  flex = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  flex?: number;
}): React.ReactElement {
  return (
    <div style={{ flex }}>
      <label style={styles.fieldLabel}>{label}</label>
      <input
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <label style={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--vscode-checkbox-background, #007fd4)', margin: 0 }}
      />
      {label}
    </label>
  );
}

// ─── Security scheme editor ─────────────────────────────────────────────────

const SCHEME_TYPES = ['apiKey', 'http', 'oauth2', 'openIdConnect', 'mutualTLS'];
const OAUTH_FLOWS = ['authorizationCode', 'implicit', 'password', 'clientCredentials'] as const;
type OAuthFlowName = (typeof OAUTH_FLOWS)[number];

/** Which URL fields apply to each OAuth2 flow type. */
const FLOW_URLS: Record<OAuthFlowName, Array<'authorizationUrl' | 'tokenUrl'>> = {
  authorizationCode: ['authorizationUrl', 'tokenUrl'],
  implicit: ['authorizationUrl'],
  password: ['tokenUrl'],
  clientCredentials: ['tokenUrl'],
};

function OAuthFlowEditor({
  flowName,
  flow,
  onChange,
  onRemove,
}: {
  flowName: OAuthFlowName;
  flow: AnyComponent;
  onChange: (f: AnyComponent) => void;
  onRemove: () => void;
}): React.ReactElement {
  const scopes = (flow.scopes as Record<string, string>) ?? {};
  const scopeEntries = Object.entries(scopes);

  const setScopes = (entries: Array<[string, string]>) => {
    const next: Record<string, string> = {};
    for (const [k, v] of entries) next[k] = v;
    onChange({ ...flow, scopes: next });
  };

  return (
    <div style={styles.flowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vscode-foreground, #ccc)' }}>
          {flowName}
        </span>
        <button style={styles.removeBtn} onClick={onRemove} title="Remove flow">×</button>
      </div>
      <div style={styles.row}>
        {FLOW_URLS[flowName].map((field) => (
          <TextField
            key={field}
            label={field}
            value={(flow[field] as string) ?? ''}
            onChange={(v) => onChange({ ...flow, [field]: v })}
            placeholder="https://auth.example.com/…"
          />
        ))}
        <TextField
          label="refreshUrl (optional)"
          value={(flow.refreshUrl as string) ?? ''}
          onChange={(v) => onChange({ ...flow, refreshUrl: v || undefined })}
        />
      </div>
      <label style={styles.fieldLabel}>Scopes</label>
      {scopeEntries.map(([scope, desc], i) => (
        <div key={i} style={styles.scopeRow}>
          <input
            style={{ ...styles.input, flex: 1 }}
            value={scope}
            placeholder="scope:name"
            onChange={(e) => {
              const next = [...scopeEntries] as Array<[string, string]>;
              next[i] = [e.target.value, desc];
              setScopes(next);
            }}
          />
          <input
            style={{ ...styles.input, flex: 2 }}
            value={desc}
            placeholder="Description"
            onChange={(e) => {
              const next = [...scopeEntries] as Array<[string, string]>;
              next[i] = [scope, e.target.value];
              setScopes(next);
            }}
          />
          <button
            style={styles.removeBtn}
            onClick={() => setScopes(scopeEntries.filter((_, j) => j !== i) as Array<[string, string]>)}
            title="Remove scope"
          >
            ×
          </button>
        </div>
      ))}
      <button
        style={styles.addBtn}
        onClick={() => setScopes([...scopeEntries, ['', '']] as Array<[string, string]>)}
      >
        + Add scope
      </button>
    </div>
  );
}

function SecuritySchemeEditor({
  value,
  onChange,
}: {
  value: AnyComponent;
  onChange: (v: AnyComponent) => void;
}): React.ReactElement {
  const type = (value.type as string) ?? 'apiKey';
  const flows = (value.flows as Record<string, AnyComponent>) ?? {};
  const unusedFlows = OAUTH_FLOWS.filter((f) => !(f in flows));

  return (
    <div>
      <div style={styles.row}>
        <div>
          <label style={styles.fieldLabel}>Type</label>
          <select
            style={styles.select}
            value={type}
            onChange={(e) => {
              const t = e.target.value;
              // Keep description; reset type-specific fields to a sane skeleton.
              const base: AnyComponent = { type: t };
              if (value.description) base.description = value.description;
              if (t === 'apiKey') Object.assign(base, { name: 'X-Api-Key', in: 'header' });
              if (t === 'http') Object.assign(base, { scheme: 'bearer' });
              if (t === 'oauth2') Object.assign(base, { flows: {} });
              if (t === 'openIdConnect') Object.assign(base, { openIdConnectUrl: '' });
              onChange(base);
            }}
          >
            {SCHEME_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <TextField
          label="Description"
          value={(value.description as string) ?? ''}
          onChange={(v) => onChange({ ...value, description: v || undefined })}
          flex={2}
        />
      </div>

      {type === 'apiKey' && (
        <div style={styles.row}>
          <TextField
            label="Header/query name"
            value={(value.name as string) ?? ''}
            onChange={(v) => onChange({ ...value, name: v })}
            placeholder="X-Api-Key"
          />
          <div>
            <label style={styles.fieldLabel}>In</label>
            <select
              style={styles.select}
              value={(value.in as string) ?? 'header'}
              onChange={(e) => onChange({ ...value, in: e.target.value })}
            >
              {['header', 'query', 'cookie'].map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {type === 'http' && (
        <div style={styles.row}>
          <div>
            <label style={styles.fieldLabel}>Scheme</label>
            <select
              style={styles.select}
              value={(value.scheme as string) ?? 'bearer'}
              onChange={(e) => onChange({ ...value, scheme: e.target.value })}
            >
              {['bearer', 'basic', 'digest'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {(value.scheme ?? 'bearer') === 'bearer' && (
            <TextField
              label="Bearer format (optional)"
              value={(value.bearerFormat as string) ?? ''}
              onChange={(v) => onChange({ ...value, bearerFormat: v || undefined })}
              placeholder="JWT"
            />
          )}
        </div>
      )}

      {type === 'openIdConnect' && (
        <div style={styles.row}>
          <TextField
            label="OpenID Connect URL"
            value={(value.openIdConnectUrl as string) ?? ''}
            onChange={(v) => onChange({ ...value, openIdConnectUrl: v })}
            placeholder="https://example.com/.well-known/openid-configuration"
          />
        </div>
      )}

      {type === 'oauth2' && (
        <div>
          <div style={styles.sectionHeader}>OAuth2 Flows</div>
          {Object.entries(flows).map(([flowName, flow]) => (
            <OAuthFlowEditor
              key={flowName}
              flowName={flowName as OAuthFlowName}
              flow={flow}
              onChange={(f) => onChange({ ...value, flows: { ...flows, [flowName]: f } })}
              onRemove={() => {
                const next = { ...flows };
                delete next[flowName];
                onChange({ ...value, flows: next });
              }}
            />
          ))}
          {unusedFlows.length > 0 && (
            <select
              style={styles.select}
              value=""
              onChange={(e) => {
                const f = e.target.value as OAuthFlowName;
                if (!f) return;
                const skeleton: AnyComponent = { scopes: {} };
                for (const u of FLOW_URLS[f]) skeleton[u] = '';
                onChange({ ...value, flows: { ...flows, [f]: skeleton } });
              }}
            >
              <option value="">+ Add flow</option>
              {unusedFlows.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Parameter / header editors ─────────────────────────────────────────────

function ParameterComponentEditor({
  value,
  onChange,
  availableRefs,
  isHeader,
}: {
  value: AnyComponent;
  onChange: (v: AnyComponent) => void;
  availableRefs: string[];
  isHeader: boolean;
}): React.ReactElement {
  return (
    <div>
      <div style={styles.row}>
        {!isHeader && (
          <>
            <TextField
              label="Name"
              value={(value.name as string) ?? ''}
              onChange={(v) => onChange({ ...value, name: v })}
              placeholder="paramName"
            />
            <div>
              <label style={styles.fieldLabel}>In</label>
              <select
                style={styles.select}
                value={(value.in as string) ?? 'query'}
                onChange={(e) =>
                  onChange({
                    ...value,
                    in: e.target.value,
                    // Path parameters are always required per the spec.
                    ...(e.target.value === 'path' ? { required: true } : {}),
                  })
                }
              >
                {['query', 'header', 'path', 'cookie'].map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <CheckField
          label="Required"
          checked={(value.required as boolean) ?? false}
          onChange={(v) => onChange({ ...value, required: v || undefined })}
        />
        <CheckField
          label="Deprecated"
          checked={(value.deprecated as boolean) ?? false}
          onChange={(v) => onChange({ ...value, deprecated: v || undefined })}
        />
      </div>
      <div style={styles.row}>
        <TextField
          label="Description"
          value={(value.description as string) ?? ''}
          onChange={(v) => onChange({ ...value, description: v || undefined })}
        />
      </div>
      <div style={styles.sectionHeader}>Schema</div>
      <SchemaEditor
        schema={(value.schema as OpenApiSchema) ?? { type: 'string' }}
        onChange={(schema) => onChange({ ...value, schema })}
        availableRefs={availableRefs}
        depth={0}
      />
    </div>
  );
}

// ─── Response / request body editors ────────────────────────────────────────

function ResponseComponentEditor({
  value,
  onChange,
  availableRefs,
  requestBody,
}: {
  value: AnyComponent;
  onChange: (v: AnyComponent) => void;
  availableRefs: string[];
  requestBody: boolean;
}): React.ReactElement {
  const content = (value.content as Record<string, OpenApiMediaType>) ?? {};
  const hasContent = Object.keys(content).length > 0;

  return (
    <div>
      <div style={styles.row}>
        <TextField
          label="Description"
          value={(value.description as string) ?? ''}
          onChange={(v) => onChange({ ...value, description: v })}
          flex={3}
        />
        {requestBody && (
          <CheckField
            label="Required"
            checked={(value.required as boolean) ?? false}
            onChange={(v) => onChange({ ...value, required: v || undefined })}
          />
        )}
      </div>
      <div style={styles.sectionHeader}>Content</div>
      {hasContent ? (
        <ContentBodyEditor
          content={content as Record<string, { schema?: OpenApiSchema }>}
          onChange={(c) => onChange({ ...value, content: c })}
          availableRefs={availableRefs}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <button
            style={styles.addBtn}
            onClick={() =>
              onChange({
                ...value,
                content: {
                  'application/json': { schema: { type: 'object', properties: {} } },
                },
              })
            }
          >
            + Add content
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main editor ────────────────────────────────────────────────────────────

export function ComponentsEditor({
  category,
  name,
  value,
  onChange,
  onRename,
  existingNames,
  availableRefs,
  onReveal,
}: ComponentsEditorProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [renameError, setRenameError] = useState<string | null>(null);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setDraft(name);
      setRenameError(null);
      return;
    }
    if (existingNames.includes(trimmed)) {
      setRenameError(`"${trimmed}" already exists`);
      setDraft(name);
      return;
    }
    setRenameError(null);
    onRename(name, trimmed);
  };

  return (
    <div>
      <div style={styles.header}>
        <span style={styles.label}>{CATEGORY_LABELS[category].replace(/s$/, '')}</span>
        {editing ? (
          <input
            autoFocus
            style={styles.nameInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') {
                setEditing(false);
                setDraft(name);
                setRenameError(null);
              }
            }}
          />
        ) : (
          <span
            style={styles.nameDisplay}
            onClick={() => { setDraft(name); setEditing(true); }}
            title="Click to rename"
          >
            {name}
          </span>
        )}
        <span style={styles.refBadge}>#/components/{category}/{name}</span>
        {onReveal && (
          <button style={styles.revealBtn} onClick={onReveal} title="Show in YAML source">
            {'{ }'} YAML
          </button>
        )}
      </div>

      {renameError && <div style={styles.errorMsg}>{renameError}</div>}

      {category === 'securitySchemes' && (
        <SecuritySchemeEditor value={value} onChange={onChange} />
      )}
      {(category === 'parameters' || category === 'headers') && (
        <ParameterComponentEditor
          value={value}
          onChange={onChange}
          availableRefs={availableRefs}
          isHeader={category === 'headers'}
        />
      )}
      {(category === 'responses' || category === 'requestBodies') && (
        <ResponseComponentEditor
          value={value}
          onChange={onChange}
          availableRefs={availableRefs}
          requestBody={category === 'requestBodies'}
        />
      )}
    </div>
  );
}
