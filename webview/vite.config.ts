import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Single bundle — VS Code webviews can't do dynamic imports across origins
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
    // Minify for smaller extension package
    minify: true,
    sourcemap: false,
    // Target modern Chromium (VS Code's webview uses Electron's Chromium)
    target: 'chrome108',
    cssCodeSplit: false,
  },
  // Base path must be './' so asset paths are relative in the HTML,
  // which allows the extension to rewrite them to vscode-resource URIs.
  base: './',
});
