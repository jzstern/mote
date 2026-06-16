import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = dirname(fileURLToPath(import.meta.url));
const entry = (name: string) => resolve(root, name);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: entry('index.html'),
        botanical: entry('botanical.html'),
        riso: entry('riso.html'),
        tidepool: entry('tidepool.html'),
        aurora: entry('aurora.html'),
        liquid: entry('liquid.html'),
        ascii: entry('ascii.html'),
        terminal: entry('terminal.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/tone/')) return 'tone';
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'], passWithNoTests: true },
});
