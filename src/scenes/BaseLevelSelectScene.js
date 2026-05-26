/**
 * @module scenes/BaseLevelSelectScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton, createText } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';

/**
 * Grid-based level selection screen.
 *
 * Renders a grid of numbered level buttons.  Locked levels are displayed
 * with a padlock icon and are not interactive.
 *
 * Override hooks:
 * - `_getLevelCount()` — total number of levels
 * - `_getHighestUnlocked()` — highest 1-based level index the player has reached
 * - `_getLevelLabel(level)` — display string for each unlocked button
 * - `_onLevelSelected(level)` — action when the player picks a level
 * - `_onBack()` — action for the Back button
 */
export default class BaseLevelSelectScene extends Phaser.Scene {
    /** @param {string} [key='LevelSelectScene'] */
    constructor(key = 'LevelSelectScene') {
        super(key);
        this.modal          = null;
        this._buttons       = [];
        this.selectedIndex  = 0;
        this.inputController = null;
        this.inputCooldown  = 0;
    }

    /**
     * Builds the level-select grid and Back button.
     * @override
     */
    create() {
        const { width, height } = this.scale;
        this.modal = new ModalBase(this, {
            width:  Math.min(560, width  * 0.88),
            height: Math.min(520, height * 0.82),
            padding: 24,
        });

        const cx = width / 2;

        createText(this, cx, height / 2 - 230, 'SELECT LEVEL', {
            fontSize: '22px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(99999);

        const count    = this._getLevelCount();
        const unlocked = this._getHighestUnlocked();
        const cols     = Math.min(5, count);
        const cellW    = 72;
        const cellH    = 60;
        const startX   = cx - ((cols - 1) * cellW) / 2;
        const startY   = height / 2 - 160;

        this._buttons = [];
        for (let i = 0; i < count; i++) {
            const level = i + 1;
            const col   = i % cols;
            const row   = Math.floor(i / cols);
            const bx    = startX + col * cellW;
            const by    = startY + row * cellH;
            const locked = level > unlocked + 1;

            const label = locked ? '🔒' : this._getLevelLabel(level);
            const btn   = this.add.text(bx, by, label, {
                fontSize: '16px',
                color:    locked ? '#555555' : '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 10, y: 8 },
            }).setOrigin(0.5).setDepth(99999);

            if (!locked) {
                btn.setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => this._onLevelSelected(level));
                btn.on('pointerover', () => btn.setColor('#ffcc00'));
                btn.on('pointerout',  () => btn.setColor('#ffffff'));
            }
            this._buttons.push({ btn, level, locked });
        }

        createMenuButton(this, cx, height / 2 + 230, 'Back', () => this._onBack());
        this._setupInput();

    }

    /** @override */
    update() {
        if (this.inputCooldown > 0) { this.inputCooldown--; return; }
        this.inputController?.update();
    }

    // -------------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------------

    /** @returns {number} Total number of levels to display. Override in subclass. */
    _getLevelCount()          { return 1; }

    /** @returns {number} Index (1-based) of the highest level the player has unlocked. Override in subclass. */
    _getHighestUnlocked()     { return 1; }

    /**
     * Returns the display label for a level button.
     * @param {number} level - Level number (1-based).
     * @returns {string}
     */
    _getLevelLabel(level)     { return `Lv ${level}`; }

    /**
     * Called when the player selects a level. Starts that level by default.
     * Override to add confirmation dialogs or custom transition logic.
     * @param {number} level - Selected level number (1-based).
     */
    _onLevelSelected(level) {
        this.scene.get('SceneController')?.startGame(level);
    }

    /**
     * Called when the back button is pressed. Fades out and stops this scene by default.
     * Override to navigate to a different destination.
     */
    _onBack() {
        this.cameras.main.fadeOut(200);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.stop());
    }

    // -------------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------------

    /**
     * Wires up gamepad/keyboard back-button navigation.
     * @private
     */
    _setupInput() {
        this.inputController = new InputController(this, {
            onBack: () => this._onBack(),
        });
    }
}
