/**
 * @module scenes/BaseMainMenuScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton } from '../ui/ui.js';
import { InputController }  from '../systems/InputController.js';
import { SoundManager }     from '../systems/SoundManager.js';

/**
 * Game-agnostic main menu scene.
 *
 * Renders a centred modal panel containing a title/logo area and a
 * dynamically-spaced list of buttons.  Supports keyboard, gamepad, and
 * touch navigation out of the box.
 *
 * Override hooks:
 * - `_buildMenuItems()` — return `Array<{label, callback, [theme]}>` for the buttons
 * - `_buildTitle()` — add a title graphic or text above the buttons
 * - `_onWake()` — called each time the scene wakes from sleep
 * - `_bgMusicKey` — set in your constructor to auto-play background music
 *
 * @example
 * export default class MainMenuScene extends BaseMainMenuScene {
 *   constructor() {
 *     super('MainMenuScene');
 *     this._bgMusicKey = 'menuMusic';
 *   }
 *   _buildMenuItems() {
 *     const ctrl = this.scene.get('SceneController');
 *     return [
 *       { label: 'Play',     callback: () => ctrl.startGame(1) },
 *       { label: 'Settings', callback: () => ctrl.openSettings() },
 *     ];
 *   }
 * }
 */
export default class BaseMainMenuScene extends Phaser.Scene {
    /** @param {string} [key='MainMenuScene'] */
    constructor(key = 'MainMenuScene') {
        super(key);
        /** @type {ModalBase|null}  */ this.modal         = null;
        /** @type {Array}           */ this.buttons        = [];
        /** @type {number}          */ this.selectedIndex  = 0;
        /** @type {InputController} */ this.inputController = null;
        /** @type {number}          */ this.inputCooldown  = 0;
        /** @protected @type {string|null} */ this._bgMusicKey = null;
    }

    /**
     * Builds the menu modal, title, buttons, and wires up input and music.
     * @override
     */
    async create() {
        const { width, height } = this.scale;
        this.modal = new ModalBase(this, this._getModalConfig(width, height));

        this._buildTitle();

        const items    = this._buildMenuItems();
        const centerX  = this.modal.getCenterX();
        const contentY = this.modal.getContentStartY();
        const bottomY  = this.modal.getBottomY();
        const available = bottomY - contentY;
        const numBtns  = items.length;

        const btnFsNum = Math.max(16, Math.min(26, Math.round(height * 0.030)));
        const btnFs    = `${btnFsNum}px`;

        // minStep must cover the actual rendered button height.
        // uiButton image background scales to (textH + padding*1.5) * 1.3 tall,
        // where textH ≈ fontSize * 1.3 and padding = 20.
        // visual height ≈ fontSize * 1.69 + 39.  Add 16px breathing room.
        const minStep     = Math.round(btnFsNum * 1.69 + 55);
        // Cap the step so buttons don't spread absurdly far on large screens.
        const maxStep     = Math.round(minStep * 1.6);
        const maxTitleGap = Math.round(Math.min(80, available * 0.20));
        const roomForBtns = available - maxTitleGap;
        const titleGap    = roomForBtns >= numBtns * minStep
            ? maxTitleGap
            : Math.max(16, available - numBtns * minStep);
        const rawStep     = Math.round((available - titleGap) / numBtns);
        const step        = Math.min(maxStep, Math.max(minStep, rawStep));

        let y = contentY + titleGap;

        this.buttons = items.map((item) => {
            const btn = createMenuButton(this, centerX, y, item.label, item.callback,
                Object.assign({ fontSize: btnFs }, item.theme));
            y += step;
            return btn;
        });

        this._setupInput();
        this._highlightButton(0);

        if (this._bgMusicKey) this._playBgMusic();

        this.events.on('wake', this._onWake, this);
    }

    /** @override */
    update() {
        if (this.inputCooldown > 0) { this.inputCooldown--; return; }
        this.inputController?.update();
    }

    // -------------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------------

    /**
     * Return the ModalBase config for this menu. Override to customise layout.
     * @param {number} width   Canvas width in pixels.
     * @param {number} height  Canvas height in pixels.
     * @returns {object}
     */
    _getModalConfig(width, height) {
        return {
            width:   Math.min(520, width  * 0.85),
            height:  Math.min(480, height * 0.75),
            padding: 32,
        };
    }

    /**
     * Return the button definitions for this menu.
     * @returns {Array.<{label: string, callback: Function, theme: object}>}
     */
    _buildMenuItems() { return []; }

    /** Build and position the scene title/logo. Override to customise. */
    _buildTitle() {}

    /** Called when the scene wakes from sleep. */
    _onWake() {
        this.selectedIndex = 0;
        this._highlightButton(0);
        this.inputCooldown = 10;
        this.inputController?.bindToScene(this);
        this.inputController?.resetMenuState();
        // Resume audio context (may be suspended after Android share sheet / app backgrounding)
        this.sound.context?.resume().catch(() => {});
        if (this._bgMusicKey) this._playBgMusic();
    }

    // -------------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------------

    /**
     * Sets up keyboard and gamepad navigation for the menu buttons.
     * @private
     */
    _setupInput() {
        this.inputController = new InputController(this, {
            onUp:     () => this._navigate(-1),
            onDown:   () => this._navigate(1),
            onSelect: () => this._selectCurrent(),
        });
    }

    /**
     * Moves the button highlight by `dir` steps (+1 down, -1 up).
     * @private
     * @param {number} dir  +1 to move down, -1 to move up.
     */
    _navigate(dir) {
        this.selectedIndex = (this.selectedIndex + dir + this.buttons.length) % this.buttons.length;
        this._highlightButton(this.selectedIndex);
    }

    /**
     * Activates the currently highlighted button.
     * @private
     */
    _selectCurrent() {

    /**
     * Highlights the button at `idx` and dims all others.
     * @private
     * @param {number} idx  Zero-based index of the button to highlight.
     */
    _highlightButton(idx) {

    // -------------------------------------------------------------------------
    // Music
    // -------------------------------------------------------------------------

    /**
     * Starts or resumes the background music track set by `_bgMusicKey`.
     * @private
     */
    _playBgMusic() {
        let sm = SoundManager.getInstance();
        if (!sm) sm = SoundManager.init(this);
        // Re-bind to this scene in case it changed (e.g. after sleep/wake cycle)
        sm.scene = this;
        const track = sm.currentMusic ? sm.music.get(sm.currentMusic) : null;
        if (!track || !track.isPlaying) {
            // Clean up stale reference if track object is gone
            if (sm.currentMusic && !track) {
                sm.music.delete(sm.currentMusic);
                sm.currentMusic = null;
            }
            sm.playMusic(this._bgMusicKey, { volume: 0.5 });
        }
    }
}
