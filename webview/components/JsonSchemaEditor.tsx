import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import type { OpenApiSchema } from '../App';

interface JsonSchemaEditorProps {
  schema: OpenApiSchema | undefined;
  onChange: (schema: OpenApiSchema) => void;
  height?: number;
}

const DEBOUNCE_MS = 400;

/**
 * Bidirectional JSON editor for an OpenAPI schema.
 *
 * - Serializes `schema` to JSON and keeps it in the editor.
 * - When the editor text is edited by the user, debounces for 400ms, then
 *   parses+validates the JSON; if valid, calls `onChange` with the new schema.
 * - If the JSON is invalid, shows an inline error and does NOT propagate.
 * - While the editor is focused, the prop→editor sync is suspended so the
 *   user's in-progress edits are not clobbered by parent re-renders.
 */
export function JsonSchemaEditor({
  schema,
  onChange,
  height = 300,
}: JsonSchemaEditorProps): React.ReactElement {
  const serialize = (s: OpenApiSchema | undefined): string =>
    JSON.stringify(s ?? {}, null, 2);

  const [jsonText, setJsonText] = useState<string>(() => serialize(schema));
  const [parseError, setParseError] = useState<string | null>(null);
  const isFocusedRef = useRef<boolean>(false);
  const lastPropSerializedRef = useRef<string>(serialize(schema));

  // Sync prop → editor when the schema changes from outside AND the editor
  // is not currently focused. This avoids overwriting what the user is typing.
  useEffect(() => {
    const next = serialize(schema);
    if (next === lastPropSerializedRef.current) return;
    lastPropSerializedRef.current = next;
    if (!isFocusedRef.current) {
      setJsonText(next);
      setParseError(null);
    }
  }, [schema]);

  // Debounced parse of editor text → onChange
  useEffect(() => {
    // Skip if the current text matches the last serialized prop exactly —
    // that means it's a prop sync, not a user edit
    if (jsonText === lastPropSerializedRef.current) {
      setParseError(null);
      return;
    }

    const handle = setTimeout(() => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid JSON';
        setParseError(msg);
        return;
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setParseError('Schema must be a JSON object (not null or array).');
        return;
      }

      setParseError(null);
      // Update the ref so the prop-sync effect doesn't re-trigger
      lastPropSerializedRef.current = jsonText;
      onChange(parsed as OpenApiSchema);
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonText]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>JSON Schema</span>
        {parseError && <span style={styles.errorBadge}>Invalid JSON</span>}
      </div>
      <div
        style={styles.editorWrapper}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={() => { isFocusedRef.current = false; }}
      >
        <CodeMirror
          value={jsonText}
          height={`${height}px`}
          theme={vscodeDark}
          extensions={[json()]}
          onChange={(value) => setJsonText(value)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            autocompletion: false,
            highlightActiveLine: true,
            indentOnInput: true,
          }}
        />
      </div>
      {parseError && (
        <div style={styles.errorBanner}>
          <span style={{ marginRight: 6 }}>⚠</span>
          {parseError}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 12,
    border: '1px solid var(--vscode-panel-border, #3c3c3c)',
    borderRadius: 4,
    overflow: 'hidden',
    background: 'var(--vscode-editor-background, #1e1e1e)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: 'var(--vscode-sideBarSectionHeader-background, #2d2d2d)',
    borderBottom: '1px solid var(--vscode-panel-border, #3c3c3c)',
    fontSize: '11px',
  },
  label: {
    fontWeight: 600,
    color: 'var(--vscode-sideBarSectionHeader-foreground, #cccccc)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  errorBadge: {
    color: 'var(--vscode-errorForeground, #f48771)',
    fontSize: '10px',
    fontWeight: 600,
  },
  editorWrapper: {
    // CodeMirror handles its own styling; wrapper just provides the boundary
  },
  errorBanner: {
    padding: '6px 10px',
    background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
    color: 'var(--vscode-inputValidation-errorForeground, #f48771)',
    borderTop: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
    fontSize: '11px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
  },
};
