/**
 * Manages modal overlay scenes: launching, stopping, fading in/out,
 * and input management on underlying scenes.
 * @module systems/scene/ModalManager
 */

/**
 * Manages the lifecycle of modal overlay scenes (Pause, Settings, LevelComplete, GameOver).
 *
 * Launches and stops modal scenes, fades them in/out via {@link TransitionManager},
 * keeps SceneController on top, and disables input on underlying scenes while a
 * modal is open.
 *
 * Contains **no** gameplay logic — {@link GameFlowManager} decides when modals
 * open. Fade operations can reorder scenes, so `bringToTop()` is applied after
 * each fade.
 */
export default class ModalManager {
    /**
     * Constructs the ModalManager.
     *
     * @param {Phaser.Scene} controllerScene - The SceneController instance.
     * @param {SceneStateManager} stateManager - Provides underlying/top scene info.
     * @param {TransitionManager} transitionManager - Handles fade transitions.
     */
    constructor(controllerScene, stateManager, transitionManager) {
        /** @type {Phaser.Scene} */
        this.controller = controllerScene;

        /** @type {SceneStateManager} */
        this.state = stateManager;

        /** @type {TransitionManager} */
        this.transition = transitionManager;

        /** Scene key registry — set by GameFlowManager after construction. */
        this.keys = {
            controller:    'SceneController',
            game:          'GameScene',
            pause:         'PauseScene',
            settings:      'SettingsScene',
            levelComplete: 'LevelCompleteScene',
            gameOver:      'GameOverScene',
        };
    }

