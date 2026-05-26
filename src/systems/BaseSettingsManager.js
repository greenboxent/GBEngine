/**
 * Cross-device settings persistence (Firebase → localStorage fallback)
 * for fields common to every Gamebase game.
 * @module systems/BaseSettingsManager
 */

import { Debug } from '../engine/Debug.js';

/**
 * Base class for cross-device settings persistence.
 *
 * Provides Firebase → localStorage fallback persistence for fields common to
 * every Gamebase game: `playerName`, `musicVolume`, `levelMusicVolume`,
 * `sfxVolume`, `difficulty`, `keyboardLayout`, `gamepadLayout`,
 * `controllerEnabled`, `fullscreen`, `adsRemoved`.
 *
 * Subclass this and export a singleton; call `load()` once in BootScene.
 *
 * @example
 * class Settings extends BaseSettingsManager {
 *   constructor() {
 *     super();
 *     this._defaults.fogEnabled = false; // add game-specific defaults
 *   }
 *   get fogEnabled()  { return this._data.fogEnabled; }
 *   set fogEnabled(v) { this._data.fogEnabled = v; this.save(); }
 * }
 * export const Settings = new Settings();
 * await Settings.load(); // call once in BootScene
 */
export class BaseSettingsManager {
    /**
     * Creates a new settings manager.
     * You should never instantiate this directly — create a subclass and export a singleton.
     *
     * @param {object} [firebaseService] Optional FirebaseService singleton.
     *                                   If omitted, only localStorage is used.
     */
    constructor(firebaseService = null) {
        /** @protected */
        this._fb = firebaseService;

        /** @protected @type {string} localStorage key — override in subclasses */
        this._storageKey = 'game_settings_v1';

        /** @protected @type {string} Firebase Realtime DB root node — override in subclasses */
        this._firebaseRoot = 'settings';

        /**
         * @protected
         * Default values for all shared settings.
         * Subclasses may extend this object in their own constructor.
         */
        this._defaults = {
            playerName:        '',
            controllerEnabled: true,
            keyboardLayout:    'WASD',
            gamepadLayout:     'Xbox',
            musicVolume:       1.0,
            levelMusicVolume:  0.2,
            sfxVolume:         1.0,
            fullscreen:        false,
            difficulty:        'easy',
            adsRemoved:        false,
        };

        /** @protected */
        this._data = {};
    }

    // -------------------------------------------------------------------------
    // Persistence
    // -------------------------------------------------------------------------

    /**
     * Load settings from Firebase (if available) or localStorage.
     * Awaited once during BootScene before the game starts.
     *
     * @returns {Promise<void>}
     */
    async load() {
        // Do not call this._fb.init() here — caller must initialise Firebase
        // with the app config before calling load(). We just check isReady().
        let settingsData = null;

        if (this._fb?.isReady()) {
            try {
                const { ref, get } = this._fb.getFunctions();
                const uid  = this._fb.getPlayerId();
                const snap = await get(ref(this._fb.getDatabase(), `${this._firebaseRoot}/${uid}`));
                if (snap.exists()) {
                    settingsData = snap.val();
                    Debug.log('Settings', 'Loaded from Firebase');
                }
            } catch (error) {
                Debug.error('Settings', 'Firebase load failed:', error);
            }
        }

        if (!settingsData) {
            try {
                const raw = localStorage.getItem(this._storageKey);
                if (raw) {
                    settingsData = JSON.parse(raw);
                    Debug.log('Settings', 'Loaded from localStorage');
                }
            } catch {
                Debug.error('Settings', 'localStorage load failed');
            }
        }

        this._data = { ...this._defaults, ...settingsData };
    }

