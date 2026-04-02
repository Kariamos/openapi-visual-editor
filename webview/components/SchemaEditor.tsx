import React, { useState, useEffect } from 'react';
import type { OpenApiSchema } from '../App';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIMITIVE_TYPES = ['string', 'integer', 'number', 'boolean'];
// All types allowed at any level (including top-level and depth-0 properties)
const ALL_TYPES = [...PRIMITIVE_TYPES, 'object', 'array', '$ref', 'allOf', 'oneOf', 'anyOf', 'not'];
// Leaf types allowed inside deeply nested schemas (no further composition)
const LEAF_TYPES = [...PRIMITIVE_TYPES, 'object', 'array', '$ref'];

const COMPOSITION_KEYWORDS = ['allOf', 'oneOf', 'anyOf'] as const;
type CompositionKeyword = typeof COMPOSITION_KEYWORDS[number];

const FORMAT_MAP: Record<string, string[]> = {
  string: ['', 'date', 'date-time', 'email', 'uuid', 'uri', 'password', 'byte', 'binary', 'hostname'],
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
  if (schema.allOf) return 'allOf';
  if (schema.oneOf) return 'oneOf';
  if (schema.anyOf) return 'anyOf';
  if (schema.not) return 'not';
  return schema.type ?? 'string';
}

function initSchema(type: string, refs: string[]): OpenApiSchema {
  const first = refs[0] ?? '#/components/schemas/';
  const second = refs[1] ?? first;
  switch (type) {
    case '$ref':   return { $ref: first };
    case 'object': return { type: 'object', properties: {} };
    case 'array':  return { type: 'array', items: { type: 'string' } };
    case 'allOf':  return { allOf: [{ $ref: first }, { type: 'object', properties: {} }] };
    case 'oneOf':  return { oneOf: [{ $ref: first }, { $ref: second }] };
    case 'anyOf':  return { anyOf: [{ type: 'string' }, { type: 'integer' }] };
    case 'not':    return { not: { type: 'string' } };
    default:       return { type };
  }
}

