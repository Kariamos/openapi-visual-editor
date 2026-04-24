# CLAUDE.md — OpenAPI Visual Editor

## Project Overview

VS Code extension (v1.6.1) that provides a graphical editor for OpenAPI 3.x YAML/JSON files. Two main parts:
- **Extension host** (`src/`): Node.js, TypeScript, VS Code API — handles file I/O, WebView lifecycle, bidirectional sync, Spectral validation
- **WebView** (`webview/`): React 18, Vite 5, TypeScript, CodeMirror — renders the visual editor UI inside a VS Code panel

## Build & Run

```bash
# Install deps (both root and webview)
npm install && cd webview && npm install && cd ..

# Build everything
npm run build:all

# Or separately:
npm run build:webview   # Vite build → webview/dist/
npm run compile         # tsc → out/

# Dev: press F5 in VS Code to launch Extension Development Host
```

## Architecture

### Extension host (`src/`)

- `src/extension.ts` → registers `openapi-visual-editor.openVisualEditor` command; manages `Map<filePath, {panel, provider}>` to prevent duplicate panels; auto-opens on `openapi:`/`swagger:` files
- `src/editorProvider.ts` → reads file, parses, posts to WebView; receives edits, serializes, writes back; runs Spectral async; watches file for external changes; tracks `pendingSelfWrites` counter to suppress echo
- `src/utils/yamlParser.ts` → `parseOpenApi()`, `looksLikeOpenApi()` + all OpenAPI TypeScript types (`OpenApiDocument`, `OpenApiOperation`, `OpenApiSchema`, `OpenApiParameter`, `OpenApiResponse`, `HttpMethod`, etc.)
- `src/utils/stringifyOpenApi.ts` → `stringifyOpenApiPreservingSource(source, doc)` — uses `yaml-diff-patch` for minimal in-place YAML patches; falls back to full re-serialize for new files; re-emits JSON if source was JSON
- `src/utils/spectralValidator.ts` → `runSpectralValidation(yamlString)` — runs Spectral OAS ruleset + 8 custom rules; returns typed `SpectralDiagnostic[]`
- `src/utils/debounce.ts` → `debounce(fn, ms)` — returns debounced function with `.cancel()` method
- `src/utils/inputFormat.ts` → `detectFormat(text)` — returns `'json'` or `'yaml'` by inspecting first non-whitespace char

**Spectral custom rules:**
- `custom-no-request-body-on-get` — warn GET/DELETE/HEAD with requestBody
- `custom-info-title-non-empty` — error empty info.title
- `custom-info-version-non-empty` — error empty info.version
- `custom-server-url-valid` — warn server URL not resembling a URL
- `custom-operation-summary-non-empty` — warn empty summary
- `custom-response-description-non-empty` — warn empty response description
- `custom-required-fields-exist` — error required fields listed but no properties defined
- `custom-success-response-body` — info hint 200/201 with no content

### WebView (`webview/`)

- `webview/main.tsx` → acquires VS Code API singleton (`acquireVsCodeApi()`), shim for browser dev, mounts React, sends `{ type: 'ready' }` on load
- `webview/App.tsx` → root component; all OpenAPI types duplicated here (see Key Decisions); state: `doc`, `fatalError`, `selectedPath`, `selectedMethod`, `spectralDiagnostics`; 400ms debounce before posting `edit` back to extension
- `webview/components/Sidebar.tsx` → endpoint list, search filter, add/delete, method color badges
- `webview/components/InfoEditor.tsx` → API info form (title, version, description, termsOfService)
- `webview/components/EndpointEditor.tsx` → tabbed editor (General, Parameters, Request Body, Responses, Examples, Security)
- `webview/components/SchemaEditor.tsx` → recursive JSON Schema editor (primitives, objects, arrays, `$ref`, `allOf`/`oneOf`/`anyOf`/`not`), depth-capped at 3
- `webview/components/JsonSchemaEditor.tsx` → single-item primitive schema editor (string, integer, boolean, etc.) used inside SchemaEditor
- `webview/components/ExamplesEditor.tsx` → example management, auto-generation from schema, curl/fetch snippet modal
- `webview/components/DiagnosticsPanel.tsx` → collapsible panel; shows Spectral + client-side hints grouped by category (error/warning/info)
- `webview/utils/constants.ts` → `HTTP_METHODS`, `METHOD_COLORS`, `HTTP_STATUS_CODES`
- `webview/utils/diagnostics.ts` → `validateDocument(doc)` — client-side hints not covered by Spectral (media type format, unused tags, schema hints)

## Communication Protocol (extension ↔ webview)

**Extension → WebView:**
- `{ type: 'update', content: OpenApiDocument, errors?: string[] }` — sync doc after parse
- `{ type: 'error', content: string }` — fatal/unrecoverable error
- `{ type: 'diagnostics', diagnostics: SpectralDiagnostic[] }` — async Spectral results

**WebView → Extension:**
- `{ type: 'ready' }` — triggers initial file load
- `{ type: 'edit', content: OpenApiDocument }` — user made a change (debounced 400ms)
- `{ type: 'showError', content: string }` — user-initiated error surfacing

## Testing

```bash
npm test              # vitest run (single pass)
npm run test:watch    # vitest interactive watch
npm run test:coverage # vitest with v8 coverage report
```

Tests live in `src/__tests__/`. Coverage thresholds: 80% lines/statements/functions, 70% branches.

Test files:
- `yamlParser.test.ts` — parsing, serialization, type validation
- `roundtrip.test.ts` — YAML format preservation (most comprehensive)
- `data-loss.test.ts` — ensures no data loss during edit cycle
- `complex-spec.test.ts` — complex/nested OpenAPI specs
- `deep-nesting.test.ts` — deeply nested schema handling
- `debounce.test.ts` — debounce utility behavior
- `inputFormat.test.ts` — JSON vs YAML detection

Manual testing: open `examples/petstore.yaml` in the Extension Development Host.

## Key Decisions

- **yaml-diff-patch for serialization**: `stringifyOpenApiPreservingSource()` computes a minimal patch against the original source so unchanged regions survive byte-identical. Comments in untouched subtrees are preserved; comments inside modified subtrees are lost (js-yaml limitation).
- **`pendingSelfWrites` counter** (not a boolean flag): tracks how many self-writes are in flight so the file watcher can skip exactly that many echoes without missing legitimate external changes.
- **Single IIFE bundle**: WebView is built as a single file (`inlineDynamicImports: true`) because VS Code webviews can't load cross-origin chunks.
- **Types duplicated**: OpenAPI types exist in both `yamlParser.ts` and `App.tsx` — the webview can't import from the extension host.
- **Debounce 400ms**: edits from WebView are debounced before writing to disk to avoid flooding.
- **CodeMirror in webview**: used for code-mode editing of JSON bodies/examples with VS Code theme parity (`@uiw/codemirror-theme-vscode`).
- **JSON file support**: `detectFormat()` checks first non-whitespace char; if JSON, `stringifyOpenApiPreservingSource()` emits JSON.stringify output instead of YAML.

## Conventions

- All styles are inline objects (no CSS modules, no styled-components)
- VS Code CSS variables used throughout for theme integration (e.g. `var(--vscode-input-background)`)
- HTTP method colors: GET=#61affe, POST=#49cc90, PUT=#fca130, DELETE=#f93e3e, PATCH=#50e3c2 (defined in `webview/utils/constants.ts`)
- Component props use explicit interface types, not inline
- Schema depth capped at 3 in visual editor — data below depth 3 passes through unchanged on save

## License

Source-available proprietary license. See LICENSE file.
