/**
 * High-level orchestrator of game flow: starting levels, returning to the main
 * menu, restarting after game over, and opening/closing modal scenes.
 * Delegates scene ordering to {@link ModalManager}, fades to
 * {@link TransitionManager}, and state queries to {@link SceneStateManager}.
 * Contains no rendering or gameplay logic.
 * @module systems/scene/GameFlowManager
 */

import * as Phaser from 'phaser';

/**
 * High-level orchestrator of game flow transitions.
 *
 * Coordinates starting levels, returning to the main menu, restarting after
 * game over, and opening / closing modal scenes.
 * Delegates scene ordering to {@link ModalManager}, fade transitions to
 * {@link TransitionManager}, and state queries to {@link SceneStateManager}.
 *
 * Contains **no** rendering or gameplay logic.
 */
export default class GameFlowManager {
    /**
     * @param {Phaser.Scene}        controllerScene   The SceneController instance.
     * @param {SceneStateManager}   stateManager      Provides scene state info.
     * @param {ModalManager}        modalManager      Handles modal scenes.
     * @param {TransitionManager}   transitionManager Handles fade transitions.
     * @param {object}              [config]          Optional configuration.
     * @param {object}              [config.keys]     Override scene key strings.
     * @param {object}              [config.adService] Ad service with showInterstitial(level).
     * @param {Function}            [config.getNarrative] (level)=>narrative|null override.
     */
    constructor(controllerScene, stateManager, modalManager, transitionManager, config = {}) {
        /** @type {Phaser.Scene} */
        this.controller = controllerScene;

        /** @type {SceneStateManager} */
        this.state = stateManager;

        /** @type {ModalManager} */
        this.modal = modalManager;

        /** @type {TransitionManager} */
        this.transition = transitionManager;

        /** @type {object} */
        this.adService = config.adService ?? null;

        /** @type {object} Scene key registry — override any key via config.keys */
        this.keys = {
            mainMenu:      'MainMenuScene',
            game:          'GameScene',
            controller:    'SceneController',
            pause:         'PauseScene',
            levelComplete: 'LevelCompleteScene',
            gameOver:      'GameOverScene',
            narrative:     'NarrativeScene',
            settings:      'SettingsScene',
            levelSelect:   'LevelSelectScene',
            ...(config.keys ?? {}),
        };

        // Push keys into ModalManager so it uses the same scene keys
        if (this.modal && typeof this.modal.setKeys === 'function') {
            this.modal.setKeys(this.keys);
        }

        /** @type {Function|null} Optional (level)=>narrative hook */
        this._getNarrativeHook = config.getNarrative ?? null;
    }

    // -------------------------------------------------------------------------
    // START GAME
    // -------------------------------------------------------------------------

    /**
     * Starts or restarts the game at the given level.
     *
     * @public
     * @param {number} [level=1]
     * @returns {Promise<void>}
     */
    async startGame(level = 1) {
        const K = this.keys;

        // Fade out MainMenu if active
        if (this.controller.scene.isActive(K.mainMenu)) {
            await this.transition.fadeOutScene(K.mainMenu, 200);
            this.controller.scene.sleep(K.mainMenu);
        }

        // Stop any existing GameScene
        const gameScene = this.controller.scene.get(K.game);
        if (gameScene && gameScene.stopAllGameMechanics) {
            gameScene.stopAllGameMechanics();
        }
        if (gameScene && (this.controller.scene.isActive(K.game) || this.controller.scene.isSleeping(K.game))) {
            if (gameScene.sound) gameScene.sound.stopAll();
            this.controller.scene.stop(K.game);
        }

        // Launch fresh GameScene
        this.controller.scene.launch(K.game, { level });

        // Ensure SceneController stays on top
        this.controller.scene.bringToTop(K.controller);

        // Fade in GameScene
        await this.transition.fadeInScene(K.game, 200);

        this.controller.scene.bringToTop(K.controller);
    }

    // -------------------------------------------------------------------------
    // MAIN MENU
    // -------------------------------------------------------------------------

