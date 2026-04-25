import React, { useState } from 'react';
import type { OpenApiSchema } from '../App';
import { SchemaEditor } from './SchemaEditor';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ModelsEditorProps {
  name: string;
  schema: OpenApiSchema;
  onChange: (schema: OpenApiSchema) => void;
  onRename: (oldName: string, newName: string) => void;
  existingNames: string[];
  availableRefs?: string[];
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
  },
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
  nameInputFocused: {
    border: '1px solid var(--vscode-focusBorder, #007fd4)',
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
  errorMsg: {
    fontSize: '11px',
    color: 'var(--vscode-errorForeground, #f48771)',
    marginTop: 2,
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
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ModelsEditor({
  name,
  schema,
  onChange,
  onRename,
  existingNames,
  availableRefs = [],
}: ModelsEditorProps): React.ReactElement {
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
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Model</span>
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
        <span style={styles.refBadge}>#/components/schemas/{name}</span>
      </div>

      {renameError && <div style={styles.errorMsg}>{renameError}</div>}

      <SchemaEditor
        schema={schema}
        onChange={onChange}
        availableRefs={availableRefs}
        depth={0}
      />
    </div>
  );
}
