import React, { useState } from 'react';
import type { OpenApiPaths, HttpMethod } from '../App';

// ─── Method color map ───────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  get: '#61affe',
  post: '#49cc90',
  put: '#fca130',
  delete: '#f93e3e',
  patch: '#50e3c2',
  head: '#9012fe',
  options: '#0d5aa7',
  trace: '#666',
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  sidebar: {
    width: 260,
    minWidth: 200,
    borderRight: '1px solid var(--vscode-widget-border, #444)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    background: 'var(--vscode-sideBar-background, #252526)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid var(--vscode-widget-border, #444)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--vscode-sideBarTitle-foreground, #bbb)',
  },
  addBtn: {
    background: 'var(--vscode-button-background, #0e639c)',
    color: 'var(--vscode-button-foreground, #fff)',
    border: 'none',
    borderRadius: 3,
    padding: '3px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  searchBox: {
    margin: '8px 10px',
    padding: '4px 8px',
    fontSize: '12px',
    background: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: 3,
    outline: 'none',
    width: 'calc(100% - 20px)',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    gap: 8,
    position: 'relative' as const,
    userSelect: 'none' as const,
  },
  itemHover: {
    background: 'var(--vscode-list-hoverBackground, #2a2d2e)',
  },
  itemSelected: {
    background: 'var(--vscode-list-activeSelectionBackground, #094771)',
    color: 'var(--vscode-list-activeSelectionForeground, #fff)',
  },
  methodBadge: {
    display: 'inline-block',
    fontWeight: 700,
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    width: 50,
    textAlign: 'center' as const,
    borderRadius: 3,
    padding: '2px 0',
    lineHeight: '16px',
    flexShrink: 0,
  },
  pathLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  deleteBtn: {
    opacity: 0,
    background: 'transparent',
    color: 'var(--vscode-errorForeground, #f48771)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: '0 4px',
    flexShrink: 0,
  },
  emptyState: {
    color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    fontSize: '12px',
    textAlign: 'center' as const,
    padding: '24px 12px',
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  paths: OpenApiPaths;
  selectedPath: string | null;
  selectedMethod: HttpMethod | null;
  onSelect: (path: string, method: HttpMethod) => void;
  onAdd: () => void;
  onDelete: (path: string, method: HttpMethod) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Sidebar({
  paths,
  selectedPath,
  selectedMethod,
  onSelect,
  onAdd,
  onDelete,
}: SidebarProps): React.ReactElement {
  const [filter, setFilter] = useState('');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const allMethods: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];

  // Build a flat list of (path, method) pairs
  const entries: Array<{ path: string; method: HttpMethod; summary?: string }> = [];
  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    for (const method of allMethods) {
      const op = pathItem[method];
      if (op) {
        entries.push({ path: pathKey, method, summary: op.summary });
      }
    }
  }

  // Filter
  const filtered = filter
    ? entries.filter(
        (e) =>
          e.path.toLowerCase().includes(filter.toLowerCase()) ||
          e.method.includes(filter.toLowerCase()) ||
          e.summary?.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <span>Endpoints</span>
        <button style={styles.addBtn} onClick={onAdd} title="Add new endpoint">
          + Add
        </button>
      </div>

      <input
        style={styles.searchBox}
        type="text"
        placeholder="Filter endpoints..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.emptyState}>
            {entries.length === 0
              ? 'No endpoints yet. Click "+ Add" to create one.'
              : 'No matching endpoints.'}
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
                  background: METHOD_COLORS[entry.method] ?? '#666',
                  color: '#fff',
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
    </div>
  );
}