    /**
     * Persist settings to localStorage immediately; sync to Firebase in background.
     */
    save() {
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(this._data));
        } catch (err) {
            Debug.warn('Settings', 'localStorage save failed:', err);
        }

        if (this._fb?.isReady() && this._data.playerName) {
            const uid = this._fb.getPlayerId();
            const { ref, set } = this._fb.getFunctions();
            (async () => {
                try {
                    await set(ref(this._fb.getDatabase(), `${this._firebaseRoot}/${uid}`), this._data);
                    Debug.log('Settings', 'Synced to Firebase');
                } catch (error) {
                    Debug.error('Settings', 'Firebase sync failed:', error);
                }
            })();
        }
    }

    /**
     * Reset all settings to defaults and save.
     */
    resetToDefaults() {
        this._data = { ...this._defaults };
        this.save();
    }

    // -------------------------------------------------------------------------
    // Generic read / write helpers
    // -------------------------------------------------------------------------

    /**
     * Read a setting value (with optional default fallback).
     *
     * @param {string} key       Setting key to read.
     * @param {*}      [fallback]  Value to return when the key is absent.
     * @returns {*}
     */
    get(key, fallback = undefined) {
        return this._data[key] !== undefined ? this._data[key] : fallback;
    }

    /**
     * Write a setting value and save.
     *
     * @param {string} key    Setting key to write.
     * @param {*}      value  New value to store.
     */
    set(key, value) {
        this._data[key] = value;
        this.save();
    }

    // -------------------------------------------------------------------------
    // Shared settings — getters & setters
    // -------------------------------------------------------------------------

    get playerName()              { return this._data.playerName        ?? ''; }
    set playerName(v)             { this._data.playerName = v;        this.save(); }

    get controllerEnabled()       { return this._data.controllerEnabled   ?? true; }
    set controllerEnabled(v)      { this._data.controllerEnabled = v;  this.save(); }

    get keyboardLayout()          { return this._data.keyboardLayout      ?? 'WASD'; }
    set keyboardLayout(v)         { this._data.keyboardLayout = v;     this.save(); }

    get gamepadLayout()           { return this._data.gamepadLayout       ?? 'Xbox'; }
    set gamepadLayout(v)          { this._data.gamepadLayout = v;      this.save(); }

    get musicVolume()             { return this._data.musicVolume         ?? 1.0; }
    set musicVolume(v)            { this._data.musicVolume = v;         this.save(); }

    get levelMusicVolume()        { return this._data.levelMusicVolume    ?? 0.2; }
    set levelMusicVolume(v)       { this._data.levelMusicVolume = v;   this.save(); }

    get sfxVolume()               { return this._data.sfxVolume           ?? 1.0; }
    set sfxVolume(v)              { this._data.sfxVolume = v;           this.save(); }

    get fullscreen()              { return this._data.fullscreen          ?? false; }
    set fullscreen(v)             { this._data.fullscreen = v;           this.save(); }

    get difficulty()              { return this._data.difficulty          ?? 'easy'; }
    set difficulty(v)             { this._data.difficulty = v;           this.save(); }

    get adsRemoved()              { return this._data.adsRemoved          ?? false; }
    set adsRemoved(v)             { this._data.adsRemoved = v;           this.save(); }

    // -------------------------------------------------------------------------
    // Player name index — uniqueness enforcement
    // -------------------------------------------------------------------------

    /**
     * Normalise a player name to a Firebase-safe key.
     * Lowercases, replaces dots with `_dot_`, and strips `# $ [ ] /`.
     * @private
     * @param {string} name  Raw player name to sanitise.
     * @returns {string}
        return name.toLowerCase().replace(/\./g, '_dot_').replace(/[#$[\]/]/g, '_');
    }

    /**
     * Returns true if the name is unclaimed or owned by the current player.
     * Fails open (returns true) when Firebase is not ready.
     * @param {string} name  Player name to check uniqueness for.
     * @returns {Promise<boolean>}
     */
    async checkPlayerNameAvailable(name) {
        if (!this._fb?.isReady() || !name) return true;
        try {
            const { ref, get } = this._fb.getFunctions();
            const key  = this._sanitizeNameKey(name);
            const snap = await get(ref(this._fb.getDatabase(), `playerNames/${key}`));
            if (!snap.exists()) return true;
            return snap.val() === this._fb.getPlayerId();
        } catch {
            return true; // fail open
        }
    }

    /**
     * Write the current player's UID into the playerNames index for `newName`.
     * Releases `oldName` from the index if it differs and is owned by this player.
     * Fire-and-forget; safe to call without await.
     * @param {string} newName          New display name to register in the index.
     * @param {string|null} [oldName]   Previous name to release from the index, if any.
     */
    async claimPlayerName(newName, oldName = null) {
        if (!this._fb?.isReady() || !newName) return;
        try {
            const { ref, set, get } = this._fb.getFunctions();
            const db     = this._fb.getDatabase();
            const uid    = this._fb.getPlayerId();
            const newKey = this._sanitizeNameKey(newName);
            await set(ref(db, `playerNames/${newKey}`), uid);
            if (oldName && oldName !== newName) {
                const oldKey  = this._sanitizeNameKey(oldName);
                const oldSnap = await get(ref(db, `playerNames/${oldKey}`));
                if (oldSnap.exists() && oldSnap.val() === uid) {
                    await set(ref(db, `playerNames/${oldKey}`), null);
                }
            }
        } catch (err) {
            Debug.error('Settings', 'claimPlayerName failed:', err);
        }
    }

    /**
     * Returns an enemy-count multiplier based on current difficulty.
     * Override in a subclass if the game uses a different scale.
     *
     * @returns {number}  1 = easy, 2 = medium, 4 = hard
     */
    getDifficultyMultiplier() {
        switch (this.difficulty) {
            case 'medium': return 2;
            case 'hard':   return 4;
            default:       return 1;
        }
    }
}
