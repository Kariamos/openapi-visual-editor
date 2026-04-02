import React, { useState, useEffect } from 'react';
import type { OpenApiSchema } from '../App';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_TYPES = ['string', 'integer', 'number', 'boolean', 'object', 'array', '$ref'];
const LEAF_TYPES = ['string', 'integer', 'number', 'boolean', '$ref'];

const FORMAT_MAP: Record<string, string[]> = {
  string: ['', 'date', 'date-time', 'email', 'uuid', 'uri', 'password', 'byte', 'binary'],
  integer: ['', 'int32', 'int64'],
  number: ['', 'float', 'double'],
};

const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/xml',
  'text/plain',
  'multipart/form-data',
  'application/x-www-form-urlencoded',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayType(schema: OpenApiSchema): string {
  if (schema.$ref) return '$ref';
  return schema.type ?? 'string';
}

function initSchema(type: string, refs: string[]): OpenApiSchema {
  switch (type) {
    case '$ref': return { $ref: refs[0] ?? '#/components/schemas/' };
    case 'object': return { type: 'object', properties: {} };
    case 'array': return { type: 'array', items: { type: 'string' } };
    default: return { type };
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ms = {
  label: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    marginBottom: 3,
    fontWeight: 500 as const,
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
    borderRadius: 3,
    flexShrink: 0 as const,
  },
  expandBtn: {
    background: 'transparent',
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '2px',
    width: 16,
    flexShrink: 0 as const,
  },
  propRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 0',
    borderBottom: '1px solid var(--vscode-widget-border, #2d2d2d)',
  },
  nested: {
    marginTop: 4,
    marginBottom: 6,
    paddingLeft: 14,
    borderLeft: '2px solid var(--vscode-widget-border, #3d3d3d)',
  },
  sectionHeader: {
    fontSize: '11px',
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    color: 'var(--vscode-sideBarTitle-foreground, #bbb)',
    marginBottom: 4,
    marginTop: 8,
  },
  colHeader: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground, #777)',
    fontWeight: 500 as const,
    marginBottom: 0,
    display: 'block',
  },
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 9px',
    fontSize: '11px',
    borderRadius: 3,
    border: '1px solid var(--vscode-widget-border, #444)',
    background: active ? 'var(--vscode-button-background, #0e639c)' : 'transparent',
    color: active ? 'var(--vscode-button-foreground, #fff)' : 'var(--vscode-foreground, #ccc)',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  };
}

// ─── SchemaEditor ─────────────────────────────────────────────────────────────

