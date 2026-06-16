import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/tone/')) return 'tone';
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'], passWithNoTests: true },
});
