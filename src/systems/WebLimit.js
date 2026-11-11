/**
 * A web build that is only a demo: the first N levels are playable, then the
 * player is pointed at the Android app. Only the production web build is
 * limited; the native app, the Vite dev server and development builds are
 * unlimited so testers can reach every level.
 *
 * @example
 * // src/systems/webLimit.js
 * export const webLimit = createWebLimit({
 *   isProdBuild, freeLevels: 5,
 *   storeUrl: 'https://play.google.com/store/apps/details?id=com.greenboxent.mygame',
 * });
 * // when starting level n:  if (webLimit.isLevelBlocked(n)) return webLimit.showDialog(this);
 * // and register a scene:   class WebLimitScene extends BaseWebLimitScene { _getLimit() { return webLimit; } }
 * @module systems/WebLimit
 */

import { Capacitor } from '@capacitor/core';

/**
 * @param {object} options
 * @param {boolean} options.isProdBuild  True for the production build (`import.meta.env.MODE === 'production'`).
 * @param {number}  options.freeLevels   How many levels the web demo allows.
 * @param {string}  options.storeUrl     Where "Get Android App" goes (the Play listing).
 * @param {string}  [options.sceneKey='WebLimitScene']  Key of the dialog scene.
 * @returns {{freeLevels:number, storeUrl:string, isWebLimited:function(): boolean,
 *            isLevelBlocked:function(number): boolean, showDialog:function(Phaser.Scene): void}}
 */
export function createWebLimit({ isProdBuild, freeLevels, storeUrl, sceneKey = 'WebLimitScene' }) {
    const isWebLimited = () => !!isProdBuild && !Capacitor.isNativePlatform();
    return {
        freeLevels,
        storeUrl,
        isWebLimited,
        /** True when `level` is past the demo limit and this build enforces it. */
        isLevelBlocked: level => isWebLimited() && level > freeLevels,
        /** Opens the "play the Android version" dialog over `scene`. */
        showDialog: scene => {
            scene.scene.launch(sceneKey);
            scene.scene.bringToTop(sceneKey);
        },
    };
}
