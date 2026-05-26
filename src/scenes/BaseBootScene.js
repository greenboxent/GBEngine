/**
 * @module scenes/BaseBootScene
 */

import * as Phaser from 'phaser';

/**
 * Game-agnostic boot scene that handles asset loading with a progress bar,
 * optional Firebase initialisation, settings loading, and the transition
 * to the first real scene.
 *
 * Override hooks:
 * - `_getLoadingText()` — change the loading label text
 * - `_loadGameAssets()` — add game-specific assets inside `preload()`
 * - `_onAllReady()` — called once Firebase + settings + assets are ready;
 *   navigate to your main menu here
 *
 * @example
 * export default class BootScene extends BaseBootScene {
 *   constructor() { super('BootScene'); }
 *   _loadGameAssets() { this.load.image('logo', 'assets/logo.png'); }
 *   async _onAllReady() { this.scene.start('MainMenuScene'); }
 * }
 */
export default class BaseBootScene extends Phaser.Scene {
    /**
     * @param {string} [key='BootScene']
     * @param {object} [options]
     * @param {object} [options.firebaseService]  FirebaseService singleton.
     * @param {object} [options.settings]         Settings instance (has .load()).
     */
    constructor(key = 'BootScene', options = {}) {
        super({ key, active: true });
        this._fb       = options.firebaseService ?? null;
        this._settings = options.settings        ?? null;
    }

    /**
     * Builds the progress-bar UI and starts loading all assets.
     * @override
     */
    preload() {
        const { width, height } = this._getDimensions();

        // Black background
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 1);
        bg.fillRect(0, 0, width, height);

        // Loading label
        this._loadingText = this.add.text(
            width / 2, height / 2 - 50,
            this._getLoadingText(),
            { fontSize: Math.round(Math.min(28, width * 0.05)) + 'px', color: '#ffffff' }
        ).setOrigin(0.5);

        // Progress bar
        const barW = Math.round(Math.min(400, width * 0.7));
        const barH = 40;
        const barX = width / 2 - barW / 2;
        const barY = height / 2;

        this._progressBox = this.add.graphics();
        this._progressBox.fillStyle(0x333333, 0.8);
        this._progressBox.fillRect(barX, barY, barW, barH);

        this._progressBar = this.add.graphics();

        this._percentText = this.add.text(width / 2, barY + barH / 2, '0%', {
            fontSize: Math.round(Math.min(16, width * 0.025)) + 'px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('progress', value => {
            this._progressBar.clear();
            this._progressBar.fillStyle(0x44aaff, 1);
            this._progressBar.fillRect(barX, barY, barW * value, barH);
            this._percentText.setText(Math.floor(value * 100) + '%');
        });

        this._loadSharedAssets();
        this._loadGameAssets();
    }

    /**
     * Tears down the loading UI and calls `_onAllReady()`.
     * @override
     */
    async create() {
        // Tear down loading UI
        this._progressBar?.destroy();
        this._progressBox?.destroy();
        this._percentText?.destroy();
        this._loadingText?.destroy();

        await this._onAllReady();
    }

    // -------------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------------

    /** Return the loading label text. */
    _getLoadingText() { return 'Loading…'; }

    /**
     * Preload hook — add your game assets here.
     * Called inside preload() after the progress bar is set up.
     * @example
     * _loadGameAssets() {
     *   this.load.image('logo', 'assets/logo.png');
     *   this.load.audio('music', 'assets/audio/menu.mp3');
     * }
     */
    _loadGameAssets() {}

    /**
     * Loads assets that live in the shared library (served at /shared-assets/).
     * Add shared UI assets here; games override _loadGameAssets() for their own.
     */
    _loadSharedAssets() {
        this.load.image('xbox_silhouette', 'shared-assets/images/xbox_controller.png');
    }

    /**
     * Called once Firebase and settings are ready.
     * Override to transition to your first real scene.
     * @returns {Promise<void>}
     */
    async _onAllReady() {
        this.scene.start('MainMenuScene');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Returns the screen dimensions. Override if you need custom sizing.
     * @private
     * @returns {{width: number, height: number}}
     */
    _getDimensions() {
        return { width: window.innerWidth, height: window.innerHeight };
    }
}
