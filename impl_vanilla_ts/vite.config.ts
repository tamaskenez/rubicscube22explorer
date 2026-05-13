import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    fs: {
      // Allow imports from the project root (one level up), where ../assets lives.
      allow: ['..'],
    },
  },
});
