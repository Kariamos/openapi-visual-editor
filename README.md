# OpenAPI Visual Editor

A VS Code extension that provides a full graphical editor for OpenAPI/Swagger YAML specifications. Open any `.yml`/`.yaml` file containing an OpenAPI spec and visually edit every aspect of your API — changes sync bidirectionally with the YAML file in real time.

## Features

- **Visual endpoint editor** — add, edit, and delete API endpoints via a tabbed UI (General, Parameters, Request Body, Responses, Examples, Security)
- **Sidebar navigation** — browse and filter all endpoints with color-coded HTTP method badges (GET, POST, PUT, DELETE, PATCH, etc.)
- **Info editor** — edit API title, version, description, and terms of service
- **Parameter editor** — manage query, path, header, and cookie parameters with type, format, and required toggles
- **Request body editor** — edit request bodies with multi-content-type support and full schema editing
- **Response editor** — add and edit response status codes, descriptions, and response body schemas
- **Schema editor** — recursive visual editor for JSON Schema, supporting primitives, objects, arrays, `$ref`, and composition keywords (`allOf`, `oneOf`, `anyOf`, `not`)
- **Examples editor** — manage request/response examples with auto-generation from schemas and curl/fetch snippet generation
- **Security schemes** — toggle security requirements per endpoint
- **Bidirectional sync** — changes in the visual editor update the YAML file and vice versa (debounced at 400ms)
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

# Install extension dependencies
npm install

# Install webview dependencies and build
cd webview
npm install
npm run build
cd ..

# Compile the extension
npm run compile
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

Then install the `.vsix` file via `code --install-extension openapi-visual-editor-0.0.1.vsix`.

## Known Limitations

- **YAML comments are not preserved.** `js-yaml` does not support round-tripping comments.
- Only OpenAPI 3.x is fully supported. Swagger 2.0 may partially work.
- `$ref` references are displayed and selectable but not yet resolved inline.
- Schema nesting is capped at depth 2 in the visual editor to prevent infinite recursion.

## Project Structure

```
openapi-visual-editor/
├── src/                          # VS Code extension (Node.js)
│   ├── extension.ts              # Entry point, command registration
│   ├── editorProvider.ts         # WebviewPanel lifecycle, bidirectional sync
│   └── utils/
│       └── yamlParser.ts         # YAML parse/serialize/validate
├── webview/                      # React app (rendered inside VS Code WebView)
│   ├── main.tsx                  # React entry point + VS Code API bridge
│   ├── App.tsx                   # Root component, state management, types
│   ├── components/
│   │   ├── Sidebar.tsx           # Endpoint list with filter and CRUD
│   │   ├── InfoEditor.tsx        # API info form
│   │   ├── EndpointEditor.tsx    # Tabbed endpoint editor
│   │   ├── SchemaEditor.tsx      # Recursive JSON Schema editor
│   │   └── ExamplesEditor.tsx    # Examples + snippet generation
│   ├── index.html                # WebView HTML shell
│   ├── vite.config.ts            # Vite build config (single IIFE bundle)
│   └── package.json              # WebView dependencies (React 18, Vite 5)
├── examples/
│   └── petstore.yaml             # Sample OpenAPI spec for testing
└── package.json                  # Extension manifest
```

## Contributing

Contributions are welcome via pull requests. By submitting a PR, you agree to the terms in the [LICENSE](LICENSE) file. Please open an issue first to discuss significant changes.

## License

This project is **source-available** under a custom proprietary license. You may view the code and contribute via pull requests, but copying, redistribution, and reuse in other projects is not permitted without written permission. See [LICENSE](LICENSE) for full terms.
