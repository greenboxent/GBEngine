/**
 * @module scenes/BasePauseScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton } from '../ui/ui.js';
import { InputController }  from '../systems/InputController.js';

/**
 * Modal overlay displayed when the player pauses the game.
 *
 * Default buttons: Resume, Settings, Main Menu.
 * Override `_buildButtons(cx, y)` to provide a custom button list.
 */
export default class BasePauseScene extends Phaser.Scene {
    /** @param {string} [key='PauseScene'] */
    constructor(key = 'PauseScene') {
        super(key);
        this.modal          = null;
        this.buttons        = [];
        this.selectedIndex  = 0;
        this.inputController = null;
        this.inputCooldown  = 0;
    }

    /**
     * Builds the pause modal overlay with PAUSED heading and action buttons.
     * @override
     */
    create() {
        const { width, height } = this.scale;
        this.modal = new ModalBase(this, {
            width:  Math.min(400, width  * 0.75),
            height: Math.min(300, height * 0.50),
            padding: 28,
        });

        const cx = width  / 2;
        const cy = height / 2;

        this.add.text(cx, cy - 100, 'PAUSED', {
            fontSize: '28px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(99999);

        this.buttons = this._buildButtons(cx, cy - 36);
        this._highlightButton(0);
        this._setupInput();
    }

    /** @override */
    update() {
        if (this.inputCooldown > 0) { this.inputCooldown--; return; }
        this.inputController?.update();
    }

    // -------------------------------------------------------------------------
    // Hook
    // -------------------------------------------------------------------------

    /**
     * Build and return the pause menu button list.
     * @param {number} cx  Centre X.
     * @param {number} y   Starting Y for the first button.
     * @returns {Array}
     */
    _buildButtons(cx, y) {
        const ctrl = this.scene.get('SceneController');
        return [
            createMenuButton(this, cx, y,        'Resume',    () => ctrl.resumeGame()),
            createMenuButton(this, cx, y + 55,   'Settings',  () => ctrl.openSettings()),
            createMenuButton(this, cx, y + 110,  'Main Menu', () => ctrl.returnToMenu()),
        ];
    }

    // -------------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------------

    /**
     * Sets up keyboard and gamepad navigation for the pause menu.
     * @private
     */
    _setupInput() {
        this.inputController = new InputController(this, {
            onUp:     () => this._navigate(-1),
            onDown:   () => this._navigate(1),
            onSelect: () => this._selectCurrent(),
            onBack:   () => this.scene.get('SceneController')?.resumeGame(),
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

    /** @private Activates the currently highlighted button. */
    _selectCurrent()   { this.buttons[this.selectedIndex]?.emit('pointerdown'); }
    /** @private Highlights button at `idx`, dims all others. @param {number} idx  Zero-based button index. */
    _highlightButton(idx) { this.buttons.forEach((b, i) => b.setAlpha(i === idx ? 1 : 0.6)); }
}
