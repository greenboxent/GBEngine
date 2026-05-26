/**
 * @module scenes/BaseSceneController
 */

import * as Phaser from 'phaser';
import GameFlowManager    from '../systems/scene/GameFlowManager.js';
import ModalManager       from '../systems/scene/ModalManager.js';
import SceneStateManager  from '../systems/scene/SceneStateManager.js';
import TransitionManager  from '../systems/scene/TransitionManager.js';

/**
 * Perpetually-active top-level scene that orchestrates all scene transitions.
 *
 * Wires together {@link SceneStateManager}, {@link ModalManager},
 * {@link TransitionManager}, and {@link GameFlowManager} into a single
 * controller that stays alive for the entire game session.
 *
 * Override hooks:
 * - `_buildFlowManager(ctrl, state, modal, transition)` — return a
 *   {@link GameFlowManager} (or subclass) configured with your scene keys
 * - `_onReady()` — called after `create()`; launch your first scene here
 * - `_handleEsc()` — override to add game-specific ESC behaviour
 *
 * @example
 * export default class SceneController extends BaseSceneController {
 *   constructor() { super('SceneController'); }
 *   _buildFlowManager(ctrl, state, modal, transition) {
 *     return new GameFlowManager(ctrl, state, modal, transition, {
 *       keys: { mainMenu: 'MyMenu', game: 'CoreGame' },
 *     });
 *   }
 *   _onReady() { this.scene.launch('MainMenuScene'); }
 * }
 */
export default class BaseSceneController extends Phaser.Scene {
    /** @param {string} [key='SceneController'] */
    constructor(key = 'SceneController') {
        super({ key, active: true });

        /** @type {SceneStateManager|null}  */ this.stateManager      = null;
        /** @type {ModalManager|null}       */ this.modalManager      = null;
        /** @type {TransitionManager|null}  */ this.transitionManager = null;
        /** @type {GameFlowManager|null}    */ this.gameFlowManager   = null;
        /** @type {boolean} */ this.settingsOpen    = false;
        /** @type {boolean} */ this.keybindingsOpen = false;
    }

    /** Convenience accessor used by gameplay scenes. */
    get flow() { return this.gameFlowManager; }

    /**
     * Wires up all managers and calls `_onReady()`.
     * @override
     */
    create() {
        this.stateManager      = new SceneStateManager(this);
        this.transitionManager = new TransitionManager(this);
        this.modalManager      = new ModalManager(this, this.stateManager, this.transitionManager);
        this.gameFlowManager   = this._buildFlowManager(
            this, this.stateManager, this.modalManager, this.transitionManager
        );

        this.scene.bringToTop(this.sys.settings.key);

        this._onReady();
    }

    // -------------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------------

    /**
     * Build and return the GameFlowManager (or a subclass).
     * Override to inject scene keys, adService, or a custom subclass.
     *
     * @param {Phaser.Scene}       ctrl
     * @param {SceneStateManager}  state
     * @param {ModalManager}       modal
     * @param {TransitionManager}  transition
     * @returns {GameFlowManager}
     */
    _buildFlowManager(ctrl, state, modal, transition) {
        return new GameFlowManager(ctrl, state, modal, transition);
    }

    /**
     * Called after all managers are initialized.
     * Override to launch your first scene.
     */
    _onReady() {}

    /**
     * ESC / back-button handler.
     * Delegates by default; override to customise.
     */
    _handleEsc() {
        this.gameFlowManager?.handleEsc();
    }

    // Convenience shortcuts — delegate to GameFlowManager
    /** @param {number} [level=1] */ startGame(level = 1)                   { return this.gameFlowManager?.startGame(level); }
    /** Navigate to the main menu. */ mainMenu()                             { return this.gameFlowManager?.mainMenu(); }
    /** Pause the active game scene. */ pauseGame()                            { return this.gameFlowManager?.pauseGame(); }
    /** Resume from pause. */ resumeGame()                           { return this.gameFlowManager?.resumeGame(); }
    /** @param {object} stats @param {number} next */ levelComplete(stats, next)             { return this.gameFlowManager?.levelComplete(stats, next); }
    /** @param {number} idx */ nextLevel(idx)                         { return this.gameFlowManager?.nextLevel(idx); }
    /** @param {object} stats @param {number} level */ gameOver(stats, level)                 { return this.gameFlowManager?.gameOver(stats, level); }
    /** @param {number} level */ restartAfterGameOver(level)            { return this.gameFlowManager?.restartAfterGameOver(level); }
    /** Resume without restarting after a game-over screen. */ resumeFromGameOver()                   { return this.gameFlowManager?.resumeFromGameOver(); }
    /** Return to the main menu. */ returnToMenu()                         { return this.gameFlowManager?.returnToMenu(); }
    /** Open the level-select screen. */ openLevelSelect()                      { return this.gameFlowManager?.openLevelSelect(); }

    /**
     * Open the settings modal.
     * Subclass may override to handle custom settings scenes.
     */
    openSettings() {
        if (!this.settingsOpen) {
            this.settingsOpen = true;
            this.modalManager?.openSettings();
            this.scene.bringToTop(this.sys.settings.key);
        }
    }

    /** Close the settings modal. */
    closeSettings() {
        this.settingsOpen = false;
        this.modalManager?.closeSettings();
    }
}
