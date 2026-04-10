import React, { useState, useMemo } from "react";
import type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticCategory,
} from "../utils/diagnostics";

// ─── Icons ──────────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<DiagnosticSeverity, string> = {
  error: "\u2718", // ✘
  warning: "\u26A0", // ⚠
  info: "\u2139", // ℹ
};

const SEVERITY_COLOR: Record<DiagnosticSeverity, string> = {
  error: "var(--vscode-errorForeground, #f48771)",
  warning: "var(--vscode-editorWarning-foreground, #cca700)",
  info: "var(--vscode-editorInfo-foreground, #75beff)",
};

const SEVERITY_BG: Record<DiagnosticSeverity, string> = {
  error: "rgba(244, 135, 113, 0.08)",
  warning: "rgba(204, 167, 0, 0.08)",
  info: "rgba(117, 190, 255, 0.05)",
};

const CATEGORY_LABELS: Record<DiagnosticCategory, string> = {
  structure: "Structure",
  paths: "Paths",
  operations: "Operations",
  parameters: "Parameters",
  schemas: "Schemas",
  responses: "Responses",
  examples: "Examples",
  security: "Security",
  references: "References",
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  panel: {
    borderTop: "1px solid var(--vscode-widget-border, #444)",
    background: "var(--vscode-panel-background, #1e1e1e)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    fontSize: "14px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px",
    background: "var(--vscode-sideBar-background, #252526)",
    borderBottom: "1px solid var(--vscode-widget-border, #444)",
    cursor: "pointer",
    userSelect: "none" as const,
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: "13px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: "var(--vscode-sideBarTitle-foreground, #bbb)",
  },
  badge: {
    padding: "1px 6px",
    borderRadius: 8,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: "14px",
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderBottom: "1px solid var(--vscode-widget-border, #333)",
    flexShrink: 0,
    flexWrap: "wrap" as const,
  },
  filterBtn: {
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid",
    background: "transparent",
    transition: "opacity 0.15s",
  },
  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "4px 0",
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "5px 12px",
    borderBottom: "1px solid var(--vscode-widget-border, #2a2a2a)",
    lineHeight: "18px",
    fontSize: "14px",
  },
  itemIcon: {
    flexShrink: 0,
    width: 16,
    textAlign: "center" as const,
    fontSize: "14px",
    lineHeight: "18px",
  },
  itemPath: {
    fontSize: "13px",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
    opacity: 0.65,
    marginTop: 1,
    wordBreak: "break-all" as const,
  },
  itemMessage: {
    flex: 1,
    color: "var(--vscode-editor-foreground, #ccc)",
  },
  categoryBadge: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    padding: "1px 5px",
    borderRadius: 3,
    background: "var(--vscode-badge-background, #4d4d4d)",
    color: "var(--vscode-badge-foreground, #ccc)",
    letterSpacing: "0.3px",
    lineHeight: "14px",
    marginTop: 2,
  },
  emptyState: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 12px",
    color: "var(--vscode-descriptionForeground, #9d9d9d)",
    gap: 8,
    fontSize: "14px",
  },
  successIcon: {
    fontSize: "18px",
    color: "#49cc90",
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  /** Collapsed by default */
  defaultExpanded?: boolean;
  /** Max height in px when expanded */
  maxHeight?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DiagnosticsPanel({
  diagnostics,
  defaultExpanded = true,
  maxHeight = 180,
}: DiagnosticsPanelProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [severityFilter, setSeverityFilter] = useState<Set<DiagnosticSeverity>>(
    new Set(["error", "warning"])
  );

  // Counts per severity
  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const d of diagnostics) {
      c[d.severity]++;
    }
    return c;
  }, [diagnostics]);

  // Filtered diagnostics
  const filtered = useMemo(() => {
    return diagnostics.filter((d) => severityFilter.has(d.severity));
  }, [diagnostics, severityFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<DiagnosticCategory, Diagnostic[]>();
    for (const d of filtered) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return map;
  }, [filtered]);

  const toggleSeverity = (sev: DiagnosticSeverity) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) {
        next.delete(sev);
      } else {
        next.add(sev);
      }
      return next;
    });
  };

  const hasIssues = counts.error > 0 || counts.warning > 0;

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={styles.headerLeft}>
          <span
            style={{
              fontSize: "10px",
              color: "var(--vscode-descriptionForeground, #888)",
            }}
          >
            {expanded ? "▼" : "▶"}
          </span>
          <span style={styles.headerTitle}>Diagnostics</span>

          {counts.error > 0 && (
            <span
              style={{
                ...styles.badge,
                background: SEVERITY_COLOR.error,
                color: "#fff",
              }}
            >
              {counts.error} {counts.error === 1 ? "error" : "errors"}
            </span>
          )}
          {counts.warning > 0 && (
            <span
              style={{
                ...styles.badge,
                background: SEVERITY_COLOR.warning,
                color: "#1e1e1e",
              }}
            >
              {counts.warning} {counts.warning === 1 ? "warning" : "warnings"}
            </span>
          )}
          {counts.info > 0 && (
            <span
              style={{
                ...styles.badge,
                background: "var(--vscode-badge-background, #4d4d4d)",
                color: "var(--vscode-badge-foreground, #ccc)",
              }}
            >
              {counts.info} info
            </span>
          )}
        </div>

        {!hasIssues && diagnostics.length > 0 && (
          <span style={{ fontSize: "11px", color: "#49cc90", fontWeight: 600 }}>
            {"\u2714"} No issues
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            maxHeight,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Filter bar */}
          <div style={styles.filterBar}>
            <span
              style={{
                fontSize: "10px",
                color: "var(--vscode-descriptionForeground, #888)",
                marginRight: 2,
              }}
            >
              Filter:
            </span>
            {(["error", "warning", "info"] as DiagnosticSeverity[]).map(
              (sev) => {
                const active = severityFilter.has(sev);
                return (
                  <button
                    key={sev}
                    style={{
                      ...styles.filterBtn,
                      borderColor: SEVERITY_COLOR[sev],
                      color: active ? "#fff" : SEVERITY_COLOR[sev],
                      background: active ? SEVERITY_COLOR[sev] : "transparent",
                      opacity: active ? 1 : 0.6,
                    }}
                    onClick={() => toggleSeverity(sev)}
                    title={`${active ? "Hide" : "Show"} ${sev} diagnostics`}
                  >
                    {SEVERITY_ICON[sev]} {sev} (
                    {sev === "error"
                      ? counts.error
                      : sev === "warning"
                        ? counts.warning
                        : counts.info}
                    )
                  </button>
                );
              }
            )}
          </div>

          {/* Diagnostics list */}
          <div style={styles.list}>
            {filtered.length === 0 && (
              <div style={styles.emptyState}>
                {diagnostics.length === 0 ? (
                  <>
                    <span style={styles.successIcon}>{"\u2714"}</span>
                    <span>No issues found. Your API spec looks good!</span>
                  </>
                ) : (
                  <span>No diagnostics match the current filter.</span>
                )}
              </div>
            )}

            {Array.from(grouped.entries()).map(([category, items]) => (
              <CategoryGroup key={category} category={category} items={items} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Group ─────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  items,
}: {
  category: DiagnosticCategory;
  items: Diagnostic[];
}): React.ReactElement {
  return (
    <>
      {items.map((diag, idx) => (
        <div
          key={`${diag.path}-${idx}`}
          style={{
            ...styles.item,
            background: SEVERITY_BG[diag.severity],
          }}
        >
          <span
            style={{
              ...styles.itemIcon,
              color: SEVERITY_COLOR[diag.severity],
            }}
          >
            {SEVERITY_ICON[diag.severity]}
          </span>

          <div style={styles.itemMessage}>
            <div>{diag.message}</div>
            <div style={styles.itemPath}>{diag.path}</div>
          </div>

          <span style={styles.categoryBadge}>{CATEGORY_LABELS[category]}</span>
          {diag.source && (
            <span
              style={{
                ...styles.categoryBadge,
                background:
                  diag.source === "spectral"
                    ? "rgba(79, 139, 255, 0.2)"
                    : "rgba(255, 255, 255, 0.1)",
                color:
                  diag.source === "spectral"
                    ? "#6ea8fe"
                    : "var(--vscode-badge-foreground, #ccc)",
              }}
            >
              {diag.source === "spectral" ? "Spectral" : "Custom"}
            </span>
          )}
        </div>
      ))}
    </>
  );
}
