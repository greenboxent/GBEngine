import { defineConfig } from 'vite';
import { singlePhaserGuard, readAppVersion } from '@gamebase/gbengine/vite';

export default defineConfig({
  base: './',
  // package.json's version (bumped by `npm run build` / `android:release`): shown on the
  // loading screen and saved in the account's device info.
  define: { __APP_VERSION__: JSON.stringify(readAppVersion()) },
  // Fails the build if Phaser is bundled twice (see singlePhaserGuard); pair with dedupe.
  plugins: [singlePhaserGuard()],
  resolve: { dedupe: ['phaser'] },
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      // Second entry: the standalone delete-account page (see firebase.json rewrite).
      input: { main: 'index.html', deleteAccount: 'delete-account.html' },
      output: { manualChunks: undefined },
    },
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    commonjsOptions: { transformMixedEsModules: true },
  },
  server: { port: {{PORT}} },
  optimizeDeps: {
    include: ['phaser'],
    esbuildOptions: { target: 'esnext' },
  },
});
