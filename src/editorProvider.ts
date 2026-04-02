import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseOpenApi, serializeOpenApi, validateOpenApi, looksLikeOpenApi, OpenApiDocument } from './utils/yamlParser';

export interface WebviewMessage {
  type: string;
  content?: unknown;
  errors?: string[];
}

/**
 * Manages the lifecycle of a single OpenAPI visual editor WebviewPanel,
 * including bidirectional sync between the YAML file on disk and the
 * React webview UI.
 */
export class OpenApiEditorProvider {
  private panel: vscode.WebviewPanel;
  private fileUri: vscode.Uri;
  private context: vscode.ExtensionContext;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private suppressNextChange = false;
  private disposables: vscode.Disposable[] = [];

  constructor(
    panel: vscode.WebviewPanel,
    fileUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.fileUri = fileUri;
    this.context = context;
    this.setupMessageListener();
    this.setupFileWatcher();
  }

  /**
   * Reads the file from disk, parses it, and sends the result to the webview.
   */
  async openFile(uri: vscode.Uri): Promise<void> {
    this.fileUri = uri;
    try {
      const rawContent = await vscode.workspace.fs.readFile(uri);
      const yamlString = Buffer.from(rawContent).toString('utf8');
      await this.syncToWebview(yamlString);
    } catch (err) {
      this.sendError(`Failed to read file: ${(err as Error).message}`);
    }
  }

  /**
   * Parses a YAML string and pushes the resulting OpenAPI object to the webview.
   * Sends validation errors alongside the document when present.
   */
  async syncToWebview(yamlString: string): Promise<void> {
    let doc: OpenApiDocument;
    try {
      doc = parseOpenApi(yamlString);
    } catch (err) {
      this.sendError(`Parse error: ${(err as Error).message}`);
      return;
    }

    if (!looksLikeOpenApi(doc)) {
      // Send it anyway but warn the user
      const msg: WebviewMessage = {
        type: 'update',
        content: doc,
        errors: ['This file does not appear to be an OpenAPI/Swagger document. Some features may not work correctly.'],
      };
      this.panel.webview.postMessage(msg);
      return;
    }

    const validationErrors = validateOpenApi(doc);
    const msg: WebviewMessage = {
      type: 'update',
      content: doc,
      errors: validationErrors.map(e => `${e.path}: ${e.message}`),
    };
    this.panel.webview.postMessage(msg);
  }

  /**
   * Receives an updated OpenAPI object from the webview, serializes it to
   * YAML, and writes it to the file on disk.
   */
  async syncFromWebview(data: OpenApiDocument): Promise<void> {
    try {
      const yamlString = serializeOpenApi(data);
      const encoded = Buffer.from(yamlString, 'utf8');

      // Suppress the next file-change event so we don't echo back what we
      // just wrote from the webview.
      this.suppressNextChange = true;
      await vscode.workspace.fs.writeFile(this.fileUri, encoded);
    } catch (err) {
      this.sendError(`Failed to write file: ${(err as Error).message}`);
    }
  }

  /**
   * Sets up a listener for postMessage events coming from the webview.
   */
  private setupMessageListener(): void {
    const subscription = this.panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case 'edit':
            if (message.content) {
              await this.syncFromWebview(message.content as OpenApiDocument);
            }
            break;

          case 'ready':
            // Webview signals it is ready — send the current file content
            await this.openFile(this.fileUri);
            break;

          case 'showError':
            vscode.window.showErrorMessage(`OpenAPI Visual Editor: ${message.content}`);
            break;

          default:
            // Unknown message type — ignore
            break;
        }
      },
      undefined,
      this.disposables
    );
    this.disposables.push(subscription);
  }

  /**
   * Watches the file on disk for external changes and syncs them to the webview.
   */
  private setupFileWatcher(): void {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(path.dirname(this.fileUri.fsPath)),
      path.basename(this.fileUri.fsPath)
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    const onChange = async () => {
      if (this.suppressNextChange) {
        this.suppressNextChange = false;
        return;
      }
      await this.openFile(this.fileUri);
    };

    this.fileWatcher.onDidChange(onChange, undefined, this.disposables);
    this.fileWatcher.onDidCreate(onChange, undefined, this.disposables);
  }

  /**
   * Sends an error message to the webview so it can display it to the user.
   */
  private sendError(message: string): void {
    const msg: WebviewMessage = { type: 'error', content: message };
    this.panel.webview.postMessage(msg);
  }

  /**
   * Builds the complete HTML content for the webview, injecting the correct
   * resource URIs and the VS Code API nonce.
   */
  getWebviewContent(extensionUri: vscode.Uri): string {
    const webview = this.panel.webview;

    // In production, load the built Vite bundle from webview/dist/
    const distPath = vscode.Uri.joinPath(extensionUri, 'webview', 'dist');
    const distFsPath = distPath.fsPath;

    // Check if the built dist exists
    if (fs.existsSync(path.join(distFsPath, 'index.html'))) {
      const indexHtmlPath = path.join(distFsPath, 'index.html');
      let html = fs.readFileSync(indexHtmlPath, 'utf8');

      // Rewrite asset src/href paths to use vscode-resource URIs
      const distUri = webview.asWebviewUri(distPath);
      html = html.replace(/(src|href)="(\/[^"]+)"/g, (_match, attr, assetPath) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(distPath, assetPath)
        );
        return `${attr}="${assetUri}"`;
      });

      // Also handle relative paths (no leading slash)
      html = html.replace(/(src|href)="(?!http|\/\/)([^"]+\.(js|css|woff|woff2|png|svg))"/g, (_match, attr, assetPath) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(distPath, assetPath)
        );
        return `${attr}="${assetUri}"`;
      });

      return html;
    }

    // Fallback: inline HTML when webview hasn't been built yet
    return this.getFallbackHtml();
  }

  /**
   * Returns a minimal fallback HTML page shown when the webview bundle has not
   * been built yet (i.e. `npm run build:webview` hasn't been run).
   */
  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenAPI Visual Editor</title>
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      font-family: var(--vscode-font-family, sans-serif);
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
    }
    .message {
      text-align: center;
      max-width: 480px;
      padding: 2rem;
    }
    .message h2 { margin-bottom: 1rem; }
    code {
      background: var(--vscode-textCodeBlock-background, #252526);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
    }
  </style>
</head>
<body>
  <div class="message">
    <h2>Webview not built yet</h2>
    <p>Run the following command in the extension directory to build the webview:</p>
    <p><code>npm run build:webview</code></p>
    <p>Then reload the window.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Disposes all resources held by this provider.
   */
  dispose(): void {
    this.fileWatcher?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
