/**
 * Build helpers for a game's `vite.config.js` — plain functions, no Vite import.
 *
 * @example
 * import { defineConfig } from 'vite';
 * import { singlePhaserGuard, readAppVersion } from '@gamebase/gbengine/vite';
 *
 * export default defineConfig({
 *   define: { __APP_VERSION__: JSON.stringify(readAppVersion()) },
 *   plugins: [singlePhaserGuard()],
 *   resolve: { dedupe: ['phaser'] },
 * });
 * @module vite
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The game's `package.json` version (bumped by `npm run build` / `android:release`),
 * for Vite's `define: { __APP_VERSION__ }` — shown on the loading screen and saved in device info.
 * @param {string} [dir=process.cwd()]  Directory holding package.json.
 * @returns {string}
 */
export function readAppVersion(dir = process.cwd()) {
    return JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')).version;
}

/**
 * Rollup plugin: fails the build if Phaser ends up bundled more than once. The
 * same phaser.esm.js reached under two module ids (e.g. a d:/ vs D:/ drive-letter
 * mismatch on Windows) gets bundled twice; GBEngine's base scenes then extend a
 * different Phaser.Scene than the game instance checks against, so Phaser
 * registers them all under the key "default" and auto-starts the wrong one.
 * Pair it with `resolve.dedupe: ['phaser']`.
 * @returns {object} A Vite/Rollup plugin.
 */
export function singlePhaserGuard() {
    return {
        name: 'single-phaser-guard',
        generateBundle(_, bundle) {
            const ids = new Set();
            for (const chunk of Object.values(bundle)) {
                for (const id of Object.keys(chunk.modules ?? {})) {
                    if (/node_modules[\\/]phaser[\\/]dist[\\/]/i.test(id)) ids.add(id);
                }
            }
            if (ids.size > 1) {
                this.error(`Phaser is bundled ${ids.size} times:\n  ${[...ids].join('\n  ')}`);
            }
        },
    };
}
