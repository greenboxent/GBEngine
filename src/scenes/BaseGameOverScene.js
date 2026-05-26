/**
 * @module scenes/BaseGameOverScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton, createText } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';

/**
 * Modal scene displayed when the player dies.
 *
 * Shows the final score and presents Retry / Main Menu buttons.
 * Receives `stats` and `level` via `init(data)` from ModalManager.
 *
 * Override hooks:
 * - `_buildStats(cx, y, stats, score)` — add game-specific stat rows below the score
 * - `_buildButtons(cx, y, score)` — customise or add extra action buttons
 * - `_getTitle()` — override for a custom title string
 * - `_calculateScore(stats)` — compute the final score from the stats object
 */
export default class BaseGameOverScene extends Phaser.Scene {
    /** @param {string} [key='GameOverScene'] */
    constructor(key = 'GameOverScene') {
        super(key);
        this.stats          = null;
        this.level          = 1;
        this.finalScore     = 0;
        this.modal          = null;
        this.buttons        = [];
        this.selectedIndex  = 0;
        this.inputController = null;
        this.inputCooldown  = 0;
    }

    /**
     * Receives data from ModalManager.
     * @param {object} data             Payload forwarded by ModalManager.
     * @param {object} [data.stats]  Game stats object passed to `_calculateScore`.
     * @param {number} [data.level]  Level the player died on.
     */
    init(data) {
        this.stats      = data?.stats || {};
        this.level      = data?.level || 1;
        this.finalScore = this._calculateScore(this.stats);
    }

    /**
     * Builds the game-over modal with title, score, stats and action buttons.
     * @override
     */
    create() {
        const { width, height } = this.scale;
        this.modal = new ModalBase(this, {
            width:  Math.min(500, width  * 0.85),
            height: Math.min(420, height * 0.70),
            padding: 28,
        });

        const cx = width  / 2;
        const cy = height / 2;
        let   y  = cy - 160;

        createText(this, cx, y, this._getTitle(), { fontSize: '28px', color: '#ff4444' }).setOrigin(0.5);
        y += 50;
        createText(this, cx, y, `Score: ${this.finalScore.toLocaleString()}`, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
        y += 36;

        y = this._buildStats(cx, y, this.stats, this.finalScore);

        this.buttons = this._buildButtons(cx, y + 20, this.finalScore);
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

    /** @returns {string} Heading displayed at the top of the panel. */
    _getTitle() { return 'GAME OVER'; }

    /**
     * Compute the final score from stats.
     * Override to use your own ScoreManager.
     * @param {object} stats  Game stats passed from `init(data)`.
     * @returns {number}
     */
    _calculateScore(_stats) { return 0; }

    /**
     * Render game-specific stat rows below the score.
     * @param {number} cx    Centre X
     * @param {number} y     Starting Y
     * @param {object} stats  Stats object from init data.
     * @param {number} score  Pre-calculated final score.
     * @returns {number}     Y after last stat row
     */
    _buildStats(cx, y, _stats, _score) { return y; }

    /**
     * Build and return the action buttons.
     * @param {number} cx   Centre X
     * @param {number} y    Starting Y
     * @param {number} score  Pre-calculated final score; available for subclass overrides.
     * @returns {Array}
     */
    _buildButtons(cx, y, _score) {
        const ctrl = this.scene.get('SceneController');
        const retry = createMenuButton(this, cx, y,      'Retry',     () => ctrl.restartAfterGameOver(this.level));
        const menu  = createMenuButton(this, cx, y + 55, 'Main Menu', () => ctrl.returnToMenu());
        return [retry, menu];
    }

    // -------------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------------

    /**
     * Wires up keyboard and gamepad navigation for the game-over buttons.
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
    _selectCurrent() { this.buttons[this.selectedIndex]?.emit('pointerdown'); }
    /** @private Highlights button at `idx`, dims all others. @param {number} idx  Zero-based button index. */
    _highlightButton(idx) { this.buttons.forEach((b, i) => b.setAlpha(i === idx ? 1 : 0.6)); }
}
