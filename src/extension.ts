import * as vscode from 'vscode';
import { OpenApiEditorProvider } from './editorProvider';

// Track open panels keyed by file path so we don't open duplicates
const openPanels = new Map<string, { panel: vscode.WebviewPanel; provider: OpenApiEditorProvider }>();

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'openapi-visual-editor.openVisualEditor',
    async (uri?: vscode.Uri) => {
      // Resolve the target file URI
      let fileUri = uri;
      if (!fileUri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          vscode.window.showErrorMessage('No active file. Open a YAML file first.');
          return;
        }
        fileUri = activeEditor.document.uri;
      }

      const filePath = fileUri.fsPath;
      const fileName = filePath.split(/[\\/]/).pop() ?? 'OpenAPI Editor';

      // Re-focus an existing panel for this file instead of opening a duplicate
      const existing = openPanels.get(filePath);
      if (existing) {
        existing.panel.reveal(vscode.ViewColumn.Beside);
        return;
      }

      // Create the WebviewPanel
      const panel = vscode.window.createWebviewPanel(
        'openApiVisualEditor',
        `Visual: ${fileName}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist'),
          ],
        }
      );

      // Create the provider that manages the panel lifecycle
      const provider = new OpenApiEditorProvider(panel, fileUri, context);

      // Set webview HTML content
      panel.webview.html = provider.getWebviewContent(context.extensionUri);

      // Register in the open-panels map
      openPanels.set(filePath, { panel, provider });

      // Clean up when the panel is closed
      panel.onDidDispose(() => {
        openPanels.delete(filePath);
        provider.dispose();
      });

      // The provider will receive a 'ready' message from the webview and
      // then call openFile(). This ensures the webview DOM is ready before
      // we attempt to postMessage into it.
    }
  );

  context.subscriptions.push(command);

  // Auto-open the visual editor when a YAML file that looks like OpenAPI
  // is opened in the text editor (opt-in via setting)
  const autoOpenListener = vscode.workspace.onDidOpenTextDocument(async (doc) => {
    const config = vscode.workspace.getConfiguration('openapi-visual-editor');
    const autoOpen = config.get<boolean>('autoOpen', false);
    if (!autoOpen) {
      return;
    }

    const ext = doc.uri.fsPath.split('.').pop()?.toLowerCase();
    if (ext !== 'yml' && ext !== 'yaml') {
      return;
    }

    // Quick check: does the file content contain 'openapi:' or 'swagger:'?
    const text = doc.getText();
    if (!/^\s*(openapi|swagger)\s*:/m.test(text)) {
      return;
    }

    // Wait briefly for VS Code to finish opening the editor
    setTimeout(() => {
      vscode.commands.executeCommand('openapi-visual-editor.openVisualEditor', doc.uri);
    }, 300);
  });

  context.subscriptions.push(autoOpenListener);
}

export function deactivate(): void {
  for (const { panel, provider } of openPanels.values()) {
    provider.dispose();
    panel.dispose();
  }
  openPanels.clear();
}