export function SchemaEditor({
  schema,
  onChange,
  availableRefs = [],
  depth = 0,
}: {
  schema: OpenApiSchema;
  onChange: (s: OpenApiSchema) => void;
  availableRefs?: string[];
  depth?: number;
}): React.ReactElement {
  const displayType = getDisplayType(schema);
  const types = depth >= 2 ? LEAF_TYPES : ALL_TYPES;

  return (
    <div>
      {/* Type + format + $ref row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={ms.label}>Type</label>
          <select
            style={ms.select}
            value={displayType}
            onChange={e => onChange(initSchema(e.target.value, availableRefs))}
          >
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {displayType === '$ref' && (
          <div style={{ flex: 1 }}>
            <label style={ms.label}>Reference</label>
            {availableRefs.length > 0 ? (
              <select
                style={{ ...ms.select, width: '100%' }}
                value={schema.$ref ?? ''}
                onChange={e => onChange({ $ref: e.target.value })}
              >
                {availableRefs.map(r => (
                  <option key={r} value={r}>{r.replace('#/components/schemas/', '')}</option>
                ))}
              </select>
            ) : (
              <input
                style={ms.input}
                value={schema.$ref ?? ''}
                onChange={e => onChange({ $ref: e.target.value })}
                placeholder="#/components/schemas/MyModel"
              />
            )}
          </div>
        )}

        {FORMAT_MAP[displayType] && (
          <div>
            <label style={ms.label}>Format</label>
            <select
              style={ms.select}
              value={schema.format ?? ''}
              onChange={e => onChange({ ...schema, format: e.target.value || undefined })}
            >
              {FORMAT_MAP[displayType].map(f => (
                <option key={f} value={f}>{f || '—'}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Description + example */}
      {displayType !== '$ref' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 3 }}>
            <label style={ms.label}>Description</label>
            <input
              style={ms.input}
              value={schema.description ?? ''}
              onChange={e => onChange({ ...schema, description: e.target.value || undefined })}
              placeholder="Schema description…"
            />
          </div>
          {displayType !== 'object' && displayType !== 'array' && (
            <div style={{ flex: 2 }}>
              <label style={ms.label}>Example</label>
              <input
                style={ms.input}
                value={schema.example != null ? String(schema.example) : ''}
                onChange={e => onChange({ ...schema, example: e.target.value || undefined })}
                placeholder="e.g. foo-bar"
              />
            </div>
          )}
        </div>
      )}

      {/* Object: properties editor */}
      {displayType === 'object' && (
        <ObjectPropertiesEditor
          schema={schema}
          onChange={onChange}
          availableRefs={availableRefs}
          depth={depth}
        />
      )}

      {/* Array: items schema */}
      {displayType === 'array' && (
        <div>
          <div style={ms.sectionHeader}>Items Schema</div>
          <div style={ms.nested}>
            <SchemaEditor
              schema={schema.items ?? { type: 'string' }}
              onChange={items => onChange({ ...schema, items })}
              availableRefs={availableRefs}
              depth={depth + 1}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ObjectPropertiesEditor ───────────────────────────────────────────────────

function ObjectPropertiesEditor({
  schema,
  onChange,
  availableRefs,
  depth,
}: {
  schema: OpenApiSchema;
  onChange: (s: OpenApiSchema) => void;
  availableRefs: string[];
  depth: number;
}): React.ReactElement {
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];

  const addProp = () => {
    let key = 'newProperty';
    let i = 1;
    while (key in properties) { key = `newProperty${i++}`; }
    onChange({ ...schema, properties: { ...properties, [key]: { type: 'string' } } });
  };

  const renameProp = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !newKey.trim() || newKey in properties) return;
    const newProps: Record<string, OpenApiSchema> = {};
    for (const [k, v] of Object.entries(properties)) {
      newProps[k === oldKey ? newKey : k] = v;
    }
    const newReq = required.map(r => (r === oldKey ? newKey : r));
    onChange({ ...schema, properties: newProps, required: newReq.length > 0 ? newReq : undefined });
  };

  const updateProp = (key: string, s: OpenApiSchema) => {
    onChange({ ...schema, properties: { ...properties, [key]: s } });
  };

  const removeProp = (key: string) => {
    const newProps = { ...properties };
    delete newProps[key];
    const newReq = required.filter(r => r !== key);
    onChange({ ...schema, properties: newProps, required: newReq.length > 0 ? newReq : undefined });
  };

  const toggleRequired = (key: string, checked: boolean) => {
    const newReq = checked
      ? [...required.filter(r => r !== key), key]
      : required.filter(r => r !== key);
    onChange({ ...schema, required: newReq.length > 0 ? newReq : undefined });
  };

  const hasProps = Object.keys(properties).length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={ms.sectionHeader}>Properties</span>
        <button style={ms.addBtn} onClick={addProp}>+ Add Property</button>
      </div>

      {hasProps && (
        <div style={{ display: 'flex', gap: 5, padding: '0 0 3px 21px', marginBottom: 2 }}>
          <span style={{ ...ms.colHeader, width: 120, flexShrink: 0 }}>Name</span>
          <span style={{ ...ms.colHeader, width: 80, flexShrink: 0 }}>Type</span>
          <span style={{ ...ms.colHeader, width: 72, flexShrink: 0 }}>Format</span>
          <span style={{ ...ms.colHeader, flex: 1 }}>Description</span>
          <span style={{ ...ms.colHeader, width: 28, flexShrink: 0 }} title="Required">Req</span>
          <span style={{ width: 22, flexShrink: 0 }} />
        </div>
      )}

      {!hasProps && (
        <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground, #777)', padding: '4px 0 8px' }}>
          No properties yet. Click "+ Add Property" to create one.
        </div>
      )}

      {Object.entries(properties).map(([key, propSchema]) => (
        <PropertyRow
          key={key}
          name={key}
          schema={propSchema}
          isRequired={required.includes(key)}
          onNameChange={n => renameProp(key, n)}
          onSchemaChange={s => updateProp(key, s)}
          onRequiredChange={r => toggleRequired(key, r)}
          onRemove={() => removeProp(key)}
          availableRefs={availableRefs}
          depth={depth}
        />
      ))}
    </div>
  );
}

