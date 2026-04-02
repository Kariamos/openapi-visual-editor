import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Acquire the VS Code API singleton. Must be called exactly once and the
// result must be stored — calling acquireVsCodeApi() twice throws.
// In a browser dev environment (Vite dev server) the function won't exist,
// so we provide a no-op shim so the app still renders for development.
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

if (typeof acquireVsCodeApi !== 'undefined') {
  vscodeApi = acquireVsCodeApi();
} else {
  // Shim for browser-based development
  vscodeApi = {
    postMessage: (msg: unknown) => {
      console.log('[vscode shim] postMessage', msg);
    },
    getState: () => null,
    setState: (_state: unknown) => {},
  };
}

export const vscode = vscodeApi;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Notify the extension that the webview DOM is ready so it can send the
// initial file content via postMessage.
vscode.postMessage({ type: 'ready' });