function isComplex(displayType: string): boolean {
  return ['object', 'array', 'allOf', 'oneOf', 'anyOf', 'not'].includes(displayType);
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
    marginTop: 6,
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
  compositionCard: {
    border: '1px solid var(--vscode-widget-border, #444)',
    borderRadius: 4,
    padding: '10px 12px',
    marginBottom: 8,
    background: 'var(--vscode-editor-background, #1e1e1e)',
  },
  keywordBadge: (kw: string) => {
    const colors: Record<string, string> = {
      allOf: '#0e639c',
      oneOf: '#6f42c1',
      anyOf: '#1a7340',
      not:   '#b91c1c',
    };
    return {
      display: 'inline-block',
      fontSize: '10px',
      fontWeight: 700 as const,
      padding: '2px 7px',
      borderRadius: 3,
      background: colors[kw] ?? '#4d4d4d',
      color: '#fff',
      letterSpacing: '0.3px',
    };
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

// ─── Type select (grouped) ────────────────────────────────────────────────────

function TypeSelect({
  value,
  onChange,
  allowedTypes,
}: {
  value: string;
  onChange: (t: string) => void;
  allowedTypes: string[];
}): React.ReactElement {
  const primitives = PRIMITIVE_TYPES.filter(t => allowedTypes.includes(t));
  const complex = ['object', 'array', '$ref'].filter(t => allowedTypes.includes(t));
  const composition = ['allOf', 'oneOf', 'anyOf', 'not'].filter(t => allowedTypes.includes(t));

  return (
    <select style={ms.select} value={value} onChange={e => onChange(e.target.value)}>
      {primitives.length > 0 && (
        <optgroup label="Primitive">
          {primitives.map(t => <option key={t} value={t}>{t}</option>)}
        </optgroup>
      )}
      {complex.length > 0 && (
        <optgroup label="Complex">
          {complex.map(t => <option key={t} value={t}>{t}</option>)}
        </optgroup>
      )}
      {composition.length > 0 && (
        <optgroup label="Composition">
          {composition.map(t => <option key={t} value={t}>{t}</option>)}
        </optgroup>
      )}
    </select>
  );
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
  const allowedTypes = depth >= 2 ? LEAF_TYPES : ALL_TYPES;

  const setType = (t: string) => {
    const next = initSchema(t, availableRefs);
    if (schema.description) next.description = schema.description;
    onChange(next);
  };

  const isComposition = ['allOf', 'oneOf', 'anyOf'].includes(displayType);

  return (
    <div>
      {/* Type row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={ms.label}>Type</label>
          <TypeSelect value={displayType} onChange={setType} allowedTypes={allowedTypes} />
        </div>

        {/* $ref selector */}
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

        {/* Format for primitives */}
        {FORMAT_MAP[displayType] && (
          <div>
            <label style={ms.label}>Format</label>
            <select
              style={ms.select}
              value={schema.format ?? ''}
              onChange={e => onChange({ ...schema, format: e.target.value || undefined })}
            >
              {FORMAT_MAP[displayType].map(f => <option key={f} value={f}>{f || '—'}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Description + example (for non-composition non-ref types) */}
      {!isComposition && displayType !== 'not' && (
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
          {!isComplex(displayType) && displayType !== '$ref' && (
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

      {/* Object properties */}
      {displayType === 'object' && (
        <ObjectPropertiesEditor
          schema={schema}
          onChange={onChange}
          availableRefs={availableRefs}
          depth={depth}
        />
      )}

      {/* Array items */}
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

      {/* allOf / oneOf / anyOf */}
      {isComposition && (
        <CompositionEditor
          keyword={displayType as CompositionKeyword}
          schemas={(schema[displayType] as OpenApiSchema[]) ?? []}
          onChange={schemas => onChange({ ...schema, [displayType]: schemas })}
          availableRefs={availableRefs}
          depth={depth}
        />
      )}

      {/* not */}
      {displayType === 'not' && (
        <div>
          <div style={ms.sectionHeader}>Schema that must NOT match</div>
          <div style={ms.nested}>
            <SchemaEditor
              schema={schema.not ?? { type: 'string' }}
              onChange={not => onChange({ not })}
              availableRefs={availableRefs}
              depth={depth + 1}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CompositionEditor ────────────────────────────────────────────────────────

const COMPOSITION_DESCRIPTIONS: Record<CompositionKeyword, string> = {
  allOf: 'Must match ALL of these schemas (use to extend/merge models)',
  oneOf: 'Must match exactly ONE of these schemas (discriminated union)',
  anyOf: 'Must match at least ONE of these schemas',
};

function CompositionEditor({
  keyword,
  schemas,
  onChange,
  availableRefs,
  depth,
}: {
  keyword: CompositionKeyword;
  schemas: OpenApiSchema[];
  onChange: (schemas: OpenApiSchema[]) => void;
  availableRefs: string[];
  depth: number;
}): React.ReactElement {
  const addSchema = () => {
    const newEntry: OpenApiSchema =
      availableRefs.length > 0 ? { $ref: availableRefs[0] } : { type: 'object', properties: {} };
    onChange([...schemas, newEntry]);
  };

  const updateSchema = (idx: number, s: OpenApiSchema) => {
    const updated = [...schemas];
    updated[idx] = s;
    onChange(updated);
  };

  const removeSchema = (idx: number) => {
    onChange(schemas.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {/* Header with keyword badge and hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginTop: 4 }}>
        <span style={ms.keywordBadge(keyword)}>{keyword}</span>
        <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground, #888)' }}>
          {COMPOSITION_DESCRIPTIONS[keyword]}
        </span>
      </div>

      {schemas.map((s, idx) => (
        <div key={idx} style={ms.compositionCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground, #888)' }}>
              Schema {idx + 1}
              {s.$ref && (
                <span style={{ marginLeft: 6, color: 'var(--vscode-textLink-foreground, #3794ff)' }}>
                  → {s.$ref.replace('#/components/schemas/', '')}
                </span>
              )}
              {s.type && !s.$ref && (
                <span style={{ marginLeft: 6 }}>{s.type}</span>
              )}
            </span>
            {schemas.length > 1 && (
              <button style={ms.removeBtn} onClick={() => removeSchema(idx)} title="Remove schema">×</button>
            )}
          </div>
          <SchemaEditor
            schema={s}
            onChange={updated => updateSchema(idx, updated)}
            availableRefs={availableRefs}
            depth={depth + 1}
          />
        </div>
      ))}

      <button style={ms.addBtn} onClick={addSchema}>+ Add Schema</button>
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
          <span style={{ ...ms.colHeader, width: 88, flexShrink: 0 }}>Type</span>
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
  const complex = isComplex(displayType);
  const childTypes = depth >= 1 ? LEAF_TYPES : ALL_TYPES;

  useEffect(() => { setLocalName(name); }, [name]);

  const handleTypeChange = (t: string) => {
    const next = initSchema(t, availableRefs);
    if (schema.description) next.description = schema.description;
    onSchemaChange(next);
  };

  // For the inline row, show format only for primitives that have formats
  // For complex/composition types show a type indicator instead
  const showFormat = !!FORMAT_MAP[displayType];
  const showRef = displayType === '$ref';
  const showInlineDesc = !showRef && !complex;

  return (
    <div>
      <div style={ms.propRow}>
        {/* Expand toggle */}
        <button
          style={{ ...ms.expandBtn, visibility: complex ? 'visible' : 'hidden' }}
          onClick={() => setExpanded(e => !e)}
          title="Expand"
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
        <div style={{ width: 88, flexShrink: 0 }}>
          <TypeSelect value={displayType} onChange={handleTypeChange} allowedTypes={childTypes} />
        </div>

        {/* $ref value */}
        {showRef ? (
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
              disabled={!showFormat}
              onChange={e => onSchemaChange({ ...schema, format: e.target.value || undefined })}
            >
              {(FORMAT_MAP[displayType] ?? ['']).map(f => (
                <option key={f} value={f}>{f || '—'}</option>
              ))}
            </select>

            {/* Description (inline for simple types; hidden for complex — they show it when expanded) */}
            {showInlineDesc ? (
              <input
                style={{ ...ms.input, flex: 1 }}
                value={schema.description ?? ''}
                onChange={e => onSchemaChange({ ...schema, description: e.target.value || undefined })}
                placeholder="Description…"
              />
            ) : (
              <span style={{ flex: 1, fontSize: '11px', color: 'var(--vscode-descriptionForeground, #666)', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {['allOf', 'oneOf', 'anyOf', 'not'].includes(displayType)
                  ? `${displayType} (${((schema[displayType] as OpenApiSchema[])?.length ?? (displayType === 'not' ? 1 : 0))} schema${displayType === 'not' ? '' : 's'})`
                  : displayType === 'object'
                    ? `${Object.keys(schema.properties ?? {}).length} props`
                    : displayType === 'array'
                      ? `array of ${getDisplayType(schema.items ?? { type: 'string' })}`
                      : ''}
              </span>
            )}
          </>
        )}

        {/* Required */}
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

      {/* Expanded nested schema */}
      {expanded && complex && (
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
          {(['allOf', 'oneOf', 'anyOf'] as CompositionKeyword[]).includes(displayType as CompositionKeyword) && (
            <CompositionEditor
              keyword={displayType as CompositionKeyword}
              schemas={(schema[displayType] as OpenApiSchema[]) ?? []}
              onChange={schemas => onSchemaChange({ ...schema, [displayType]: schemas })}
              availableRefs={availableRefs}
              depth={depth + 1}
            />
          )}
          {displayType === 'not' && (
            <div>
              <div style={ms.sectionHeader}>Schema that must NOT match</div>
              <SchemaEditor
                schema={schema.not ?? { type: 'string' }}
                onChange={not => onSchemaChange({ not })}
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
      {/* Content-type tabs */}
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

      {/* Schema editor */}
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