    /**
     * Returns to the main menu.
     *
     * @public
     * @returns {Promise<void>}
     */
    async mainMenu() {
        const K = this.keys;

        const gameScene = this.controller.scene.get(K.game);
        if (gameScene && gameScene.stopAllGameMechanics) {
            gameScene.stopAllGameMechanics();
        }

        if (gameScene && (this.controller.scene.isActive(K.game) || this.controller.scene.isSleeping(K.game))) {
            if (gameScene.sound) gameScene.sound.stopAll();
            if (this.controller.scene.isActive(K.game)) {
                await this.transition.fadeOutScene(K.game, 200);
            }
            this.controller.scene.stop(K.game);
        }

        // Wake or launch MainMenu
        if (this.controller.scene.isSleeping(K.mainMenu)) {
            this.controller.scene.wake(K.mainMenu);
        } else if (!this.controller.scene.isActive(K.mainMenu)) {
            this.controller.scene.launch(K.mainMenu);
        }

        this.controller.scene.bringToTop(K.mainMenu);

        // Rebind InputController to MainMenu scene
        const mainMenuScene = this.controller.scene.get(K.mainMenu);
        if (mainMenuScene?.inputController) {
            mainMenuScene.inputController.bindToScene(mainMenuScene);
            mainMenuScene.inputController.resetMenuState();
            if (mainMenuScene.inputCooldown !== undefined) {
                mainMenuScene.inputCooldown = 10;
            }
        }

        await this.transition.fadeInScene(K.mainMenu, 200);

        this.controller.scene.bringToTop(K.mainMenu);
        this.controller.scene.bringToTop(K.controller);
    }

    // -------------------------------------------------------------------------
    // UNIVERSAL MODAL CLOSER
    // -------------------------------------------------------------------------

    /**
     * Closes all currently open modal scenes (Pause, Settings, LevelComplete, GameOver).
     * @private
     * @returns {Promise<void>}
     */
    async closeAllModals() {
        const K = this.keys;

        if (this.controller.scene.isActive(K.pause)) {
            await this.modal.resumeGame();
        }
        if (this.controller.scene.isActive(K.settings)) {
            await this.modal.closeSettings();
        }
        if (this.controller.scene.isActive(K.levelComplete)) {
            await this.modal.closeLevelComplete();
        }
        if (this.controller.scene.isActive(K.gameOver)) {
            await this.modal.closeGameOver();
        }

        this.controller.scene.bringToTop(K.controller);
    }

    // -------------------------------------------------------------------------
    // LEVEL COMPLETE
    // -------------------------------------------------------------------------

    /**
     * Opens the LevelComplete modal.
     *
     * @public
     * @param {object} stats      Game stats forwarded to the LevelComplete scene.
     * @param {number} nextLevel  Level index to start when the player continues.
        this.modal.openLevelComplete(stats, nextLevel);
        this.controller.scene.bringToTop(this.keys.controller);
    }

    /**
     * Advances to the next level after LevelComplete.
     * If _getNarrativeForLevel returns data for the given index, shows the
     * NarrativeScene first; otherwise shows an ad (if adService is provided)
     * then starts the level.
     *
     * @public
     * @param {number} nextLevelIndex  Level index to advance to after closing modals.
     * @returns {Promise<void>}
     */
    async nextLevel(nextLevelIndex) {
        const K = this.keys;
        await this.closeAllModals();

        const narrative = this._getNarrativeForLevel(nextLevelIndex);
        if (narrative) {
            const gameScene = this.controller.scene.get(K.game);
            if (gameScene && gameScene.stopAllGameMechanics) gameScene.stopAllGameMechanics();
            if (gameScene && (
                this.controller.scene.isActive(K.game) ||
                this.controller.scene.isSleeping(K.game) ||
                this.controller.scene.isPaused(K.game)
            )) {
                if (gameScene.sound) gameScene.sound.stopAll();
                this.controller.scene.stop(K.game);
            }

            this.controller.scene.launch(K.narrative, {
                title:      narrative.title,
                text:       narrative.text,
                mode:       'auto',
                level:      nextLevelIndex,
                worldIndex: narrative.worldIndex,
            });
            this.controller.scene.bringToTop(K.narrative);
            this.controller.scene.bringToTop(K.controller);
            return;
        }

        // Freeze old GameScene before the ad
        const oldGameScene = this.controller.scene.get(K.game);
        if (oldGameScene && oldGameScene.stopAllGameMechanics) oldGameScene.stopAllGameMechanics();
        if (oldGameScene && oldGameScene.sound) oldGameScene.sound.stopAll();

        if (this.adService) await this.adService.showInterstitial(nextLevelIndex);
        await this.startGame(nextLevelIndex);
    }

    /**
     * Returns narrative data for the given level index, or null.
     * Override this in a subclass or provide config.getNarrative to enable
     * between-world cutscenes.
     *
     * @protected
     * @param {number} level  Level index to retrieve narrative data for.
     * @returns {{ title: string, text: string, worldIndex: number }|null}
     */
    _getNarrativeForLevel(level) {
        if (this._getNarrativeHook) return this._getNarrativeHook(level);
        return null;
    }

    /**
     * Returns to main menu from LevelComplete (or any modal).
     *
     * @public
     * @returns {Promise<void>}
     */
    async returnToMenu() {
        const gameScene = this.controller.scene.get(this.keys.game);
        if (gameScene && gameScene.stopAllGameMechanics) {
            gameScene.stopAllGameMechanics();
        }
        await this.closeAllModals();
        await this.mainMenu();
    }

