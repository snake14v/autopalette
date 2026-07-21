import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // src/app/lib/driver.ts + src/admin/lib/useDriver.ts use top-level await to resolve the
    // async getDriver() (see src/shared/data.ts) — needs a target new enough to support TLA
    // natively rather than Rollup's synthetic-async-function-wrapper fallback.
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
});
