/**
 * @module scenes/BaseWebLimitScene
 */

import * as Phaser from 'phaser';
import ModalBase from '../systems/scene/ModalBase.js';
import { createMenuButton, createText, highlightMenuButtons } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';

/**
 * Dialog shown when the web demo's level limit is reached (see `createWebLimit`).
 * Launched on top of the calling scene; closing it just stops this scene.
 *
 * Override hooks:
 * - `_getLimit()` — the object returned by `createWebLimit()` (required)
 * - `_getTitle()` / `_getMessage()` — texts
 *
 * @example
 * export default class WebLimitScene extends BaseWebLimitScene {
 *   constructor() { super('WebLimitScene'); }
 *   _getLimit() { return webLimit; }
 * }
 */
export default class BaseWebLimitScene extends Phaser.Scene {
    /** @param {string} [key='WebLimitScene'] */
    constructor(key = 'WebLimitScene') {
        super(key);
        this._sceneKey = key;
    }

    /** @returns {{freeLevels:number, storeUrl:string}} */
    _getLimit() { throw new Error('BaseWebLimitScene: override _getLimit()'); }

    _getTitle()   { return 'Keep Playing on Android'; }
    _getMessage() {
        return `The web version includes the first ${this._getLimit().freeLevels} levels.\n\n` +
               'Play the Android version to continue the adventure!';
    }

    create() {
        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;
        const textWidth = Math.min(440, width * 0.88) - 56;

        // Swallows pointer input so nothing underneath this dialog is clickable.
        this.add.zone(cx, cy, width, height).setInteractive().setDepth(99997);

        this.modal = new ModalBase(this, {
            width:   Math.min(440, width  * 0.88),
            height:  Math.min(460, height * 0.82),
            padding: 28,
        });

        createText(this, cx, cy - 160, this._getTitle(), {
            fontSize: Math.round(Math.min(26, width * 0.055)) + 'px',
            color: '#ff6b35',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: textWidth },
        }).setOrigin(0.5).setDepth(99999);

        createText(this, cx, cy - 100, this._getMessage(), {
            fontSize: '18px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: textWidth },
        }).setOrigin(0.5, 0).setDepth(99999);

        this.buttons = [
            createMenuButton(this, cx, cy + 90,  'Get Android App', () => this._onGetApp(), { depth: 99999 }),
            createMenuButton(this, cx, cy + 170, 'Close',           () => this._close(),    { depth: 99999 }),
        ];
        this.selectedIndex = 0;
        this._highlightButton(0);

        this.inputController = InputController.getInstance(this);
        this.inputController.resetMenuState();
        this._cursors  = this.input.keyboard?.createCursorKeys();
        this._enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.input.keyboard?.on('keydown-ESC', () => this._close());
        this._cooldown = 200;
    }

    _highlightButton(index) {
        highlightMenuButtons(this.buttons, index, i => { this.selectedIndex = i; this._highlightButton(i); });
    }

    update(time, delta) {
        const ic = this.inputController;
        if (!ic) return;
        ic.update();
        this._cooldown -= delta ?? 16;

        if (this._cooldown > 0) {
            ic.menuUp = ic.menuDown = ic.menuSelect = ic.menuBack = false;
            return;
        }

        if (ic.menuBack) { ic.menuBack = false; this._close(); return; }

        let moved = false;
        if (this._cursors?.up?.isDown || ic.menuUp) {
            this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
            moved = true;
        } else if (this._cursors?.down?.isDown || ic.menuDown) {
            this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
            moved = true;
        }
        if (moved) {
            this._highlightButton(this.selectedIndex);
            this._cooldown = 180;
        }

        if ((this._enterKey && Phaser.Input.Keyboard.JustDown(this._enterKey)) || ic.menuSelect) {
            this.buttons[this.selectedIndex]?.emit('pointerdown');
        }
        ic.menuUp = ic.menuDown = ic.menuSelect = false;
    }

    _onGetApp() {
        window.open(this._getLimit().storeUrl, '_blank', 'noopener');
    }

    _close() {
        this.scene.stop(this._sceneKey);
    }
}
