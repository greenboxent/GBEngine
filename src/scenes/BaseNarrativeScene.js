/**
 * @module scenes/BaseNarrativeScene
 */

import * as Phaser from 'phaser';
import { createMenuButton, createText } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';

/**
 * Full-screen cutscene that displays a narrative title and body text,
 * then proceeds to the next scene when the player taps Done or presses a
 * confirm button.
 *
 * Receives via `init(data)`:
 * - `data.title` — heading string
 * - `data.text` — body paragraph
 * - `data.level` — level index to start after the narrative
 * - `data.worldIndex` — world index passed to `_onNarrativeDone`
 *
 * Override `_onNarrativeDone(level, worldIndex)` to control what happens
 * after the player confirms.
 */
export default class BaseNarrativeScene extends Phaser.Scene {
    /** @param {string} [key='NarrativeScene'] */
    constructor(key = 'NarrativeScene') {
        super(key);
        this._title       = '';
        this._text        = '';
        this._level       = 1;
        this._worldIndex  = 0;
        this.inputController = null;
        this.inputCooldown = 0;
    }

    /**
     * Receives narrative content from the scene that launched this one.
     * @param {object} data
     * @param {string} [data.title]      Heading text.
     * @param {string} [data.text]       Body paragraph.
     * @param {number} [data.level]      Level to start after the narrative.
     * @param {number} [data.worldIndex] World index forwarded to `_onNarrativeDone`.
     */
    init(data) {
        this._title      = data?.title      || '';
        this._text       = data?.text       || '';
        this._level      = data?.level      ?? 1;
        this._worldIndex = data?.worldIndex ?? 0;
    }

    /**
     * Renders the title, divider, body text and Done button.
     * @override
     */
    create() {
        const { width, height } = this.scale;
        // Dark background
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.88).setDepth(99990);

        const cx = width / 2;
        let   y  = height * 0.15;

        // Title
        createText(this, cx, y, this._title, {
            fontSize: '26px', color: '#ffcc00', fontStyle: 'bold',
            wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5).setDepth(99991);
        y += 56;

        // Divider
        const gfx = this.add.graphics().setDepth(99991);
        gfx.lineStyle(1, 0x666666, 1);
        gfx.lineBetween(width * 0.1, y, width * 0.9, y);
        y += 20;

        // Body text
        createText(this, cx, y, this._text, {
            fontSize: '16px', color: '#eeeeee',
            wordWrap: { width: width * 0.78 },
            lineSpacing: 8,
        }).setOrigin(0.5, 0).setDepth(99991);

        // Done button
        createMenuButton(this, cx, height * 0.85, 'Done', () => this._done());

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
     * Called when the player taps / selects "Done".
     * Default: tells SceneController to start the game at _level.
     *
     * @param {number} level       Level index passed from init data.
     * @param {number} worldIndex  World index passed from init data.
     */
    _onNarrativeDone(level, _worldIndex) {
        this.scene.get('SceneController')?.startGame(level);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /**
     * Fades out and triggers `_onNarrativeDone`.
     * @private
     */
    _done() {
        this.cameras.main.fadeOut(300);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop();
            this._onNarrativeDone(this._level, this._worldIndex);
        });
    }

    /**
     * Sets up keyboard and gamepad input (confirm = Done).
     * @private
     */
    _setupInput() {
        this.inputController = new InputController(this, {
            onSelect: () => this._done(),
        });
    }
}
