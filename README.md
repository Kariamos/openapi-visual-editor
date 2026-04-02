# OpenAPI Visual Editor

A VS Code extension that provides a graphical editor for OpenAPI/Swagger YAML specifications. Open any `.yml`/`.yaml` file containing an OpenAPI spec and edit endpoints, parameters, responses, and API info through a visual interface — changes sync bidirectionally with the YAML file.

## Features

- **Visual endpoint editor** — add, edit, and delete API endpoints through a graphical UI
- **Sidebar navigation** — browse and filter all endpoints with color-coded HTTP method badges
- **Info editor** — edit API title, version, and description
- **Parameter editor** — manage query, path, header, and cookie parameters with type selection
- **Response editor** — add and edit response status codes and descriptions
- **Bidirectional sync** — changes in the visual editor update the YAML file and vice versa
- **File watcher** — external changes to the file are detected and reflected in the editor
- **VS Code theme integration** — respects your current VS Code color theme

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
- Complex `$ref` references are displayed but not yet editable through the visual UI.

## Project Structure

```
openapi-visual-editor/
├── src/                        # VS Code extension (Node.js)
│   ├── extension.ts            # Entry point, command registration
│   ├── editorProvider.ts       # WebviewPanel lifecycle, bidirectional sync
│   └── utils/
│       └── yamlParser.ts       # YAML parse/serialize/validate
├── webview/                    # React app (rendered inside VS Code WebView)
│   ├── main.tsx                # React entry point + VS Code API bridge
│   ├── App.tsx                 # Main app component
│   ├── components/
│   │   ├── Sidebar.tsx         # Endpoint navigation sidebar
│   │   ├── InfoEditor.tsx      # API info editor
│   │   └── EndpointEditor.tsx  # Endpoint detail editor
│   ├── index.html              # WebView HTML shell
│   ├── vite.config.ts          # Vite build config
│   └── package.json            # WebView dependencies
├── examples/
│   └── petstore.yaml           # Sample OpenAPI spec for testing
└── package.json                # Extension manifest
```

## License

MIT
