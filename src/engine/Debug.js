/**
 * Full in-game debugging suite: toggleable on-screen overlay, click-to-inspect
 * entity inspector, performance graph (FPS + memory), and category-based logging.
 * Exported as an ES module and attached to `window.Debug` for global access.
 * @module engine/Debug
 */

import { DebugCore } from './debug/DebugCore.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { DebugPerf } from './debug/DebugPerf.js';
import { DebugInspector } from './debug/DebugInspector.js';

/**
 * Unified facade for the in-game debug suite.
 *
 * Wires together {@link DebugCore}, {@link DebugOverlay}, {@link DebugPerf}, and
 * {@link DebugInspector} into a single object that is attached to
 * `window.Debug` and injected into SceneController.
 *
 * Provides a toggleable on-screen overlay, click-to-inspect entity inspector,
 * performance graph (FPS + memory), and category-based logging.
 */
class DebugSystemFacade {
    /** @private — use the exported `Debug` singleton. */
    constructor() {
        /** @type {DebugCore} */
        this.core = new DebugCore();

        /** @type {DebugOverlay} */
        this.overlay = new DebugOverlay(this.core);

        /** @type {DebugPerf} */
        this.perf = new DebugPerf(this.core);

        /** @type {DebugInspector} */
        this.inspector = new DebugInspector(this.core);

        // Wire subsystems into core
        this.core.overlay = this.overlay;
        this.core.perf = this.perf;
        this.core.inspector = this.inspector;
    }

    /**
     * Attaches the debug system to the SceneController.
     * Must be called from SceneController.create().
     * @public
     * @param {Phaser.Scene} sceneController - The SceneController instance.
     * @returns {void}
     */
    attachScene(sceneController) {
        this.core.attachController(sceneController);
        this.overlay.attachScene(sceneController);
        this.perf.attachScene(sceneController);
        this.inspector.attachScene(sceneController);
    }

    /**
     * Per-frame update entry point.
     * Must be called from SceneController.update().
     * @public
     * @param {Phaser.Scene|null} gameScene - The active GameScene or null.
     * @returns {void}
     */
    update(gameScene) {
        this.core.attachGameScene(gameScene || null);
        this.core.update();
    }

    /**
     * Toggles debug mode on or off.
     * @public
     * @returns {void}
     */
    toggle() {
        this.core.toggle();
    }

    /**
     * Toggles debug level 2 (F2) on or off.
     * @public
     * @returns {void}
     */
    toggleLevel2() {
        this.core.toggleLevel2();
    }

    /**
     * Toggles debug level 2 (F2) on or off.
     * @public
     * @returns {void}
     */
    toggleLevel2() {
        this.core.toggleLevel2();
    }

    /**
     * Check if debug level 2 is active.
     * @public
     * @returns {boolean}
     */
    isLevel2Active() {
        return this.core.isLevel2Active();
    }

    /**
     * Check if debug level 3 (Ctrl+F3) is active.
     * @public
     * @returns {boolean}
     */
    isLevel3Active() {
        return this.core.isLevel3Active();
    }

    /**
     * Toggles debug level 3 (F3) on or off.
     * @public
     * @returns {void}
     */
    toggleLevel3() {
        this.core.toggleLevel3();
    }

    /**
     * Logs a debug message.
     * @public
     * @param {string} category - Log category label.
     * @param {...any} args - Values to log.
     * @returns {void}
     */
    log(category, ...args) {
        this.core.log(category, ...args);
    }

    /**
     * Logs a warning message.
     * @public
     * @param {string} category - Log category label.
     * @param {...any} args - Values to log.
     * @returns {void}
     */
    warn(category, ...args) {
        this.core.warn(category, ...args);
    }

    /**
     * Logs an error message.
     * @public
     * @param {string} category - Log category label.
     * @param {...any} args - Values to log.
     * @returns {void}
     */
    error(category, ...args) {
        this.core.error(category, ...args);
    }
}

// Global instance
const Debug = new DebugSystemFacade();
window.Debug = Debug;

export { Debug };
