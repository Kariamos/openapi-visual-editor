import React, { useState } from "react";
import type {
  OpenApiOperation,
  OpenApiSchema,
  OpenApiExample,
  HttpMethod,
} from "../App";

// ─── Auto-generate from schema ────────────────────────────────────────────────

const FORMAT_DEFAULTS: Record<string, unknown> = {
  date: "2024-01-15",
  "date-time": "2024-01-15T10:30:00Z",
  email: "user@example.com",
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  uri: "https://example.com",
  password: "p@ssw0rd!",
  byte: "dGVzdA==",
  int32: 42,
  int64: 1000000,
  float: 3.14,
  double: 3.141592653589793,
};

export function generateFromSchema(
  schema: OpenApiSchema,
  components: Record<string, OpenApiSchema>,
  depth = 0
): unknown {
  if (depth > 6) return null;

  // Inline example wins
  if (schema.example !== undefined) return schema.example;

  // Resolve $ref
  if (schema.$ref) {
    const name = schema.$ref.replace("#/components/schemas/", "");
    if (components[name])
      return generateFromSchema(components[name], components, depth + 1);
    return {};
  }

  // allOf → merge all generated objects
  if (schema.allOf) {
    let merged: Record<string, unknown> = {};
    for (const s of schema.allOf) {
      const gen = generateFromSchema(s, components, depth + 1);
      if (gen !== null && typeof gen === "object" && !Array.isArray(gen)) {
        merged = { ...merged, ...(gen as Record<string, unknown>) };
      }
    }
    return merged;
  }

  // oneOf / anyOf → use first schema
  if (schema.oneOf?.length)
    return generateFromSchema(schema.oneOf[0], components, depth + 1);
  if (schema.anyOf?.length)
    return generateFromSchema(schema.anyOf[0], components, depth + 1);

  switch (schema.type) {
    case "string":
      return (
        schema.enum?.[0] ?? FORMAT_DEFAULTS[schema.format ?? ""] ?? "string"
      );
    case "integer":
      return (
        schema.enum?.[0] ??
        (FORMAT_DEFAULTS[schema.format ?? ""] as number) ??
        1
      );
    case "number":
      return (
        schema.enum?.[0] ??
        (FORMAT_DEFAULTS[schema.format ?? ""] as number) ??
        1.5
      );
    case "boolean":
      return true;
    case "array": {
      const item = generateFromSchema(
        schema.items ?? { type: "string" },
        components,
        depth + 1
      );
      return [item];
    }
    case "object": {
      const result: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        result[key] = generateFromSchema(propSchema, components, depth + 1);
      }
      return result;
    }
    default:
      return null;
  }
}

// ─── Curl / fetch snippet generators ─────────────────────────────────────────

function makeCurl(
  method: string,
  path: string,
  serverUrl: string,
  contentType: string,
  value: unknown,
  hasBearerAuth: boolean
): string {
  const url = `${serverUrl.replace(/\/$/, "")}${path}`;
  const lines: string[] = [`curl -X ${method.toUpperCase()} '${url}'`];
  lines.push(`  -H 'Content-Type: ${contentType}'`);
  if (hasBearerAuth) lines.push(`  -H 'Authorization: Bearer <your-token>'`);
  if (value !== undefined && value !== null) {
    lines.push(`  -d '${JSON.stringify(value)}'`);
  }
  return lines.join(" \\\n");
}

