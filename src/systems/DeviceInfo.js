/**
 * Saves what kind of device a signed-in player is on (plus a rough locale) with
 * their settings, so odd accounts — e.g. automated Play pre-launch test devices
 * — can be told apart from real players. Firebase Auth records neither device
 * nor IP. Declare it in the Play Data safety form as App info and performance →
 * Diagnostics (purposes: Analytics, Fraud prevention) and in the privacy policy.
 * Needs the `@capacitor/device` plugin.
 * @module systems/DeviceInfo
 */

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Settings } from './SettingsManager.js';

/**
 * Stores `Settings.deviceInfo` (or `options.key`) for the signed-in account.
 * Best-effort and fire-and-forget: never throws, never blocks login. Call it
 * after sign-in, after an account change, and at startup for a restored session.
 *
 * @param {object} [options]
 * @param {string} [options.appVersion]  Build version; defaults to Vite's `__APP_VERSION__` define.
 * @param {string} [options.key='deviceInfo']  Settings key to store under.
 * @returns {Promise<void>}
 */
export async function recordDeviceInfo({ appVersion, key = 'deviceInfo' } = {}) {
    try {
        const d = await Device.getInfo();
        const info = {
            platform:     Capacitor.getPlatform(),
            model:        d.model ?? '',
            manufacturer: d.manufacturer ?? '',
            osVersion:    d.osVersion ?? '',
            isVirtual:    !!d.isVirtual,
            webView:      d.webViewVersion ?? '',
            appVersion:   appVersion ?? (typeof __APP_VERSION__ === 'undefined' ? '' : __APP_VERSION__),
            timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
            locale:       navigator.language ?? '',
            screen:       `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`,
            at:           new Date().toISOString(),
        };
        Settings.set(key, info);
    } catch { /* diagnostics only */ }
}
