import React, { useState } from "react";
import type { OpenApiPaths, HttpMethod, OpenApiSchema } from "../App";
import { METHOD_COLORS, HTTP_METHODS } from "../utils/constants";
import {
  COMPONENT_CATEGORIES,
  CATEGORY_LABELS,
  type ComponentCategory,
} from "./ComponentsEditor";

// ─── Styles ─────────────────────────────────────────────────────────────────

export type ActiveTab = 'endpoints' | 'components';

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
  revealBtn: {
    opacity: 0,
    background: "transparent",
    color: "var(--vscode-textLink-foreground, #3794ff)",
    border: "none",
    cursor: "pointer",
    fontSize: "11px",
    lineHeight: 1,
    padding: "0 2px",
    flexShrink: 0,
    fontFamily: "var(--vscode-editor-font-family, monospace)",
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
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px 3px",
    fontSize: "10px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: "var(--vscode-sideBarSectionHeader-foreground, #999)",
  },
  sectionAddBtn: {
    background: "transparent",
    color: "var(--vscode-textLink-foreground, #3794ff)",
    border: "none",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: 1,
    padding: "0 2px",
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────

export type SortMode = 'path-asc' | 'path-desc' | 'method' | 'tag';

export interface ComponentSelection {
  category: ComponentCategory;
  name: string;
}

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
  componentsByCategory: Record<ComponentCategory, string[]>;
  selectedComponent: ComponentSelection | null;
  onSelectComponent: (sel: ComponentSelection) => void;
  onAddComponent: (category: ComponentCategory) => void;
  onDeleteComponent: (sel: ComponentSelection) => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onReveal?: (path: Array<string | number>) => void;
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
  componentsByCategory,
  selectedComponent,
  onSelectComponent,
  onAddComponent,
  onDeleteComponent,
  activeTab,
  onTabChange,
  onReveal,
}: SidebarProps): React.ReactElement {
  const [filter, setFilter] = useState("");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

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

  const totalComponents =
    modelNames.length +
    COMPONENT_CATEGORIES.reduce((n, c) => n + componentsByCategory[c].length, 0);

  const renderListItem = (opts: {
    key: string;
    badge: string;
    badgeColor: string;
    label: string;
    selected: boolean;
    onClick: () => void;
    onDeleteClick: () => void;
    deleteTitle: string;
    revealPath?: Array<string | number>;
  }) => {
    const isHovered = hoveredItem === opts.key;
    return (
      <div
        key={opts.key}
        style={{
          ...styles.item,
          ...(opts.selected ? styles.itemSelected : {}),
          ...(isHovered && !opts.selected ? styles.itemHover : {}),
        }}
        onClick={opts.onClick}
        onMouseEnter={() => setHoveredItem(opts.key)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span
          style={{
            ...styles.methodBadge,
            background: opts.badgeColor,
            color: "#fff",
            fontSize: "9px",
          }}
        >
          {opts.badge}
        </span>
        <span style={styles.pathLabel} title={opts.label}>
          {opts.label}
        </span>
        {onReveal && opts.revealPath && (
          <button
            style={{ ...styles.revealBtn, opacity: isHovered ? 1 : 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onReveal(opts.revealPath!);
            }}
            title="Show in YAML source"
          >
            {'{ }'}
          </button>
        )}
        <button
          style={{ ...styles.deleteBtn, opacity: isHovered ? 1 : 0 }}
          onClick={(e) => {
            e.stopPropagation();
            opts.onDeleteClick();
          }}
          title={opts.deleteTitle}
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <div style={styles.sidebar}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        {(['endpoints', 'components'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => onTabChange(tab)}
          >
            {tab === 'endpoints'
              ? 'Endpoints'
              : `Components${totalComponents > 0 ? ` (${totalComponents})` : ''}`}
          </button>
        ))}
      </div>

      {/* Header row with Add (and Sort for endpoints) */}
      {activeTab === 'endpoints' && (
        <div style={styles.header}>
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
          <button style={styles.addBtn} onClick={onAdd} title="Add new endpoint">
            + Add
          </button>
        </div>
      )}

      <input
        style={styles.searchBox}
        type="text"
        placeholder={activeTab === 'endpoints' ? 'Filter endpoints...' : 'Filter components...'}
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

          {filtered.map((entry) =>
            renderListItem({
              key: `${entry.method}:${entry.path}`,
              badge: entry.method,
              badgeColor: METHOD_COLORS[entry.method] ?? "#666",
              label: entry.path,
              selected:
                selectedPath === entry.path && selectedMethod === entry.method,
              onClick: () => onSelect(entry.path, entry.method),
              onDeleteClick: () => onDelete(entry.path, entry.method),
              deleteTitle: "Delete endpoint",
              revealPath: ['paths', entry.path, entry.method],
            })
          )}
        </div>
      )}

      {/* Components list — grouped by category */}
      {activeTab === 'components' && (
        <div style={styles.list}>
          {/* Schemas (models) */}
          <div style={styles.sectionHeader}>
            <span>Schemas ({modelNames.length})</span>
            <button
              style={styles.sectionAddBtn}
              onClick={onAddModel}
              title="Add schema"
            >
              +
            </button>
          </div>
          {filteredModels.map((modelName) =>
            renderListItem({
              key: `model:${modelName}`,
              badge: schemas[modelName]?.type?.toUpperCase().slice(0, 6) ?? 'OBJ',
              badgeColor: 'var(--vscode-badge-background, #4d4d4d)',
              label: modelName,
              selected: selectedModel === modelName,
              onClick: () => onSelectModel(modelName),
              onDeleteClick: () => onDeleteModel(modelName),
              deleteTitle: "Delete schema",
              revealPath: ['components', 'schemas', modelName],
            })
          )}

          {/* Other component categories */}
          {COMPONENT_CATEGORIES.map((category) => {
            const names = componentsByCategory[category];
            const visibleNames = filter
              ? names.filter((n) => n.toLowerCase().includes(filter.toLowerCase()))
              : names;
            return (
              <React.Fragment key={category}>
                <div style={styles.sectionHeader}>
                  <span>{CATEGORY_LABELS[category]} ({names.length})</span>
                  <button
                    style={styles.sectionAddBtn}
                    onClick={() => onAddComponent(category)}
                    title={`Add ${CATEGORY_LABELS[category].replace(/s$/, '').toLowerCase()}`}
                  >
                    +
                  </button>
                </div>
                {visibleNames.map((name) =>
                  renderListItem({
                    key: `${category}:${name}`,
                    badge: CATEGORY_LABELS[category]
                      .replace(/s$/, '')
                      .toUpperCase()
                      .slice(0, 6),
                    badgeColor: 'var(--vscode-badge-background, #4d4d4d)',
                    label: name,
                    selected:
                      selectedComponent?.category === category &&
                      selectedComponent?.name === name,
                    onClick: () => onSelectComponent({ category, name }),
                    onDeleteClick: () => onDeleteComponent({ category, name }),
                    deleteTitle: `Delete ${name}`,
                    revealPath: ['components', category, name],
                  })
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