// ─── PropertyRow ──────────────────────────────────────────────────────────────

function PropertyRow({
  name, schema, isRequired,
  onNameChange, onSchemaChange, onRequiredChange, onRemove,
  availableRefs, depth,
}: {
  name: string;
  schema: OpenApiSchema;
  isRequired: boolean;
  onNameChange: (n: string) => void;
  onSchemaChange: (s: OpenApiSchema) => void;
  onRequiredChange: (r: boolean) => void;
  onRemove: () => void;
  availableRefs: string[];
  depth: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [localName, setLocalName] = useState(name);
  const displayType = getDisplayType(schema);
  const isComplex = displayType === 'object' || displayType === 'array';
  const childTypes = depth >= 1 ? LEAF_TYPES : ALL_TYPES;

  // Sync localName if prop is renamed externally
  useEffect(() => { setLocalName(name); }, [name]);

  const handleTypeChange = (t: string) => {
    onSchemaChange({ ...initSchema(t, availableRefs), description: schema.description });
  };

  return (
    <div>
      <div style={ms.propRow}>
        {/* Expand toggle (visible only for complex types) */}
        <button
          style={{ ...ms.expandBtn, visibility: isComplex ? 'visible' : 'hidden' }}
          onClick={() => setExpanded(e => !e)}
          title="Expand nested schema"
        >
          {expanded ? '▾' : '▸'}
        </button>

        {/* Name */}
        <input
          style={{ ...ms.input, width: 120, flexShrink: 0 }}
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={() => onNameChange(localName)}
          placeholder="fieldName"
        />

        {/* Type */}
        <select
          style={{ ...ms.select, width: 80, flexShrink: 0 }}
          value={displayType}
          onChange={e => handleTypeChange(e.target.value)}
        >
          {childTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {displayType === '$ref' ? (
          /* $ref selector/input */
          availableRefs.length > 0 ? (
            <select
              style={{ ...ms.select, flex: 1 }}
              value={schema.$ref ?? ''}
              onChange={e => onSchemaChange({ $ref: e.target.value })}
            >
              {availableRefs.map(r => (
                <option key={r} value={r}>{r.replace('#/components/schemas/', '')}</option>
              ))}
            </select>
          ) : (
            <input
              style={{ ...ms.input, flex: 1 }}
              value={schema.$ref ?? ''}
              onChange={e => onSchemaChange({ $ref: e.target.value })}
              placeholder="#/components/schemas/…"
            />
          )
        ) : (
          <>
            {/* Format */}
            <select
              style={{ ...ms.select, width: 72, flexShrink: 0 }}
              value={schema.format ?? ''}
              disabled={!FORMAT_MAP[displayType]}
              onChange={e => onSchemaChange({ ...schema, format: e.target.value || undefined })}
            >
              {(FORMAT_MAP[displayType] ?? ['']).map(f => (
                <option key={f} value={f}>{f || '—'}</option>
              ))}
            </select>
            {/* Description */}
            <input
              style={{ ...ms.input, flex: 1 }}
              value={schema.description ?? ''}
              onChange={e => onSchemaChange({ ...schema, description: e.target.value || undefined })}
              placeholder="Description…"
            />
          </>
        )}

        {/* Required checkbox */}
        <label
          title="Required"
          style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', flexShrink: 0, width: 28 }}
        >
          <input
            type="checkbox"
            checked={isRequired}
            onChange={e => onRequiredChange(e.target.checked)}
            style={{ accentColor: 'var(--vscode-checkbox-background, #007fd4)', margin: 0 }}
          />
        </label>

        {/* Remove */}
        <button style={{ ...ms.removeBtn, width: 22 }} onClick={onRemove} title="Remove property">×</button>
      </div>

      {/* Nested: object properties or array items */}
      {expanded && isComplex && (
        <div style={ms.nested}>
          {displayType === 'object' && (
            <ObjectPropertiesEditor
              schema={schema}
              onChange={onSchemaChange}
              availableRefs={availableRefs}
              depth={depth + 1}
            />
          )}
          {displayType === 'array' && (
            <div>
              <div style={ms.sectionHeader}>Items Schema</div>
              <SchemaEditor
                schema={schema.items ?? { type: 'string' }}
                onChange={items => onSchemaChange({ ...schema, items })}
                availableRefs={availableRefs}
                depth={depth + 1}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ContentBodyEditor ────────────────────────────────────────────────────────

export function ContentBodyEditor({
  content,
  onChange,
  availableRefs,
}: {
  content: Record<string, { schema?: OpenApiSchema }>;
  onChange: (c: Record<string, { schema?: OpenApiSchema }>) => void;
  availableRefs: string[];
}): React.ReactElement {
  const types = Object.keys(content);
  const [activeType, setActiveType] = useState<string>(types[0] ?? '');

  // Keep activeType valid when content changes
  useEffect(() => {
    if (!types.includes(activeType) && types.length > 0) {
      setActiveType(types[0]);
    }
  }, [types.join(',')]);

  const current = types.includes(activeType) ? activeType : types[0] ?? '';

  const addType = (t: string) => {
    if (t in content) return;
    const updated = { ...content, [t]: { schema: { type: 'object', properties: {} } as OpenApiSchema } };
    onChange(updated);
    setActiveType(t);
  };

  const removeType = (t: string) => {
    const updated = { ...content };
    delete updated[t];
    onChange(updated);
    const remaining = Object.keys(updated);
    setActiveType(remaining[0] ?? '');
  };

  const unused = COMMON_CONTENT_TYPES.filter(ct => !(ct in content));

  return (
    <div>
      {/* Content-type tabs + add */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {types.map(ct => (
          <div key={ct} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button style={tabStyle(ct === current)} onClick={() => setActiveType(ct)}>
              {ct}
            </button>
            {types.length > 1 && (
              <button
                style={{ ...ms.removeBtn, fontSize: '11px', padding: '0 3px' }}
                onClick={() => removeType(ct)}
                title={`Remove ${ct}`}
              >×</button>
            )}
          </div>
        ))}
        {unused.length > 0 && (
          <select
            style={{ ...ms.select, fontSize: '11px' }}
            value=""
            onChange={e => { if (e.target.value) addType(e.target.value); }}
          >
            <option value="">+ Add content type</option>
            {unused.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Schema editor for active content type */}
      {current && content[current] !== undefined ? (
        <SchemaEditor
          schema={content[current].schema ?? { type: 'object', properties: {} }}
          onChange={schema => onChange({ ...content, [current]: { schema } })}
          availableRefs={availableRefs}
          depth={0}
        />
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground, #777)' }}>
          No content type defined. Add one above.
        </div>
      )}
    </div>
  );
}
