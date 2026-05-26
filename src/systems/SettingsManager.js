/**
 * Settings registry providing a `Settings` proxy that delegates to whatever
 * instance the game registers via `registerSettings(instance)`.
 * Call `registerSettings()` before any system that uses Settings
 * (AdService, SoundManager, IAPService, TouchControls) is initialised.
 * @module systems/SettingsManager
 */

import { BaseSettingsManager } from './BaseSettingsManager.js';

/** The active settings instance. Falls back to a bare BaseSettingsManager. */
let _instance = new BaseSettingsManager();

/**
 * Register the game-specific settings singleton.
 * Call this once, early in boot, before any system reads Settings.
 * @param {BaseSettingsManager} instance  The game-specific settings singleton to use.
 */
export function registerSettings(instance) {
    _instance = instance;
}

/**
 * Proxy that forwards all property access/mutation to the registered instance.
 * @type {BaseSettingsManager}
 */
export const Settings = new Proxy(
    /** @type {any} */ ({}),
    {
        get(_target, prop) {
            const val = _instance[prop];
            return typeof val === 'function' ? val.bind(_instance) : val;
        },
        set(_target, prop, value) {
            _instance[prop] = value;
            return true;
        },
    }
);
