/**
 * Centralized storage and persistence for keyboard bindings. Stores defaults,
 * loads from localStorage, saves updates, and provides getters for UI and
 * gameplay. Exported as the `Keybindings` singleton.
 * @module systems/KeybindingManager
 */

import * as Phaser from 'phaser';

/**
 * FULL KEY TRANSLATION MAP
 * -----------------------------------------------------------------------------
 * Maps human-readable key names (used in UI + localStorage) to Phaser keycodes.
 * Includes ALL Phaser Input Keyboard KeyCodes so the system never needs updating.
 */
const KEY_TRANSLATION_MAP = (() => {
    const map = {};
    const codes = Phaser.Input.Keyboard.KeyCodes;

    for (const key in codes) {
        const value = codes[key];

        // Only include numeric keycodes (actual keys)
        if (typeof value === "number") {
            map[key] = value;
        }
    }

    return map;
})();

/**
 * Manages all keyboard bindings for the game. Provides getters and setters for
 * each action and automatically persists changes to localStorage.
 */
export class KeybindingManager {

    /**
     * Creates a new KeybindingManager instance and loads bindings from storage.
     */
    constructor() {
        /** @private */
        this._storagePrefix = "bind_";

        /** @private */
        this._defaults = {
            moveUp:    "W",
            moveDown:  "S",
            moveLeft:  "A",
            moveRight: "D",
            shoot:     "SPACE",
            dash:      "E",
            pause:     "ESC",
            settings:  "O",
            weaponPrev: "Q",
            weaponNext: "E"
        };

        /** @private */
        this._bindings = {};

        this.loadAll();
    }

    // -------------------------------------------------------------------------
    // Persistence
    // -------------------------------------------------------------------------

    /**
     * Loads all bindings from localStorage or falls back to defaults.
     */
    loadAll() {
        this._bindings = {};

        for (const action in this._defaults) {
            const stored = localStorage.getItem(this._storagePrefix + action);
            this._bindings[action] = stored || this._defaults[action];
        }
    }

    /**
     * Saves a single binding to localStorage.
     *
     * @param {string} action - The action key (e.g., "moveUp").
     * @param {string} value - The key assigned to the action.
     */
    save(action, value) {
        this._bindings[action] = value;
        localStorage.setItem(this._storagePrefix + action, value);
    }

    /**
     * Resets all bindings to their default values and persists them.
     */
    resetToDefaults() {
        for (const action in this._defaults) {
            this.save(action, this._defaults[action]);
        }
    }

    // -------------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------------

    /**
     * Returns the Phaser-ready keycode for a given action.
     *
     * @param {string} action - The action key.
     * @returns {number|string} A Phaser keycode or raw string fallback.
     */
    get(action) {
        const raw = this._bindings[action];

        // Return translated keycode if available
        if (KEY_TRANSLATION_MAP[raw] !== undefined) {
            return KEY_TRANSLATION_MAP[raw];
        }

        // Fallback: return raw string (safe for letters)
        return raw;
    }

    /**
     * Assigns a new key to an action and persists it.
     *
     * @param {string} action - The action key.
     * @param {string} value - The new keyboard key.
     */
    set(action, value) {
        this.save(action, value);
    }

    /**
     * Returns an object containing all bindings.
     * Useful for debugging or exporting.
     *
     * @returns {Object<string,string>}
     */
    getAll() {
        return { ...this._bindings };
    }
}

// -----------------------------------------------------------------------------
// Global Singleton
// -----------------------------------------------------------------------------
export const Keybindings = new KeybindingManager();
