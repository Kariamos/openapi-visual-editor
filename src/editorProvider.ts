import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseOpenApi, looksLikeOpenApi, OpenApiDocument } from './utils/yamlParser';
import { stringifyOpenApiPreservingSource } from './utils/stringifyOpenApi';
import { runSpectralValidation } from './utils/spectralValidator';

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
  /**
   * Number of self-initiated writes whose corresponding file-change events
   * have not yet been observed. Using a counter (instead of a boolean flag)
   * correctly handles rapid consecutive saves without losing external edits.
   */
  private pendingSelfWrites = 0;
  private disposables: vscode.Disposable[] = [];
  /** Incremented on each validation to discard stale Spectral results */
  private validationSeq = 0;
  /** Last YAML string sent to Spectral, used to re-validate on edits */
  private lastYamlString = '';

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
    // Capture the source buffer before parsing so that even if parsing fails
    // (or the webview edits before Spectral returns) we have the original
    // formatting to diff against on the next write.
    this.lastYamlString = yamlString;

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

    const msg: WebviewMessage = {
      type: 'update',
      content: doc,
    };
    this.panel.webview.postMessage(msg);

    // Run Spectral validation asynchronously (don't block the UI)
    this.runSpectralAsync(yamlString);
  }

  /**
   * Runs Spectral validation asynchronously and sends results to the webview.
   * Uses a sequence number to discard stale results if the document changed.
   */
  private runSpectralAsync(yamlString: string): void {
    const seq = ++this.validationSeq;

    runSpectralValidation(yamlString).then((diagnostics) => {
      // Discard if a newer validation has been triggered
      if (seq !== this.validationSeq) return;

      this.panel.webview.postMessage({
        type: 'diagnostics',
        diagnostics,
      });
    }).catch((err) => {
      console.error('Spectral validation error:', err);
    });
  }

  /**
   * Receives an updated OpenAPI object from the webview, serializes it to
   * YAML, and writes it to the file on disk.
   */
  async syncFromWebview(data: OpenApiDocument): Promise<void> {
    // Patch the original YAML in-place to preserve formatting (quotes, comments,
    // indentation style). Falls back to full re-serialization for new files
    // and re-emits JSON when the source was JSON.
    const yamlString = stringifyOpenApiPreservingSource(this.lastYamlString, data);
    const encoded = Buffer.from(yamlString, 'utf8');

    // Track self-initiated writes so we can ignore the corresponding
    // file-change event (without swallowing a concurrent external edit).
    this.pendingSelfWrites += 1;
    // Safety: if the file watcher never fires (some file systems or
    // configurations suppress events), decrement after a timeout so we
    // don't permanently mute external change detection.
    setTimeout(() => {
      if (this.pendingSelfWrites > 0) this.pendingSelfWrites -= 1;
    }, 2000);

    try {
      await vscode.workspace.fs.writeFile(this.fileUri, encoded);
    } catch (err) {
      // Write failed — leave lastYamlString unchanged so the next edit is
      // still diffed against the on-disk source, and give back the counter.
      if (this.pendingSelfWrites > 0) this.pendingSelfWrites -= 1;
      this.sendError(`Failed to write file: ${(err as Error).message}`);
      return;
    }

    // Only update the cached source after the write has succeeded so that
    // a failed write does not desync lastYamlString from disk.
    this.lastYamlString = yamlString;
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
              // Re-run Spectral on the patched YAML (lastYamlString updated by syncFromWebview)
              this.runSpectralAsync(this.lastYamlString);
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
      // Only treat the event as a self-write if the file content on disk
      // actually matches what we just wrote. A bare counter can drop a
      // concurrent external edit when event ordering is not guaranteed.
      if (this.pendingSelfWrites > 0) {
        let currentContent: string | undefined;
        try {
          const raw = await vscode.workspace.fs.readFile(this.fileUri);
          currentContent = Buffer.from(raw).toString('utf8');
        } catch {
          currentContent = undefined;
        }
        if (currentContent !== undefined && currentContent === this.lastYamlString) {
          this.pendingSelfWrites -= 1;
          return;
        }
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
