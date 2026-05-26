/**
 * Tracks active Phaser scenes and provides helpers for pausing, resuming,
 * showing, hiding, and toggling input. Used by {@link GameFlowManager}
 * and {@link ModalManager}.
 * @module systems/scene/SceneStateManager
 */

/**
 * Tracks which Phaser scenes are currently active and provides helpers for
 * pausing, resuming, showing, and hiding scenes.
 *
 * Used by {@link GameFlowManager} and {@link ModalManager} to query scene
 * state without depending on Phaser internals directly.
 */
export default class SceneStateManager {
    /**
     * @param {Phaser.Scene} controllerScene - The SceneController scene instance.
     */
    constructor(controllerScene) {
        this.controller = controllerScene;

        // Modal scenes that should never be treated as underlying gameplay scenes
        this.modalScenes = new Set([
            'PauseScene',
            'SettingsScene',
            'StoreScene',
            'GameOverScene',
            'LevelCompleteScene',
            'LeaderboardScene'
        ]);
    }

    /**
     * Returns all active scenes managed by Phaser.
     * @public
     * @returns {Phaser.Scene[]} Array of active scenes.
     */
    getActiveScenes() {
        return this.controller.scene.manager.getScenes(true);
    }

    /**
     * Returns the key of the given scene instance.
     * @private
     * @param {Phaser.Scene} scene  Scene instance to look up.
     * @returns {string|null}
     */
    getSceneKey(scene) {
        // In Phaser 3, the key lives on sys.settings.key
        return scene?.sys?.settings?.key || null;
    }

    /**
     * Returns the key of the topmost active scene (excluding SceneController).
     * @public
     * @returns {string|null} The scene key or null if none found.
     */
    getTopSceneKey() {
        const list = this.getActiveScenes();
        const top = list[list.length - 1];
        const key = this.getSceneKey(top);
        if (key === 'SceneController') return null;
        return key;
    }

    /**
     * Returns the key of the underlying non-modal scene.
     * Scans from top to bottom, skipping SceneController and modal scenes.
     * Includes a fallback to GameScene if it is active.
     * @public
     * @returns {string|null} The underlying scene key or null if none found.
     */
    getUnderlyingSceneKey() {
        const list = this.getActiveScenes();

        // Scan from top → bottom
        for (let i = list.length - 1; i >= 0; i--) {
            const key = this.getSceneKey(list[i]);

            if (key === 'SceneController') continue;
            if (this.modalScenes.has(key)) continue;

            return key;
        }

        // Fallback: if GameScene is active, treat it as underlying
        if (this.controller.scene.isActive('GameScene')) {
            return 'GameScene';
        }

        return null;
    }

    /**
     * Checks whether a scene is currently active.
     * @public
     * @param {string} key - The scene key to check.
     * @returns {boolean} True if the scene is active.
     */
    isActive(key) {
        if (!key) return false;
        return this.controller.scene.isActive(key);
    }

    /**
     * Pauses a running scene if it is active.
     * @public
     * @param {string} key - The scene key to pause.
     * @returns {void}
     */
    pauseScene(key) {
        if (!key) return;
        if (!this.isActive(key)) return;
        this.controller.scene.pause(key);
    }

    /**
     * Resumes a scene.
     * @public
     * @param {string} key - The scene key to resume.
     * @returns {void}
     */
    resumeScene(key) {
        if (!key) return;
        this.controller.scene.resume(key);
    }

    /**
     * Hides a scene by setting its visibility to false.
     * @public
     * @param {string} key - The scene key to hide.
     * @returns {void}
     */
    hideScene(key) {
        if (!key) return;
        this.controller.scene.setVisible(key, false);
    }

    /**
     * Shows a scene by setting its visibility to true.
     * @public
     * @param {string} key - The scene key to show.
     * @returns {void}
     */
    showScene(key) {
        if (!key) return;
        this.controller.scene.setVisible(key, true);
    }

    /**
     * Disables input for a scene if it has an input system.
     * @public
     * @param {string} key - The scene key whose input should be disabled.
     * @returns {void}
     */
    disableInput(key) {
        if (!key) return;
        const s = this.controller.scene.get(key);
        if (s?.input) s.input.enabled = false;
    }

    /**
     * Enables input for a scene if it has an input system.
     * @public
     * @param {string} key - The scene key whose input should be enabled.
     * @returns {void}
     */
    enableInput(key) {
        if (!key) return;
        const s = this.controller.scene.get(key);
        if (s?.input) s.input.enabled = true;
    }
}
