/**
 * @module scenes/BaseLevelCompleteScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton, createText } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';

/**
 * Modal scene displayed when the player completes a level.
 *
 * Shows the score, optional stat rows, and Next Level / Main Menu buttons.
 * Receives `stats` and `nextLevel` via `init(data)` from ModalManager.
 *
 * Override hooks:
 * - _buildStats(cx, y, stats, score) — render custom stat rows; return updated Y
 * - _buildButtons(cx, y, stats, nextLevel) — customise action buttons
 * - _getTitle() — override for a custom heading string
 * - _calculateScore(stats) — compute the final score from the stats object
 */
export default class BaseLevelCompleteScene extends Phaser.Scene {
    /** @param {string} [key='LevelCompleteScene'] */
    constructor(key = 'LevelCompleteScene') {
        super(key);
        this.stats         = null;
        this.nextLevel     = 1;
        this.finalScore    = 0;
        this.modal         = null;
        this.buttons       = [];
        this.selectedIndex = 0;
        this.inputController = null;
        this.inputCooldown = 0;
    }

    /**
     * Receives data from ModalManager.
     * @param {object} data             Payload forwarded by ModalManager.
     * @param {object} [data.stats]     Game stats passed to `_calculateScore`.
     * @param {number} [data.nextLevel] Level index to advance to.
     */
    init(data) {
        this.stats      = data?.stats     || {};
        this.nextLevel  = data?.nextLevel ?? 1;
        this.finalScore = this._calculateScore(this.stats);
    }

    /**
     * Builds the level-complete modal with title, score, stats and action buttons.
     * @override
     */
    create() {
        const { width, height } = this.scale;
        this.modal = new ModalBase(this, {
            width:  Math.min(500, width  * 0.85),
            height: Math.min(440, height * 0.72),
            padding: 28,
        });

        const cx = width  / 2;
        const cy = height / 2;
        let   y  = cy - 170;

        createText(this, cx, y, this._getTitle(), { fontSize: '26px', color: '#44ff88' }).setOrigin(0.5);
        y += 44;
        createText(this, cx, y, `Score: ${this.finalScore.toLocaleString()}`, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
        y += 36;

        y = this._buildStats(cx, y, this.stats, this.finalScore);

        this.buttons = this._buildButtons(cx, y + 20, this.stats, this.nextLevel);
        this._highlightButton(0);
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

    _getTitle() { return 'LEVEL COMPLETE!'; }

    /**
     * @param {object} stats  Game stats passed from `init(data)`.
     * @returns {number}
     */
    _calculateScore(_stats) { return 0; }

    /**
     * Render stat rows.  Return new y after last row.
     * @param {number} cx     Centre X for laying out text and objects.
     * @param {number} y      Starting Y below the score label.
     * @param {object} stats  Stats object received from init data.
     * @param {number} score  Pre-calculated final score.
     * @returns {number}
     */
    _buildStats(cx, y, _stats, _score) { return y; }

    /**
     * Build the action buttons.
     * @param {number} cx         Centre X.
     * @param {number} y          Starting Y below the stats rows.
     * @param {object} stats      Stats object; available for subclass overrides.
     * @param {number} nextLevel  Level index to advance to on Next Level.
     * @returns {Array}
     */
    _buildButtons(cx, y, _stats, nextLevel) {
        const ctrl = this.scene.get('SceneController');
        return [
            createMenuButton(this, cx, y,      'Next Level', () => ctrl.nextLevel(nextLevel)),
            createMenuButton(this, cx, y + 55, 'Main Menu',  () => ctrl.returnToMenu()),
        ];
    }

    // -------------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------------

    /**
     * Sets up keyboard and gamepad navigation for the level-complete buttons.
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

    /** @private Activates the currently highlighted button. */
    _selectCurrent()      { this.buttons[this.selectedIndex]?.emit('pointerdown'); }
    /** @private Highlights button at `idx`, dims all others. @param {number} idx  Zero-based button index. */
    _highlightButton(idx) { this.buttons.forEach((b, i) => b.setAlpha(i === idx ? 1 : 0.6)); }
}
