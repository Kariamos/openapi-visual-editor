# CLAUDE.md — OpenAPI Visual Editor

## Project Overview

VS Code extension that provides a graphical editor for OpenAPI 3.x YAML files. Two main parts:
- **Extension host** (`src/`): Node.js, TypeScript, VS Code API — handles file I/O, WebView lifecycle, bidirectional YAML sync
- **WebView** (`webview/`): React 18, Vite 5, TypeScript — renders the visual editor UI inside a VS Code panel

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

- `src/extension.ts` → registers `openapi-visual-editor.openVisualEditor` command, manages panel map
- `src/editorProvider.ts` → reads YAML file, posts parsed object to WebView via `postMessage`, writes back on `edit` messages, watches file for external changes
- `src/utils/yamlParser.ts` → `parseOpenApi()`, `serializeOpenApi()`, `validateOpenApi()`, `looksLikeOpenApi()` using `js-yaml`
- `webview/App.tsx` → root component, all OpenAPI TypeScript types, state management, debounced sync (400ms)
- `webview/components/Sidebar.tsx` → endpoint list, filter, add/delete
- `webview/components/InfoEditor.tsx` → API info form (title, version, description)
- `webview/components/EndpointEditor.tsx` → tabbed editor (General, Parameters, Request Body, Responses, Examples, Security)
- `webview/components/SchemaEditor.tsx` → recursive JSON Schema editor (primitives, objects, arrays, $ref, allOf/oneOf/anyOf/not), depth-capped at 2
- `webview/components/ExamplesEditor.tsx` → example management, auto-generation from schema, curl/fetch snippet modal

## Communication Protocol (extension ↔ webview)

- Extension → WebView: `{ type: 'update', content: OpenApiDocument, errors?: string[] }`
- Extension → WebView: `{ type: 'error', content: string }`
- WebView → Extension: `{ type: 'edit', content: OpenApiDocument }`
- WebView → Extension: `{ type: 'ready' }` (triggers initial file load)

## Key Decisions

- **js-yaml**: does NOT preserve YAML comments — known limitation, documented in README
- **Single IIFE bundle**: WebView is built as single file (no dynamic imports) because VS Code webviews can't load cross-origin chunks
- **Types duplicated**: OpenAPI types exist in both `yamlParser.ts` and `App.tsx` — the webview can't import from the extension host
- **Debounce 400ms**: edits from WebView are debounced before writing to disk to avoid flooding
- **suppressNextChange**: flag in editorProvider prevents echo when the extension writes a file and the file watcher fires

## Conventions

- All styles are inline objects (no CSS modules, no styled-components)
- VS Code CSS variables used throughout for theme integration (e.g. `var(--vscode-input-background)`)
- HTTP method colors: GET=#61affe, POST=#49cc90, PUT=#fca130, DELETE=#f93e3e, PATCH=#50e3c2
- Component props use explicit interface types, not inline

## Testing

Open `examples/petstore.yaml` in the Extension Development Host to test the full editor.

## License

Source-available proprietary license. See LICENSE file.
