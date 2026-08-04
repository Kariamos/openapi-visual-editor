# OpenAPI Visual Editor

A VS Code extension that provides a full graphical editor for OpenAPI/Swagger YAML specifications. Open any `.yml`/`.yaml` file containing an OpenAPI spec and visually edit every aspect of your API — changes sync bidirectionally with the YAML file in real time.

## Features

- **Visual endpoint editor** — add, edit, and delete API endpoints via a tabbed UI (General, Parameters, Request Body, Responses, Examples, Security)
- **Sidebar navigation** — two tabs (Endpoints and Components); browse and filter all endpoints with color-coded HTTP method badges (GET, POST, PUT, DELETE, PATCH, etc.)
- **Components editor** — full visual editing for every reusable `components` category: schemas, security schemes (apiKey / http / OAuth2 with flows & scopes / OpenID Connect / mutual TLS), parameters, headers, responses, and request bodies — add, rename, delete, and edit each one
- **`$ref` navigation** — click the `→` next to any internal `#/components/...` reference to jump straight to the referenced component
- **Reveal in YAML** — the `{ } YAML` button on any endpoint or component opens the source file beside the editor and highlights the exact lines
- **Info editor** — edit API title, version, description, and terms of service
- **Parameter editor** — manage query, path, header, and cookie parameters with type, format, and required toggles
- **Request body editor** — edit request bodies with multi-content-type support and full schema editing
- **Response editor** — add and edit response status codes, descriptions, and response body schemas
- **Schema editor** — recursive visual editor for JSON Schema, supporting primitives, objects, arrays, `$ref`, and composition keywords (`allOf`, `oneOf`, `anyOf`, `not`). Each property row says what it is hiding: a chip shows `enum 3` or `example` when the field already carries that data, so a long list reveals at a glance which properties have values behind the expander
- **Examples editor** — manage request/response examples with auto-generation from schemas and curl/fetch snippet generation
- **Security schemes** — toggle security requirements per endpoint
- **Validation** — real-time OpenAPI linting via [Spectral](https://stoplight.io/open-source/spectral) (OAS ruleset + custom rules) with a collapsible diagnostics panel showing errors, warnings, and hints grouped by category
- **Bidirectional sync** — changes in the visual editor update the YAML file and vice versa (debounced at 400ms)
- **Format preservation** — surgical byte-range splicing means only the nodes you edited change; every untouched line (including 1000+ character single-line strings) survives byte-identical, and saving without changes never rewrites the file; JSON files stay JSON
- **File watcher** — external changes to the file are detected and reflected in the editor
- **VS Code theme integration** — fully respects your current VS Code color theme (light and dark)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [VS Code](https://code.visualstudio.com/) >= 1.85

### Install & Build

```bash
# Clone the repo
git clone https://github.com/Kariamos/openapi-visual-editor.git
cd openapi-visual-editor

# Install all dependencies and build everything
npm install && cd webview && npm install && cd ..
npm run build:all
```

### Run in Development

1. Open the project folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open any `.yaml` or `.yml` file containing an OpenAPI spec (try `examples/petstore.yaml`)
4. Click the **eye icon** in the editor title bar, or run the command **"Open Visual Editor"** from the Command Palette

### Package as VSIX

```bash
npm run package
```

Then install the `.vsix` file via `code --install-extension openapi-visual-editor-1.6.1.vsix`.

## Known Limitations

- **Edits are surgical.** Saving a document applies a byte-range splice that touches only the modified nodes: untouched lines — including very long single-line strings, quoting styles, and comments outside the edited region — survive verbatim. When an edit cannot be applied surgically with full confidence, the editor falls back to a whole-document re-emit; in that (rare) case the notes below apply.
- **Fallback only — YAML comments inside a modified sub-tree are discarded**, and long lines may be re-wrapped/re-styled. Comments and formatting in untouched sections always survive.
- **YAML anchors and aliases (`&`, `*`) are not preserved** when a document is re-serialized from scratch (`noRefs: true`); OpenAPI conventionally uses JSON `$ref` instead, so this is rarely a concern.
- **Fallback only — non-standard indentation is normalized to 2 spaces** in the re-emitted region.
- **Integer values above 2^53 lose precision.** Because values cross a JSON boundary between the extension host and the webview (and JavaScript numbers are IEEE-754 doubles), an `example`/`default` such as `123456789012345678` is rounded to `123456789012345680`. Keep very large integer literals as quoted strings if exact precision matters.
- Only OpenAPI 3.x is fully supported. Swagger 2.0 may partially work.
- `$ref` references are displayed and selectable but not yet resolved inline.
- Schema nesting is capped at depth 3 in the visual editor to prevent infinite recursion; data below that depth is passed through unchanged on save.

## Project Structure

```
openapi-visual-editor/
├── src/                          # VS Code extension (Node.js, TypeScript)
│   ├── extension.ts              # Entry point, command registration, panel map
│   ├── editorProvider.ts         # WebviewPanel lifecycle, bidirectional sync
│   ├── utils/
│   │   ├── yamlParser.ts         # YAML parsing, OpenAPI types
│   │   ├── stringifyOpenApi.ts   # Format-preserving serialization (yaml-diff-patch)
│   │   ├── spectralValidator.ts  # Spectral OAS validation + custom rules
│   │   ├── debounce.ts           # Debounce utility with cancel()
│   │   └── inputFormat.ts        # JSON vs YAML format detection
│   └── __tests__/                # Vitest test suite
│       ├── yamlParser.test.ts
│       ├── roundtrip.test.ts
│       ├── data-loss.test.ts
│       ├── complex-spec.test.ts
│       ├── deep-nesting.test.ts
│       ├── debounce.test.ts
│       └── inputFormat.test.ts
├── webview/                      # React app (rendered inside VS Code WebView)
│   ├── main.tsx                  # React entry point + VS Code API bridge
│   ├── App.tsx                   # Root component, state management, types
│   ├── components/
│   │   ├── Sidebar.tsx           # Endpoint list with filter and CRUD
│   │   ├── InfoEditor.tsx        # API info form
│   │   ├── EndpointEditor.tsx    # Tabbed endpoint editor
│   │   ├── SchemaEditor.tsx      # Recursive JSON Schema editor (depth-capped at 3)
│   │   ├── JsonSchemaEditor.tsx  # Single-field schema editor for primitives
│   │   ├── ExamplesEditor.tsx    # Examples + curl/fetch snippet generation
│   │   └── DiagnosticsPanel.tsx  # Collapsible Spectral validation results
│   ├── utils/
│   │   ├── constants.ts          # HTTP methods, colors, status codes
│   │   └── diagnostics.ts        # Client-side validation hints
│   ├── index.html                # WebView HTML shell
│   ├── vite.config.ts            # Vite build config (single IIFE bundle)
│   └── package.json              # WebView dependencies (React 18, Vite 5, CodeMirror)
├── examples/
│   └── petstore.yaml             # Sample OpenAPI spec for testing
└── package.json                  # Extension manifest
```

## Contributing

Contributions are welcome via pull requests. By submitting a PR, you agree to the terms in the [LICENSE](LICENSE) file. Please open an issue first to discuss significant changes.

## License

This project is **source-available** under a custom proprietary license. You may view the code and contribute via pull requests, but copying, redistribution, and reuse in other projects is not permitted without written permission. See [LICENSE](LICENSE) for full terms.
