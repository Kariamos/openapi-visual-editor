# CLAUDE.md — OpenAPI Visual Editor

## Project Overview

VS Code extension (v1.8.0) that provides a graphical editor for OpenAPI 3.x YAML/JSON files. Two main parts:
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
- `src/utils/yamlParser.ts` → `parseOpenApi()` (js-yaml with **`JSON_SCHEMA`**, not DEFAULT_SCHEMA — see Key Decisions), `serializeOpenApi()`, `looksLikeOpenApi()` + all OpenAPI TypeScript types (`OpenApiDocument`, `OpenApiOperation`, `OpenApiSchema`, `OpenApiParameter`, `OpenApiResponse`, `HttpMethod`, etc.)
- `src/utils/stringifyOpenApi.ts` → `stringifyOpenApiPreservingSource(source, doc)` — pipeline: empty source → full serialize; JSON source → JSON.stringify; otherwise diff source vs doc with `fast-json-patch`: empty diff → return source byte-for-byte; else surgical splice via `yamlSurgicalPatch.ts`; else fallback to `yaml-diff-patch` + `lineWidth: 0` re-emit (+ CRLF restore)
- `src/utils/yamlSurgicalPatch.ts` → `applyJsonPatchToYamlSource(source, ops, expected?)` — applies an RFC-6902 patch by splicing only the byte ranges of changed nodes (located via eemeli `parseDocument` `node.range` offsets). Untouched lines survive verbatim (critical for large Stoplight exports with 1000+ char lines). Conservative: returns `null` on anything uncertain (flow collections with items, last-key removal, overlapping splices) and re-parses the result to verify it deep-equals `expected` — the caller then falls back
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
- `webview/components/ModelsEditor.tsx` → editor for `components/schemas` (Models tab in the sidebar): add/rename/delete schemas, edit via SchemaEditor
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
- `type-coercion.test.ts` — implicit YAML scalars (dates, times, bool words) must NOT be coerced across the postMessage JSON boundary
- `surgical-patch.test.ts` — surgical byte-splice editing on the Stoplight-like fixture (no-op byte-identity, single-line diffs, add/remove locality, CRLF, fallback safety)
- `debounce.test.ts` — debounce utility behavior
- `inputFormat.test.ts` — JSON vs YAML detection

Fixtures in `src/__tests__/fixtures/`: `complex-api.yaml` (generic enterprise spec), `stoplight-like.yaml` (Stoplight formatting quirks: >80-col single lines, `\r\n`-escaped double-quoted strings, single-quoted scalars, empty flow `{}`/`[]`), `quoted-single.yaml`, `indent-4.yaml`. Helpers in `src/__tests__/helpers/yamlDiff.ts` (`diffLines`, `lineSetDiff`, `countBlankRuns`, `extractBlock`).

Manual testing: open `examples/petstore.yaml` in the Extension Development Host.

## Key Decisions

- **Surgical serialization**: `stringifyOpenApiPreservingSource()` diffs the webview doc against the source (`fast-json-patch`) and splices only the changed byte ranges (`yamlSurgicalPatch.ts`). An empty diff returns the source byte-for-byte — saving without changes NEVER rewrites the file. Rationale: any whole-document re-emit (js-yaml dump, eemeli `toString()`, yaml-diff-patch — which calls `toString()` even on an empty patch) re-wraps long lines; on a real 25k-line Stoplight export a one-line edit used to rewrite the entire file.
- **Surgical safety net**: the spliced result is re-parsed and deep-compared with the intended doc; any mismatch → fall back to yaml-diff-patch + `lineWidth: 0` re-emit. The surgical path can never produce a semantically wrong file.
- **`JSON_SCHEMA` for parsing** (not YAML 1.1 DEFAULT_SCHEMA): OpenAPI is JSON-compatible. DEFAULT_SCHEMA coerces `example: 2021-01-01` into a JS `Date`, which the JSON postMessage boundary silently rewrites to `2021-01-01T00:00:00.000Z`. JSON_SCHEMA keeps dates/times/bool-words as plain strings.
- **`pendingSelfWrites` counter** (not a boolean flag): tracks how many self-writes are in flight so the file watcher can skip exactly that many echoes without missing legitimate external changes.
- **Single IIFE bundle**: WebView is built as a single file (`inlineDynamicImports: true`) because VS Code webviews can't load cross-origin chunks.
- **Types duplicated**: OpenAPI types exist in both `yamlParser.ts` and `App.tsx` — the webview can't import from the extension host.
- **Debounce 400ms**: edits from WebView are debounced before writing to disk to avoid flooding.
- **CodeMirror in webview**: used for code-mode editing of JSON bodies/examples with VS Code theme parity (`@uiw/codemirror-theme-vscode`).
- **JSON file support**: `detectFormat()` checks first non-whitespace char; if JSON, `stringifyOpenApiPreservingSource()` emits JSON.stringify output instead of YAML.
- **Known limitation — integers above 2^53 lose precision** crossing the JSON postMessage boundary (IEEE-754); keep huge integer literals quoted as strings.

## Conventions

- All styles are inline objects (no CSS modules, no styled-components)
- VS Code CSS variables used throughout for theme integration (e.g. `var(--vscode-input-background)`)
- HTTP method colors: GET=#61affe, POST=#49cc90, PUT=#fca130, DELETE=#f93e3e, PATCH=#50e3c2 (defined in `webview/utils/constants.ts`)
- Component props use explicit interface types, not inline
- Schema depth capped at 3 in visual editor — data below depth 3 passes through unchanged on save

## License

Source-available proprietary license. See LICENSE file.
