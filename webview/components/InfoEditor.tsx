import React, { useCallback } from 'react';
import type { OpenApiInfo } from '../App';

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--vscode-sideBarTitle-foreground, #bbb)',
    marginBottom: 12,
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
    minHeight: 60,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  row: {
    display: 'flex',
    gap: 12,
  },
  col: {
    flex: 1,
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface InfoEditorProps {
  info: OpenApiInfo;
  onChange: (info: OpenApiInfo) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InfoEditor({ info, onChange }: InfoEditorProps): React.ReactElement {
  const update = useCallback(
    (field: string, value: string) => {
      onChange({ ...info, [field]: value });
    },
    [info, onChange]
  );

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>API Information</div>

      <div style={styles.row}>
        <div style={styles.col}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Title</label>
            <input
              style={styles.input}
              type="text"
              value={info.title ?? ''}
              onChange={(e) => update('title', e.target.value)}
              placeholder="My API"
            />
          </div>
        </div>
        <div style={{ ...styles.col, maxWidth: 120 }}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Version</label>
            <input
              style={styles.input}
              type="text"
              value={info.version ?? ''}
              onChange={(e) => update('version', e.target.value)}
              placeholder="1.0.0"
            />
          </div>
        </div>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Description</label>
        <textarea
          style={styles.textarea}
          value={info.description ?? ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="A brief description of your API..."
        />
      </div>

      {info.termsOfService !== undefined && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Terms of Service</label>
          <input
            style={styles.input}
            type="text"
            value={(info.termsOfService as string) ?? ''}
            onChange={(e) => update('termsOfService', e.target.value)}
            placeholder="https://example.com/terms"
          />
        </div>
      )}
    </div>
  );
}
