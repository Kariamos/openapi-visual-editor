import React, { useState } from "react";
import type { OpenApiPaths, HttpMethod, OpenApiSchema } from "../App";
import { METHOD_COLORS, HTTP_METHODS } from "../utils/constants";

// ─── Styles ─────────────────────────────────────────────────────────────────

type ActiveTab = 'endpoints' | 'models';

const styles = {
  sidebar: {
    width: 260,
    minWidth: 260,
    borderRight: "1px solid var(--vscode-widget-border, #444)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    background: "var(--vscode-sideBar-background, #252526)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "6px 12px",
    borderBottom: "1px solid var(--vscode-widget-border, #444)",
    gap: 4,
  },
  addBtn: {
    background: "var(--vscode-button-background, #0e639c)",
    color: "var(--vscode-button-foreground, #fff)",
    border: "none",
    borderRadius: 3,
    padding: "3px 8px",
    fontSize: "11px",
    cursor: "pointer",
    fontWeight: 600,
  },
  searchBox: {
    margin: "8px 10px",
    padding: "4px 8px",
    fontSize: "12px",
    background: "var(--vscode-input-background, #3c3c3c)",
    color: "var(--vscode-input-foreground, #ccc)",
    border: "1px solid var(--vscode-input-border, transparent)",
    borderRadius: 3,
    outline: "none",
    width: "calc(100% - 20px)",
  },
  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "4px 0",
  },
  item: {
    display: "flex",
    alignItems: "center",
    padding: "5px 12px",
    cursor: "pointer",
    fontSize: "14px",
    gap: 8,
    position: "relative" as const,
    userSelect: "none" as const,
  },
  itemHover: {
    background: "var(--vscode-list-hoverBackground, #2a2d2e)",
  },
  itemSelected: {
    background: "var(--vscode-list-activeSelectionBackground, #094771)",
    color: "var(--vscode-list-activeSelectionForeground, #fff)",
  },
  methodBadge: {
    display: "inline-block",
    fontWeight: 700,
    fontSize: "10px",
    textTransform: "uppercase" as const,
    width: 50,
    textAlign: "center" as const,
    borderRadius: 3,
    padding: "2px 0",
    lineHeight: "16px",
    flexShrink: 0,
  },
  pathLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
  },
  deleteBtn: {
    opacity: 0,
    background: "transparent",
    color: "var(--vscode-errorForeground, #f48771)",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: 1,
    padding: "0 4px",
    flexShrink: 0,
  },
  emptyState: {
    color: "var(--vscode-descriptionForeground, #9d9d9d)",
    fontSize: "12px",
    textAlign: "center" as const,
    padding: "24px 12px",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid var(--vscode-widget-border, #444)",
  },
  tab: {
    flex: 1,
    padding: "6px 0",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: "var(--vscode-sideBarTitle-foreground, #bbb)",
  },
  tabActive: {
    borderBottom: "2px solid var(--vscode-focusBorder, #007fd4)",
    color: "var(--vscode-foreground, #ccc)",
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────

export type SortMode = 'path-asc' | 'path-desc' | 'method' | 'tag';

interface SidebarProps {
  paths: OpenApiPaths;
  selectedPath: string | null;
  selectedMethod: HttpMethod | null;
  onSelect: (path: string, method: HttpMethod) => void;
  onAdd: () => void;
  onDelete: (path: string, method: HttpMethod) => void;
  onSort: (mode: SortMode) => void;
  schemas: Record<string, OpenApiSchema>;
  selectedModel: string | null;
  onSelectModel: (name: string) => void;
  onAddModel: () => void;
  onDeleteModel: (name: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortMode, string> = {
  'path-asc': 'Path A→Z',
  'path-desc': 'Path Z→A',
  'method': 'HTTP Method',
  'tag': 'Tag',
};

export function Sidebar({
  paths,
  selectedPath,
  selectedMethod,
  onSelect,
  onAdd,
  onDelete,
  onSort,
  schemas,
  selectedModel,
  onSelectModel,
  onAddModel,
  onDeleteModel,
}: SidebarProps): React.ReactElement {
  const [filter, setFilter] = useState("");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('endpoints');

  // Build a flat list of (path, method) pairs
  const entries: Array<{ path: string; method: HttpMethod; summary?: string }> =
    [];
  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (op) {
        entries.push({ path: pathKey, method, summary: op.summary });
      }
    }
  }

  // Filter endpoints
  const filtered = filter
    ? entries.filter(
        (e) =>
          e.path.toLowerCase().includes(filter.toLowerCase()) ||
          e.method.includes(filter.toLowerCase()) ||
          e.summary?.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  // Filter models
  const modelNames = Object.keys(schemas);
  const filteredModels = filter
    ? modelNames.filter((n) => n.toLowerCase().includes(filter.toLowerCase()))
    : modelNames;

  return (
    <div style={styles.sidebar}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        {(['endpoints', 'models'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'endpoints'
              ? 'Endpoints'
              : `Models${modelNames.length > 0 ? ` (${modelNames.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Header row with Add (and Sort for endpoints) */}
      <div style={styles.header}>
        {activeTab === 'endpoints' && (
          <div style={{ position: 'relative' }}>
            <button
              style={{
                ...styles.addBtn,
                background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                color: 'var(--vscode-button-secondaryForeground, #ccc)',
              }}
              onClick={() => setShowSortMenu(!showSortMenu)}
              title="Sort endpoints"
            >
              {'↕'} Sort
            </button>
            {showSortMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--vscode-menu-background, #252526)',
                border: '1px solid var(--vscode-menu-border, #454545)',
                borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                zIndex: 100,
                minWidth: 150,
                padding: '4px 0',
              }}>
                {(['path-asc', 'path-desc', 'method', 'tag'] as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '6px 12px',
                      background: 'transparent',
                      color: 'var(--vscode-menu-foreground, #ccc)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--vscode-menu-selectionBackground, #094771)'; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => {
                      onSort(mode);
                      setShowSortMenu(false);
                    }}
                  >
                    {SORT_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          style={styles.addBtn}
          onClick={activeTab === 'endpoints' ? onAdd : onAddModel}
          title={activeTab === 'endpoints' ? 'Add new endpoint' : 'Add new model'}
        >
          + Add
        </button>
      </div>

      <input
        style={styles.searchBox}
        type="text"
        placeholder={activeTab === 'endpoints' ? 'Filter endpoints...' : 'Filter models...'}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {/* Endpoints list */}
      {activeTab === 'endpoints' && (
        <div style={styles.list}>
          {filtered.length === 0 && (
            <div style={styles.emptyState}>
              {entries.length === 0
                ? 'No endpoints yet. Click "+ Add" to create one.'
                : "No matching endpoints."}
            </div>
          )}

          {filtered.map((entry) => {
            const itemKey = `${entry.method}:${entry.path}`;
            const isSelected =
              selectedPath === entry.path && selectedMethod === entry.method;
            const isHovered = hoveredItem === itemKey;

            return (
              <div
                key={itemKey}
                style={{
                  ...styles.item,
                  ...(isSelected ? styles.itemSelected : {}),
                  ...(isHovered && !isSelected ? styles.itemHover : {}),
                }}
                onClick={() => onSelect(entry.path, entry.method)}
                onMouseEnter={() => setHoveredItem(itemKey)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <span
                  style={{
                    ...styles.methodBadge,
                    background: METHOD_COLORS[entry.method] ?? "#666",
                    color: "#fff",
                  }}
                >
                  {entry.method}
                </span>
                <span style={styles.pathLabel} title={entry.path}>
                  {entry.path}
                </span>
                <button
                  style={{
                    ...styles.deleteBtn,
                    opacity: isHovered ? 1 : 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.path, entry.method);
                  }}
                  title="Delete endpoint"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Models list */}
      {activeTab === 'models' && (
        <div style={styles.list}>
          {filteredModels.length === 0 && (
            <div style={styles.emptyState}>
              {modelNames.length === 0
                ? 'No models yet. Click "+ Add" to create one.'
                : "No matching models."}
            </div>
          )}

          {filteredModels.map((modelName) => {
            const isSelected = selectedModel === modelName;
            const isHovered = hoveredItem === `model:${modelName}`;

            return (
              <div
                key={modelName}
                style={{
                  ...styles.item,
                  ...(isSelected ? styles.itemSelected : {}),
                  ...(isHovered && !isSelected ? styles.itemHover : {}),
                }}
                onClick={() => onSelectModel(modelName)}
                onMouseEnter={() => setHoveredItem(`model:${modelName}`)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <span
                  style={{
                    ...styles.methodBadge,
                    background: 'var(--vscode-badge-background, #4d4d4d)',
                    color: 'var(--vscode-badge-foreground, #fff)',
                    fontSize: '9px',
                  }}
                >
                  {schemas[modelName]?.type?.toUpperCase() ?? 'OBJ'}
                </span>
                <span style={styles.pathLabel} title={modelName}>
                  {modelName}
                </span>
                <button
                  style={{
                    ...styles.deleteBtn,
                    opacity: isHovered ? 1 : 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteModel(modelName);
                  }}
                  title="Delete model"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
