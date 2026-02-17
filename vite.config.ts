import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    // Keep dev server deterministic; avoids "wrong app" when ports auto-increment.
    port: 5173,
    strictPort: true,
    host: '127.0.0.1'
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'diagram-vendor': ['@xyflow/react'],
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'export-vendor': ['html-to-image', 'jspdf', 'dompurify'],
          'icons-vendor': ['lucide-react']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  }
});
