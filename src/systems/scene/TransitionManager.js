/**
 * Handles per-scene camera fade transitions (fade-in, fade-out).
 * @module systems/scene/TransitionManager
 */

/**
 * Handles per-scene camera transitions (fade-in, fade-out).
 *
 * Provides async `fadeInScene()` and `fadeOutScene()` helpers that operate on
 * the target scene's own camera. Contains no gameplay logic.
 */
export default class TransitionManager {
    /**
     * Creates a new TransitionManager.
     * @public
     * @param {Phaser.Scene} controllerScene - The SceneController instance.
     */
    constructor(controllerScene) {
        /** @type {Phaser.Scene} */
        this.controller = controllerScene;
    }

    /**
     * Fades out the given scene's main camera.
     * @public
     * @param {string} sceneKey - Key of the scene to fade out.
     * @param {number} [duration=200] - Fade duration in milliseconds.
     * @returns {Promise<void>}
     */
    fadeOutScene(sceneKey, duration = 200) {
        return new Promise(resolve => {
            const scene = this.controller.scene.get(sceneKey);
            if (!scene || !scene.cameras?.main) {
                resolve();
                return;
            }

            const cam = scene.cameras.main;

            cam.off('camerafadeoutcomplete');
            const fallback = setTimeout(resolve, duration + 150);
            cam.once('camerafadeoutcomplete', () => {
                clearTimeout(fallback);
                resolve();
            });

            cam.fadeOut(duration, 0, 0, 0);
        });
    }

    /**
     * Fades in the given scene's main camera.
     * @public
     * @param {string} sceneKey - Key of the scene to fade in.
     * @param {number} [duration=200] - Fade duration in milliseconds.
     * @returns {Promise<void>}
     */
    fadeInScene(sceneKey, duration = 200) {
        return new Promise(resolve => {
            const scene = this.controller.scene.get(sceneKey);
            if (!scene || !scene.cameras?.main) {
                resolve();
                return;
            }

            const cam = scene.cameras.main;

            cam.off('camerafadeincomplete');
            const fallback = setTimeout(resolve, duration + 150);
            cam.once('camerafadeincomplete', () => {
                clearTimeout(fallback);
                resolve();
            });

            cam.fadeIn(duration, 0, 0, 0);
        });
    }
}