function makeFetch(
  method: string,
  path: string,
  serverUrl: string,
  contentType: string,
  value: unknown,
  hasBearerAuth: boolean
): string {
  const url = `${serverUrl.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (hasBearerAuth) headers["Authorization"] = "Bearer <your-token>";
  const headersStr = JSON.stringify(headers, null, 2);
  const bodyStr =
    value !== undefined && value !== null
      ? `,\n  body: JSON.stringify(${JSON.stringify(value, null, 2).split("\n").join("\n  ")})`
      : "";
  return `await fetch('${url}', {
  method: '${method.toUpperCase()}',
  headers: ${headersStr}${bodyStr}
});`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: "var(--vscode-sideBarTitle-foreground, #bbb)",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  card: {
    background: "var(--vscode-editor-background, #1e1e1e)",
    border: "1px solid var(--vscode-widget-border, #444)",
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  label: {
    display: "block",
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground, #9d9d9d)",
    marginBottom: 3,
    fontWeight: 500 as const,
  },
  input: {
    width: "100%",
    padding: "4px 7px",
    fontSize: "12px",
    background: "var(--vscode-input-background, #3c3c3c)",
    color: "var(--vscode-input-foreground, #ccc)",
    border: "1px solid var(--vscode-input-border, transparent)",
    borderRadius: 3,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "6px 8px",
    fontSize: "12px",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
    background: "var(--vscode-input-background, #252526)",
    color: "var(--vscode-input-foreground, #ccc)",
    border: "1px solid var(--vscode-input-border, transparent)",
    borderRadius: 3,
    outline: "none",
    resize: "vertical" as const,
    minHeight: 100,
    boxSizing: "border-box" as const,
  },
  textareaError: {
    border: "1px solid var(--vscode-inputValidation-errorBorder, #be1100)",
  },
  addBtn: {
    background: "transparent",
    color: "var(--vscode-textLink-foreground, #3794ff)",
    border: "none",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600 as const,
    padding: 0,
  },
  iconBtn: (color?: string) =>
    ({
      background: "transparent",
      color: color ?? "var(--vscode-descriptionForeground, #9d9d9d)",
      border: "1px solid var(--vscode-widget-border, #444)",
      borderRadius: 3,
      cursor: "pointer",
      fontSize: "11px",
      padding: "2px 7px",
      display: "flex",
      alignItems: "center",
      gap: 4,
    }) as React.CSSProperties,
  removeBtn: {
    background: "transparent",
    color: "var(--vscode-errorForeground, #f48771)",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    padding: "1px 4px",
  },
  statusBadge: (code: string) => {
    const n = parseInt(code, 10);
    const bg =
      n >= 500
        ? "#7f1d1d"
        : n >= 400
          ? "#7f1d1d"
          : n >= 300
            ? "#78350f"
            : "#14532d";
    const fg =
      n >= 500
        ? "#fca5a5"
        : n >= 400
          ? "#fca5a5"
          : n >= 300
            ? "#fcd34d"
            : "#86efac";
    return {
      display: "inline-block",
      fontSize: "11px",
      fontWeight: 700 as const,
      padding: "1px 7px",
      borderRadius: 3,
      background: bg,
      color: fg,
      marginRight: 6,
    };
  },
  copyFeedback: {
    fontSize: "11px",
    color: "#86efac",
    marginLeft: 4,
  },
};

// ─── Snippet Modal ────────────────────────────────────────────────────────────

function SnippetModal({
  title,
  code,
  onClose,
}: {
  title: string;
  code: string;
  onClose: () => void;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "var(--vscode-editor-background, #1e1e1e)",
          border: "1px solid var(--vscode-widget-border, #555)",
          borderRadius: 6,
          padding: 20,
          width: "90%",
          maxWidth: 600,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--vscode-foreground, #ccc)",
            }}
          >
            {title}
          </span>
          <button style={s.removeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <pre
          style={{
            margin: 0,
            overflowY: "auto",
            background: "var(--vscode-textCodeBlock-background, #252526)",
            border: "1px solid var(--vscode-widget-border, #444)",
            borderRadius: 4,
            padding: 12,
            fontSize: "12px",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            color: "var(--vscode-editor-foreground, #ccc)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {code}
        </pre>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {copied && <span style={s.copyFeedback}>Copied!</span>}
          <button
            style={s.iconBtn("var(--vscode-textLink-foreground, #3794ff)")}
            onClick={copy}
          >
            Copy
          </button>
          <button style={s.iconBtn()} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Example Card ─────────────────────────────────────────────────────────────

function ExampleCard({
  exKey,
  example,
  schema,
  components,
  onKeyChange,
  onChange,
  onRemove,
  onShowCurl,
  onShowFetch,
}: {
  exKey: string;
  example: OpenApiExample;
  schema: OpenApiSchema | undefined;
  components: Record<string, OpenApiSchema>;
  onKeyChange: (k: string) => void;
  onChange: (ex: OpenApiExample) => void;
  onRemove: () => void;
  onShowCurl?: () => void;
  onShowFetch?: () => void;
}): React.ReactElement {
  const [localKey, setLocalKey] = useState(exKey);
  const [rawValue, setRawValue] = useState(() =>
    example.value !== undefined ? JSON.stringify(example.value, null, 2) : ""
  );
  const [jsonError, setJsonError] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const applyValue = (raw: string) => {
    if (!raw.trim()) {
      setJsonError(false);
      onChange({ ...example, value: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setJsonError(false);
      onChange({ ...example, value: parsed });
    } catch {
      setJsonError(true);
    }
  };

  const autoGenerate = () => {
    if (!schema) return;
    const generated = generateFromSchema(schema, components);
    const formatted = JSON.stringify(generated, null, 2);
    setRawValue(formatted);
    setJsonError(false);
    onChange({ ...example, value: generated });
  };

  return (
    <div style={s.card}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <button
          style={{
            ...s.addBtn,
            fontSize: "11px",
            color: "var(--vscode-descriptionForeground, #9d9d9d)",
          }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "▼" : "▶"}
        </button>

        {/* Key */}
        <div style={{ flex: 1 }}>
          <input
            style={{ ...s.input, fontFamily: "monospace", fontSize: "11px" }}
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            onBlur={() => onKeyChange(localKey)}
            placeholder="example-key"
          />
        </div>

        {/* Summary */}
        <div style={{ flex: 2 }}>
          <input
            style={s.input}
            value={example.summary ?? ""}
            onChange={(e) =>
              onChange({ ...example, summary: e.target.value || undefined })
            }
            placeholder="Short description of this example…"
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {schema && (
            <button
              style={s.iconBtn()}
              onClick={autoGenerate}
              title="Auto-generate value from schema"
            >
              ⚡ Generate
            </button>
          )}
          {onShowCurl && (
            <button
              style={s.iconBtn()}
              onClick={onShowCurl}
              title="Show curl snippet"
            >
              curl
            </button>
          )}
          {onShowFetch && (
            <button
              style={s.iconBtn()}
              onClick={onShowFetch}
              title="Show fetch snippet"
            >
              fetch
            </button>
          )}
          <button style={s.removeBtn} onClick={onRemove} title="Remove example">
            ×
          </button>
        </div>
      </div>

      {/* Value editor */}
      {expanded && (
        <div>
          <label style={s.label}>
            Value (JSON)
            {jsonError && (
              <span
                style={{
                  marginLeft: 6,
                  color: "var(--vscode-errorForeground, #f48771)",
                }}
              >
                — invalid JSON
              </span>
            )}
          </label>
          <textarea
            style={{ ...s.textarea, ...(jsonError ? s.textareaError : {}) }}
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            onBlur={(e) => applyValue(e.target.value)}
            spellCheck={false}
            rows={8}
          />
        </div>
      )}
    </div>
  );
}

// ─── Body Examples Section ───────────────────────────────────────────────────

function BodyExamplesSection({
  title,
  badge,
  mediaTypes,
  onMediaTypesChange,
  components,
  showSnippets,
  method,
  path,
  serverUrl,
  hasBearerAuth,
}: {
  title: string;
  badge?: React.ReactNode;
  mediaTypes: Record<
    string,
    { schema?: OpenApiSchema; examples?: Record<string, OpenApiExample> }
  >;
  onMediaTypesChange: (m: typeof mediaTypes) => void;
  components: Record<string, OpenApiSchema>;
  showSnippets: boolean;
  method: string;
  path: string;
  serverUrl: string;
  hasBearerAuth: boolean;
}): React.ReactElement {
  const contentTypes = Object.keys(mediaTypes);
  const [activeType, setActiveType] = useState(
    contentTypes[0] ?? "application/json"
  );
  const [snippet, setSnippet] = useState<{
    title: string;
    code: string;
  } | null>(null);

  const current = contentTypes.includes(activeType)
    ? activeType
    : (contentTypes[0] ?? "");
  const examples = (current ? mediaTypes[current]?.examples : undefined) ?? {};

  const setExamples = (exs: Record<string, OpenApiExample>) => {
    onMediaTypesChange({
      ...mediaTypes,
      [current]: { ...mediaTypes[current], examples: exs },
    });
  };

  const addExample = () => {
    let key = "example";
    let i = 1;
    while (key in examples) {
      key = `example-${i++}`;
    }
    const schema2 = mediaTypes[current]?.schema;
    const value = schema2 ? generateFromSchema(schema2, components) : undefined;
    setExamples({ ...examples, [key]: { summary: "", value } });
  };

  const autoGenerateAll = () => {
    const schema2 = mediaTypes[current]?.schema;
    if (!schema2) return;
    const generated: Record<string, OpenApiExample> = {};
    for (const [k, ex] of Object.entries(examples)) {
      generated[k] = { ...ex, value: generateFromSchema(schema2, components) };
    }
    // If no examples yet, add one
    if (Object.keys(examples).length === 0) {
      generated["default"] = {
        summary: "Default example",
        value: generateFromSchema(schema2, components),
      };
    }
    setExamples(generated);
  };

  const updateExample = (
    oldKey: string,
    newKey: string,
    ex: OpenApiExample
  ) => {
    const updated: Record<string, OpenApiExample> = {};
    for (const [k, v] of Object.entries(examples)) {
      updated[k === oldKey ? newKey : k] = k === oldKey ? ex : v;
    }
    setExamples(updated);
  };

  const removeExample = (key: string) => {
    const updated = { ...examples };
    delete updated[key];
    setExamples(updated);
  };

  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {badge}
          {title}
          {contentTypes.length > 1 && (
            <span style={{ display: "flex", gap: 4, marginLeft: 4 }}>
              {contentTypes.map((ct) => (
                <button
                  key={ct}
                  onClick={() => setActiveType(ct)}
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: 3,
                    cursor: "pointer",
                    border: "1px solid var(--vscode-widget-border, #444)",
                    background:
                      ct === current
                        ? "var(--vscode-button-background, #0e639c)"
                        : "transparent",
                    color:
                      ct === current
                        ? "#fff"
                        : "var(--vscode-foreground, #ccc)",
                    fontWeight: ct === current ? 600 : 400,
                  }}
                >
                  {ct}
                </button>
              ))}
            </span>
          )}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button
            style={s.addBtn}
            onClick={autoGenerateAll}
            title="Auto-generate all from schema"
          >
            ⚡ Auto-generate
          </button>
          <button style={s.addBtn} onClick={addExample}>
            + Add Example
          </button>
        </span>
      </div>

      {Object.keys(examples).length === 0 && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--vscode-descriptionForeground, #777)",
            padding: "8px 0 4px",
          }}
        >
          No examples yet. Click "+ Add Example" or "⚡ Auto-generate".
        </div>
      )}

      {Object.entries(examples).map(([key, ex]) => (
        <ExampleCard
          key={key}
          exKey={key}
          example={ex}
          schema={mediaTypes[current]?.schema}
          components={components}
          onKeyChange={(newKey) => updateExample(key, newKey, ex)}
          onChange={(updated) => updateExample(key, key, updated)}
          onRemove={() => removeExample(key)}
          onShowCurl={
            showSnippets
              ? () =>
                  setSnippet({
                    title: `curl — ${key}`,
                    code: makeCurl(
                      method,
                      path,
                      serverUrl,
                      current,
                      ex.value,
                      hasBearerAuth
                    ),
                  })
              : undefined
          }
          onShowFetch={
            showSnippets
              ? () =>
                  setSnippet({
                    title: `fetch — ${key}`,
                    code: makeFetch(
                      method,
                      path,
                      serverUrl,
                      current,
                      ex.value,
                      hasBearerAuth
                    ),
                  })
              : undefined
          }
        />
      ))}

      {snippet && (
        <SnippetModal
          title={snippet.title}
          code={snippet.code}
          onClose={() => setSnippet(null)}
        />
      )}
    </div>
  );
}

// ─── ExamplesEditor ───────────────────────────────────────────────────────────

export function ExamplesEditor({
  operation,
  onChange,
  method,
  path,
  servers,
  components,
}: {
  operation: OpenApiOperation;
  onChange: (op: OpenApiOperation) => void;
  method: HttpMethod;
  path: string;
  servers: Array<{ url: string; description?: string }>;
  components: Record<string, OpenApiSchema>;
}): React.ReactElement {
  const serverUrl = servers[0]?.url ?? "https://api.example.com";
  const hasBearerAuth = (operation.security ?? []).some(
    (s) => "bearerAuth" in s
  );

  const hasBody =
    !!operation.requestBody &&
    Object.keys(operation.requestBody.content).length > 0;
  const responseCodesWithContent = Object.entries(
    operation.responses ?? {}
  ).filter(([, r]) => r.content && Object.keys(r.content).length > 0);

  if (!hasBody && responseCodesWithContent.length === 0) {
    return (
      <div
        style={{
          fontSize: "12px",
          color: "var(--vscode-descriptionForeground, #777)",
          padding: "24px 0",
          textAlign: "center",
        }}
      >
        No request body or response bodies defined yet.
        <br />
        Add them in the <strong>Request Body</strong> and{" "}
        <strong>Responses</strong> tabs first.
      </div>
    );
  }

  return (
    <div>
      {/* Request Body */}
      {hasBody && (
        <BodyExamplesSection
          title="Request Body"
          mediaTypes={operation.requestBody!.content}
          onMediaTypesChange={(content) =>
            onChange({
              ...operation,
              requestBody: { ...operation.requestBody!, content },
            })
          }
          components={components}
          showSnippets={true}
          method={method}
          path={path}
          serverUrl={serverUrl}
          hasBearerAuth={hasBearerAuth}
        />
      )}

      {/* Responses */}
      {responseCodesWithContent.map(([code, response]) => (
        <BodyExamplesSection
          key={code}
          title={`Response`}
          badge={<span style={s.statusBadge(code)}>{code}</span>}
          mediaTypes={response.content!}
          onMediaTypesChange={(content) =>
            onChange({
              ...operation,
              responses: {
                ...operation.responses,
                [code]: { ...response, content },
              },
            })
          }
          components={components}
          showSnippets={false}
          method={method}
          path={path}
          serverUrl={serverUrl}
          hasBearerAuth={hasBearerAuth}
        />
      ))}
    </div>
  );
}