    /**
     * Opens the level select screen.
     *
     * @public
     * @returns {Promise<void>}
     */
    async openLevelSelect() {
        const K = this.keys;

        if (this.controller.scene.isActive(K.pause)) {
            await this.transition.fadeOutScene(K.pause, 200);
            this.controller.scene.sleep(K.pause);
        }
        if (this.controller.scene.isActive(K.settings)) {
            await this.modal.closeSettings();
        }
        if (this.controller.scene.isActive(K.levelComplete)) {
            await this.modal.closeLevelComplete();
        }
        if (this.controller.scene.isActive(K.gameOver)) {
            await this.modal.closeGameOver();
        }

        const gameScene = this.controller.scene.get(K.game);
        if (gameScene && gameScene.stopAllGameMechanics) gameScene.stopAllGameMechanics();
        if (gameScene && (
            this.controller.scene.isActive(K.game) ||
            this.controller.scene.isPaused(K.game) ||
            this.controller.scene.isSleeping(K.game)
        )) {
            if (gameScene.sound) gameScene.sound.stopAll();
            this.controller.scene.stop(K.game);
        }

        // One-frame yield so Phaser/WebGL finishes cleaning up resources
        await new Promise(resolve => setTimeout(resolve, 32));

        if (this.controller.scene.isActive(K.mainMenu)) {
            this.controller.scene.sleep(K.mainMenu);
        }

        this.controller.scene.launch(K.levelSelect);
        this.controller.scene.bringToTop(K.levelSelect);
        this.controller.scene.bringToTop(K.controller);
    }

    // -------------------------------------------------------------------------
    // GAME OVER
    // -------------------------------------------------------------------------

    /**
     * Opens the GameOver modal.
     *
     * @public
     * @param {object} stats  Game stats forwarded to the GameOver scene.
     * @param {number} [level=1]
     */
    gameOver(stats, level = 1) {
        this.modal.openGameOver(stats, level);
        this.controller.scene.bringToTop(this.keys.controller);
    }

    /**
     * Restarts the game after GameOver (full retry, no stored life).
     *
     * @public
     * @param {number} [level=1]
     * @returns {Promise<void>}
     */
    async restartAfterGameOver(level = 1) {
        await this.closeAllModals();

        const oldGameScene = this.controller.scene.get(this.keys.game);
        if (oldGameScene && oldGameScene.stopAllGameMechanics) oldGameScene.stopAllGameMechanics();
        if (oldGameScene && oldGameScene.sound) oldGameScene.sound.stopAll();

        if (this.adService) await this.adService.showInterstitial(level);
        await this.startGame(level);
    }

    /**
     * Revives the player in-place (stored-life continue).
     *
     * @public
     * @returns {Promise<void>}
     */
    async resumeFromGameOver() {
        await this.modal.closeGameOver();
        const gameScene = this.controller.scene.get(this.keys.game);
        if (gameScene && typeof gameScene.revivePlayer === 'function') {
            gameScene.revivePlayer();
        }
        this.controller.scene.bringToTop(this.keys.controller);
    }

    // -------------------------------------------------------------------------
    // PAUSE / RESUME
    // -------------------------------------------------------------------------

    /**
     * Opens the Pause modal if GameScene is the underlying scene.
     *
     * @public
     */
    pauseGame() {
        const underlying = this.state.getUnderlyingSceneKey();
        if (underlying === this.keys.game) {
            this.modal.pauseGame();
            this.controller.scene.bringToTop(this.keys.controller);
        }
    }

    /**
     * Closes the Pause modal and resumes gameplay.
     *
     * @public
     * @returns {Promise<void>}
     */
    async resumeGame() {
        await this.modal.resumeGame();
        this.controller.scene.bringToTop(this.keys.controller);
    }

    // -------------------------------------------------------------------------
    // ESC HANDLER
    // -------------------------------------------------------------------------

    /**
     * Handles ESC key behavior depending on current scene state.
     *
     * @public
     */
    handleEsc() {
        const K = this.keys;
        const top = this.state.getTopSceneKey();

        if (top === K.pause)    { this.resumeGame();          return; }
        if (top === K.settings) { this.modal.closeSettings(); return; }
        if (top === K.game)     { this.pauseGame();            return; }
    }

    // -------------------------------------------------------------------------
    // GAMEPAD HANDLER
    // -------------------------------------------------------------------------

    /**
     * Maps gamepad START/BACK to the same behaviour as ESC.
     *
     * @public
     * @param {Phaser.Input.Gamepad.Gamepad} pad  The gamepad that fired the button event.
     */
    handleGamepad(pad) {
        const xbox = Phaser.Input.Gamepad.Configs.XBOX_360;
        if (pad.justPressed(xbox.START) || pad.justPressed(xbox.BACK)) {
            this.handleEsc();
        }
    }
}
