/**
 * @module scenes/BaseKeybindingsScene
 */

import * as Phaser from 'phaser';
import ModalBase from '../systems/scene/ModalBase.js';
import { createMenuButton } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';
import { Keybindings } from '../systems/KeybindingManager.js';

/**
 * Keyboard remapping UI scene.
 *
 * Renders a row for each action returned by `_getBindingRows()`, showing
 * the action label and the currently bound key.  Clicking a key label enters
 * rebind mode: the next key pressed is saved via `KeybindingManager` and
 * applied to the live `InputController`.
 *
 * Override hooks:
 * - `_getBindingRows()` — return `Array<{action, label}>` for each remappable action
 * - `_onClose()` — called just before the modal closes
 */
export default class BaseKeybindingsScene extends Phaser.Scene {
    /**
     * @param {string} [key='KeybindingsScene']
     * @param {string} [controllerKey='SceneController']
     */
    constructor(key = 'KeybindingsScene', controllerKey = 'SceneController') {
        super(key);
        this._controllerKey  = controllerKey;
        this.modal           = null;
        this.inputController = null;
        this.inputCooldown   = 0;
        this._rebinding      = null;
        this._rowTexts       = {};
        this._rows           = [];
    }

    /**
     * Builds the keybindings panel with a row for each action.
     * @override
     */
    create() {
        const { width, height } = this.scale;

        this.inputController = InputController.getInstance(this);

        this.modal = new ModalBase(this, {
            layout:  'panel',
            width:   Math.min(width  * 0.88, 540),
            height:  Math.min(height * 0.90, 600),
            padding: 28,
        });

        this.modal.createTitle('Key Bindings');

        const cx   = this.modal.getCenterX();
        const topY = this.modal.getContentStartY();
        const botY = this.modal.getBottomY();

        const fs   = Math.max(14, Math.min(22, Math.round(height * 0.028)));
        const fsPx = `${fs}px`;

        this._rows = this._getBindingRows();
        const rows = this._rows;

        // Distribute rows evenly between topY and the button row
        const available = botY - 44 - topY;
        const rowH      = Math.min(52, Math.round(available / (rows.length + 1)));

        let y = topY + rowH * 0.4;

        // "Press a key to rebind" status line
        this._statusText = this.add.text(cx, y, '', {
            fontFamily: 'Arial', fontSize: fsPx, color: '#ffcc00', align: 'center'
        }).setOrigin(0.5, 0).setDepth(99999);
        y += Math.round(rowH * 0.7);

        const labelX = cx - 20;
        const keyX   = cx + 24;

        rows.forEach(row => {
            const name = this._resolveKeyName(Keybindings.get(row.action));

            this.add.text(labelX, y, row.label, {
                fontFamily: 'Arial', fontSize: fsPx, color: '#cccccc'
            }).setOrigin(1, 0.5).setDepth(99999);

            const keyText = this.add.text(keyX, y, name, {
                fontFamily: 'Arial', fontSize: fsPx, color: '#44aaff',
                backgroundColor: '#222222', padding: { x: 10, y: 5 }
            }).setOrigin(0, 0.5).setDepth(99999).setInteractive({ useHandCursor: true });

            keyText.on('pointerdown', () => this._startRebind(row.action, keyText));
            keyText.on('pointerover', () => { if (this._rebinding !== row.action) keyText.setColor('#88ccff'); });
            keyText.on('pointerout',  () => { if (this._rebinding !== row.action) keyText.setColor('#44aaff'); });
            this._rowTexts[row.action] = keyText;

            y += rowH;
        });

        // Side-by-side buttons at bottom
        const btnGap = Math.min(110, width * 0.18);
        createMenuButton(this, cx - btnGap, botY, 'Reset', () => {
            Keybindings.resetToDefaults();
            if (this.inputController) this.inputController.refresh();
            rows.forEach(r => {
                if (this._rowTexts[r.action]) {
                    this._rowTexts[r.action].setText(this._resolveKeyName(Keybindings.get(r.action)));
                    this._rowTexts[r.action].setColor('#44aaff');
                }
            });
            this._rebinding = null;
            this._statusText.setText('');
        }, { fontSize: fsPx });

        createMenuButton(this, cx + btnGap, botY, 'Close', () => this._close(), { fontSize: fsPx });

        this.inputCooldown = 3;
    }

    /** @override */
    update() {
        if (this.inputCooldown > 0) { this.inputCooldown--; return; }

        if (this._rebinding) {
            this.input.keyboard.on('keydown', this._onKeyDown, this);
            return;
        }

        if (this.inputController) {
            this.inputController.update();
            if (this.inputController.menuBack) {
                this.inputController.menuBack = false;
                this._close();
            }
        }
    }

    // -------------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------------

    /** @returns {Array<{action: string, label: string}>} */
    _getBindingRows() { return []; }

    /** Called just before the panel closes. Override for cleanup. */
    _onClose() {}

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /**
     * Enters rebind mode for the given action.
     * Highlights the key label and waits for the next key press.
     * @private
     * @param {string} action - The action identifier to rebind.
     * @param {Phaser.GameObjects.Text} text - The text object to update.
     */
    _startRebind(action, text) {
        // Clear previous listener to avoid doubles
        this.input.keyboard.off('keydown', this._onKeyDown, this);

        // Dim any previously active key text
        Object.values(this._rowTexts).forEach(t => t.setColor('#44aaff'));

        this._rebinding = action;
        text.setColor('#ffcc00');
        text.setText('Press key…');
        this._statusText.setText('Press any key to bind, or ESC to cancel');
    }

    /**
     * Handles a key-down event during rebind mode.
     * ESC cancels; any other key is saved and applied.
     * @private
     * @param {KeyboardEvent} event  Native keyboard event from the DOM listener.
     */
    _onKeyDown(event) {
        this.input.keyboard.off('keydown', this._onKeyDown, this);

        if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.ESC) {
            // Cancel — restore previous value
            const prev = this._resolveKeyName(Keybindings.get(this._rebinding));
            if (this._rowTexts[this._rebinding]) {
                this._rowTexts[this._rebinding].setText(prev);
                this._rowTexts[this._rebinding].setColor('#44aaff');
            }
            this._rebinding = null;
            this._statusText.setText('');
            return;
        }

        const keyName = this._keycodeToName(event.keyCode);
        Keybindings.set(this._rebinding, keyName);
        if (this.inputController) this.inputController.refresh();

        if (this._rowTexts[this._rebinding]) {
            this._rowTexts[this._rebinding].setText(keyName);
            this._rowTexts[this._rebinding].setColor('#44aaff');
        }
        this._rebinding = null;
        this._statusText.setText('');
    }

    /**
     * Closes the keybindings modal and calls `_onClose`.
     * @private
     */
    _close() {
        this._onClose();
        const ctrl = this.scene.get(this._controllerKey);
        ctrl?.flow?.modal?.closeModal(this.sys.settings.key);
    }

    /** Converts a stored binding value (string name or numeric keycode) to a display string. */
    _resolveKeyName(value) {
        if (!value && value !== 0) return '?';
        if (typeof value === 'string') return value;
        return this._keycodeToName(value);
    }

    /** Reverse-looks up a numeric keycode to a display name string.
     * @private
     * @param {number} code  Phaser keycode integer to look up.
     * @returns {string}
     */
    _keycodeToName(code) {
        const codes = Phaser.Input.Keyboard.KeyCodes;
        for (const name in codes) {
            if (codes[name] === code) return name;
        }
        return String.fromCharCode(code);
    }
}