    /**
     * Update the scene key registry. Called by GameFlowManager after it builds its own keys.
     * @param {object} keys  Partial scene key overrides merged with defaults.
     */
    setKeys(keys) {
        this.keys = { ...this.keys, ...keys };
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPERS
    // -------------------------------------------------------------------------

    /**
     * Disables input on the underlying scene beneath the modal.
     * This prevents clicks from passing through the modal.
     *
     * @private
     * @returns {void}
     */
    disableUnderlyingInput() {
        const underlying = this.state.getUnderlyingSceneKey();
        if (!underlying) return;

        const scene = this.controller.scene.get(underlying);
        if (scene?.input) scene.input.enabled = false;
    }

    /**
     * Re-enables input on the underlying scene after the modal closes.
     *
     * @private
     * @returns {void}
     */
    enableUnderlyingInput() {
        const underlying = this.state.getUnderlyingSceneKey();
        console.log(`[ModalManager] enableUnderlyingInput - underlying: ${underlying}`);
        if (!underlying) return;

        const scene = this.controller.scene.get(underlying);
        if (scene?.input) {
            scene.input.enabled = true;
            
            // Rebind InputController if the scene has one
            if (scene.inputController && typeof scene.inputController.bindToScene === 'function') {
                console.log(`[ModalManager] Rebinding InputController to ${underlying}`);
                scene.inputController.bindToScene(scene);
                
                // Reset menu state and set cooldown to prevent immediate input
                scene.inputController.resetMenuState();
                if (scene.inputCooldown !== undefined) {
                    scene.inputCooldown = 10;
                }
            }
        }
    }

    /**
     * Ensures the modal is above the underlying scene but below SceneController.
     * This must be called both before and after fade transitions.
     *
     * @param {string} modalKey - The key of the modal scene.
     * @private
     * @returns {void}
     */
    bringModalToCorrectOrder(modalKey) {
        this.controller.scene.bringToTop(modalKey);
        this.controller.scene.bringToTop(this.keys.controller);
    }

    // -------------------------------------------------------------------------
    // PAUSE
    // -------------------------------------------------------------------------

    /**
     * Opens the Pause modal.
     * Launches the scene, disables underlying input, fades it in,
     * and restores SceneController to the top.
     *
     * @public
     * @returns {Promise<void>}
     */
    async pauseGame() {
        const K = this.keys;
        // Pause GameScene when opening pause menu
        if (this.controller.scene.isActive(K.game)) {
            this.controller.scene.pause(K.game);
        }
        
        if (this.controller.scene.isSleeping(K.pause)) {
            this.controller.scene.wake(K.pause);
        } else {
            this.controller.scene.launch(K.pause);
        }

        // Rebind InputController to PauseScene
        const scene = this.controller.scene.get(K.pause);
        if (scene?.inputController) {
            console.log(`[ModalManager] pauseGame - Rebinding InputController to ${K.pause}`);
            scene.inputController.bindToScene(scene);
        }

        this.disableUnderlyingInput();
        this.bringModalToCorrectOrder(K.pause);

        await this.transition.fadeInScene(K.pause, 200);

        this.bringModalToCorrectOrder(K.pause);
    }

    /**
     * Closes the Pause modal.
     * Fades it out, stops the scene, re-enables input,
     * and restores SceneController to the top.
     *
     * @public
     * @returns {Promise<void>}
     */
    async resumeGame() {
        const K = this.keys;
        if (this.controller.scene.isActive(K.pause)) {
            await this.transition.fadeOutScene(K.pause, 200);
            
            // Sleep PauseScene first
            this.controller.scene.sleep(K.pause);
            
            // Resume GameScene if paused
            if (this.controller.scene.isPaused(K.game)) {
                this.controller.scene.resume(K.game);
            }
            
            // Rebind InputController to GameScene explicitly (can't use enableUnderlyingInput because GameScene was paused)
            const gameScene = this.controller.scene.get(K.game);
            if (gameScene) {
                if (gameScene.input) {
                    gameScene.input.enabled = true;
                }
                if (gameScene.inputController) {
                    console.log(`[ModalManager] resumeGame - Rebinding InputController to ${K.game}`);
                    gameScene.inputController.bindToScene(gameScene);
                    gameScene.inputController.resetMenuState();
                    // Set cooldown to prevent immediate re-pause
                    if (gameScene.inputCooldown !== undefined) {
                        gameScene.inputCooldown = 10;
                    }
                }
            }
            
            this.controller.scene.bringToTop(K.controller);
        }
    }

    // -------------------------------------------------------------------------
    // SETTINGS
    // -------------------------------------------------------------------------

    /**
     * Opens the Settings modal.
     * Launches the scene, disables underlying input, fades it in,
     * and restores SceneController to the top.
     *
     * @public
     * @param {string} previousSceneKey - The key of the scene that opened settings
     * @returns {Promise<void>}
     */
    async openSettings(previousSceneKey) {
        const K = this.keys;
        console.log(`[ModalManager] openSettings - previousSceneKey: ${previousSceneKey}`);
        
        // Save the previous scene
        if (previousSceneKey && previousSceneKey !== K.settings) {
            this.state.previousScene = previousSceneKey;
            console.log(`[ModalManager] Saving previousScene: ${previousSceneKey}`);
            
            // Sleep the previous scene to prevent input bleeding
            if (this.controller.scene.isActive(previousSceneKey)) {
                console.log(`[ModalManager] Sleeping ${previousSceneKey}`);
                this.controller.scene.sleep(previousSceneKey);
            }
        }
        
        if (this.controller.scene.isSleeping(K.settings)) {
            this.controller.scene.wake(K.settings);
        } else {
            this.controller.scene.launch(K.settings);
        }

        // Rebind InputController to SettingsScene
        const scene = this.controller.scene.get(K.settings);
        if (scene?.inputController) {
            console.log(`[ModalManager] openSettings - Rebinding InputController to ${K.settings}`);
            scene.inputController.bindToScene(scene);
        }

        this.disableUnderlyingInput();
        this.bringModalToCorrectOrder(K.settings);

        await this.transition.fadeInScene(K.settings, 200);

        this.bringModalToCorrectOrder(K.settings);
    }

    /**
     * Closes the Settings modal.
     * Fades it out, stops the scene, re-enables input,
     * and restores SceneController to the top.
     *
     * @public
     * @returns {Promise<void>}
     */
    async closeSettings() {
        const K = this.keys;
        if (this.controller.scene.isActive(K.settings)) {
            await this.transition.fadeOutScene(K.settings, 200);
            
            // Wake and enable input for previous scene BEFORE sleeping SettingsScene
            const previousScene = this.state.previousScene;
            console.log(`[ModalManager] closeSettings - previousScene: ${previousScene}, isSleeping: ${previousScene ? this.controller.scene.isSleeping(previousScene) : 'N/A'}`);
            if (previousScene) {
                if (this.controller.scene.isSleeping(previousScene)) {
                    console.log(`[ModalManager] Waking ${previousScene}`);
                    this.controller.scene.wake(previousScene);
                    // Wait a frame using native timer (avoids Phaser game-loop dependency)
                    await new Promise(resolve => setTimeout(resolve, 16));
                }
                
                // Enable input and rebind InputController to previous scene
                const prevScene = this.controller.scene.get(previousScene);
                if (prevScene) {
                    // Enable input
                    if (prevScene.input) {
                        prevScene.input.enabled = true;
                    }
                    
                    // Rebind InputController
                    if (prevScene.inputController) {
                        console.log(`[ModalManager] closeSettings - Rebinding InputController to ${previousScene}`);
                        prevScene.inputController.bindToScene(prevScene);
                        prevScene.inputController.resetMenuState();
                        if (prevScene.inputCooldown !== undefined) {
                            prevScene.inputCooldown = 10;
                        }
                    }
                }
            }
            
            this.controller.scene.sleep(K.settings);
            
            // Don't call enableUnderlyingInput() here - it enables GameScene, not PauseScene
            // The wake handler of the previous scene will handle its own input
            
            this.controller.scene.bringToTop(K.controller);
            // Reset SceneController's flag so settings can be reopened
            this.controller.settingsOpen = false;
        }
    }

    // -------------------------------------------------------------------------
    // LEVEL COMPLETE
    // -------------------------------------------------------------------------

    /**
     * Opens the LevelComplete modal.
     * Launches the scene with stats, disables underlying input,
     * fades it in, and restores SceneController to the top.
     *
     * @public
     * @param {Object} stats - Level statistics.
     * @param {number} nextLevel - Next level index.
     * @returns {Promise<void>}
     */
    async openLevelComplete(stats, nextLevel) {
        const K = this.keys;
        // Pause GameScene when opening level complete modal
        if (this.controller.scene.isActive(K.game)) {
            this.controller.scene.pause(K.game);
        }
        
        this.controller.scene.launch(K.levelComplete, { stats, nextLevel });

        this.disableUnderlyingInput();
        this.bringModalToCorrectOrder(K.levelComplete);

        await this.transition.fadeInScene(K.levelComplete, 200);

        this.bringModalToCorrectOrder(K.levelComplete);
    }

    /**
     * Closes the LevelComplete modal.
     * Fades it out, stops the scene, re-enables input,
     * and restores SceneController to the top.
     *
     * @public
     * @returns {Promise<void>}
     */
    async closeLevelComplete() {
        const K = this.keys;
        if (this.controller.scene.isActive(K.levelComplete)) {
            await this.transition.fadeOutScene(K.levelComplete, 200);
            this.controller.scene.stop(K.levelComplete);
            
            // Note: Don't automatically resume GameScene here
            // Let the caller (returnToMenu, nextLevel) decide what to do with GameScene
            // This prevents GameScene from briefly rendering when returning to menu
            
            this.enableUnderlyingInput();
            this.controller.scene.bringToTop(K.controller);
        }
    }

    // -------------------------------------------------------------------------
    // GAME OVER
    // -------------------------------------------------------------------------

    /**
     * Opens the GameOver modal.
     * Launches the scene with stats, disables underlying input,
     * fades it in, and restores SceneController to the top.
     *
     * @public
     * @param {Object} stats - End-of-run statistics.
     * @param {number} level - Level/wave reached.
     * @returns {Promise<void>}
     */
    async openGameOver(stats, level = 1) {
        const K = this.keys;
        this.controller.scene.launch(K.gameOver, { stats, level });

        this.disableUnderlyingInput();
        this.bringModalToCorrectOrder(K.gameOver);

        await this.transition.fadeInScene(K.gameOver, 200);

        this.bringModalToCorrectOrder(K.gameOver);
    }

    /**
     * Closes the GameOver modal.
     * Fades it out, stops the scene, re-enables input,
     * and restores SceneController to the top.
     *
     * @public
     * @returns {Promise<void>}
     */
    async closeGameOver() {
        const K = this.keys;
        if (this.controller.scene.isActive(K.gameOver)) {
            await this.transition.fadeOutScene(K.gameOver, 200);
            this.controller.scene.stop(K.gameOver);
            this.enableUnderlyingInput();
            this.controller.scene.bringToTop(K.controller);
        }
    }

    // -------------------------------------------------------------------------
    // GENERIC MODAL
    // -------------------------------------------------------------------------

    /**
     * Opens a generic modal scene.
     * Launches the scene, disables underlying input, fades it in,
     * and restores SceneController to the top.
     *
     * @public
     * @param {string} sceneKey - The key of the scene to open as a modal.
     * @param {Object} [data] - Optional data to pass to the scene.
     * @param {string} [previousSceneKey] - Optional previous scene key (for Settings that can be opened from modals)
     * @returns {Promise<void>}
     */
    async openModal(sceneKey, data = {}, previousSceneKey = null) {
        // Clear any stale closing guard so re-opening works after a close
        this._closingModals = this._closingModals || new Set();
        this._closingModals.delete(sceneKey);

        // Save previousScene if provided (needed for Settings)
        if (previousSceneKey) {
            this.state.previousScene = previousSceneKey;
            // Sleep the previous scene
            if (this.controller.scene.isActive(previousSceneKey)) {
                this.controller.scene.sleep(previousSceneKey);
            }
        }
        
        const wasWoken = this.controller.scene.isSleeping(sceneKey);
        
        if (wasWoken) {
            this.controller.scene.wake(sceneKey, data);
            // Wait a frame using native timer (avoids Phaser game-loop dependency)
            await new Promise(resolve => setTimeout(resolve, 16));
        } else {
            this.controller.scene.launch(sceneKey, data);
        }

        // Rebind InputController to the modal scene
        const scene = this.controller.scene.get(sceneKey);
        if (scene?.inputController && typeof scene.inputController.bindToScene === 'function') {
            console.log(`[ModalManager] openModal - Rebinding InputController to ${sceneKey}`);
            scene.inputController.bindToScene(scene);
            
            // Reset menu state and set cooldown
            scene.inputController.resetMenuState();
            if (scene.inputCooldown !== undefined) {
                scene.inputCooldown = 10;
            }
        }

        this.disableUnderlyingInput();
        this.bringModalToCorrectOrder(sceneKey);

        await this.transition.fadeInScene(sceneKey, 200);

        this.bringModalToCorrectOrder(sceneKey);
    }

    /**
     * Closes a generic modal scene.
     * Fades it out, stops the scene, re-enables input,
     * and restores SceneController to the top.
     *
     * @public
     * @param {string} sceneKey - The key of the scene to close.
     * @returns {Promise<void>}
     */
    async closeModal(sceneKey) {
        // Re-entrancy guard — ignore if already closing this scene
        this._closingModals = this._closingModals || new Set();
        if (this._closingModals.has(sceneKey)) return;
        this._closingModals.add(sceneKey);

        if (this.controller.scene.isActive(sceneKey)) {
            await this.transition.fadeOutScene(sceneKey, 200);
            
            // If there's a tracked previousScene, wake it and restore its input
            if (this.state.previousScene) {
                const previousScene = this.state.previousScene;
                console.log(`[ModalManager] closeModal - Waking previousScene: ${previousScene}`);
                
                if (this.controller.scene.isSleeping(previousScene)) {
                    this.controller.scene.wake(previousScene);
                    // Wait a frame using native timer (avoids Phaser game-loop dependency)
                    await new Promise(resolve => setTimeout(resolve, 16));
                }
                
                // Enable input and rebind
                const prevScene = this.controller.scene.get(previousScene);
                if (prevScene) {
                    if (prevScene.input) {
                        prevScene.input.enabled = true;
                    }
                    if (prevScene.inputController) {
                        console.log(`[ModalManager] closeModal - Rebinding InputController to ${previousScene}`);
                        prevScene.inputController.bindToScene(prevScene);
                        prevScene.inputController.resetMenuState();
                        if (prevScene.inputCooldown !== undefined) {
                            prevScene.inputCooldown = 10;
                        }
                    }
                }
                
                this.state.previousScene = null; // Clear it
            } else {
                // Standard modal close - enable underlying input
                this.enableUnderlyingInput();
            }
            
            this.controller.scene.sleep(sceneKey);
            this.controller.scene.bringToTop(this.keys.controller);
        }

        this._closingModals.delete(sceneKey);
    }
}
