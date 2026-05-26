/**
 * Central debug state and logging hub shared by {@link DebugOverlay}, {@link DebugPerf},
 * and {@link DebugInspector}.
 * @module engine/DebugCore
 */

/**
 * Central debug state and logging hub.
 * Holds all shared flags and the rolling message buffer.
 * {@link DebugOverlay}, {@link DebugPerf}, and {@link DebugInspector} are
 * wired into this object and read from it each frame.
 */
export class DebugCore {
    /** @private — instantiated once by {@link DebugSystemFacade}. */
    constructor() {
        /** @type {boolean} Whether debug mode is currently enabled. */
        this.enabled = false;

        /** @type {boolean} Whether debug level 2 (F2) is enabled. */
        this.debugLevel2 = false;

        /** @type {boolean} Whether debug level 3 (F3) is enabled. */
        this.debugLevel3 = false;

        /** @type {string[]} Rolling buffer of overlay messages. */
        this.buffer = [];

        /** @type {Phaser.Scene|null} SceneController reference. */
        this.controllerScene = null;

        /** @type {Phaser.Scene|null} GameScene reference (optional). */
        this.gameScene = null;

        /** @type {DebugOverlay|null} Overlay subsystem. */
        this.overlay = null;

        /** @type {DebugPerf|null} Performance graph subsystem. */
        this.perf = null;

        /** @type {DebugInspector|null} Inspector subsystem. */
        this.inspector = null;
    }

    /**
     * Attaches the SceneController to the debug system.
     * Must be called once from SceneController.create().
     * @public
     * @param {Phaser.Scene} scene - The SceneController instance.
     * @returns {void}
     */
    attachController(scene) {
        this.controllerScene = scene;
    }

    /**
     * Attaches the current GameScene to the debug system.
     * Called each frame from SceneController.update().
     * @public
     * @param {Phaser.Scene|null} scene - The active GameScene or null.
     * @returns {void}
     */
    attachGameScene(scene) {
        this.gameScene = scene || null;
    }

    /**
     * Toggles debug mode on or off.
     * Notifies subsystems of the new state.
     * @public
     * @returns {void}
     */
    toggle() {
        this.enabled = !this.enabled;

        if (this.overlay) this.overlay.onToggle(this.enabled);
        // Performance graph disabled
        // if (!this.enabled && this.perf) this.perf.onDisable();
    }

    /**
     * Toggles debug level 2 (F2) on or off.
     * @public
     * @returns {void}
     */
    toggleLevel2() {
        this.debugLevel2 = !this.debugLevel2;
        console.log(`%c[DEBUG] Level 2 (F2): ${this.debugLevel2 ? 'ON' : 'OFF'}`, 'color:cyan; font-weight:bold;');
    }

    /**
     * Check if debug level 2 is active.
     * @public
     * @returns {boolean}
     */
    isLevel2Active() {
        return this.debugLevel2;
    }

    /**
     * Check if debug level 3 is active.
     * @public
     * @returns {boolean}
     */
    isLevel3Active() {
        return this.debugLevel3;
    }

    /**
     * Toggles debug level 3 (F3) on or off.
     * @public
     * @returns {void}
     */
    toggleLevel3() {
        this.debugLevel3 = !this.debugLevel3;
        console.log(`%c[DEBUG] Level 3 (F3): ${this.debugLevel3 ? 'ON' : 'OFF'}`, 'color:orange; font-weight:bold;');
    }

    /**
     * Pushes a message into the overlay buffer and updates the overlay text.
     * @public
     * @param {string} category - Log category label.
     * @param {any[]} args - Arguments to log.
     * @returns {void}
     */
    pushToOverlay(category, args) {
        const msg = `[${category}] ${args.map(a => {
            if (typeof a === 'object' && a !== null) {
                // Avoid circular references by using simple string representation
                if (a.constructor?.name) {
                    return `[${a.constructor.name}]`;
                }
                try {
                    return JSON.stringify(a);
                } catch (e) {
                    return '[Circular]';
                }
            }
            return a;
        }).join(' ')}`;

        this.buffer.push(msg);
        if (this.buffer.length > 10) this.buffer.shift();

        if (this.overlay && this.enabled) {
            this.overlay.setText(this.buffer.join('\n'));
        }
    }

    /**
     * Logs a debug message to the console and overlay.
     * @public
     * @param {string} category - Log category label.
     * @param {...any} args - Values to log (last arg can be level number 2 or 3).
     * @returns {void}
     */
    log(category, ...args) {
        // Check if last argument is a debug level
        let level = 2; // Default level
        if (typeof args[args.length - 1] === 'number' && (args[args.length - 1] === 2 || args[args.length - 1] === 3)) {
            level = args.pop();
        }
        
        // Check if this level is enabled
        if (!this.enabled) return;
        if (level === 2 && !this.debugLevel2) return;
        if (level === 3 && !this.debugLevel3) return;
        
        const levelTag = level === 3 ? `[L3]` : `[L2]`;
        console.log(`%c${levelTag}[${category}]`, level === 3 ? 'color:orange; font-weight:bold;' : 'color:cyan; font-weight:bold;', ...args);
        this.pushToOverlay(category, args);
    }

    /**
     * Logs a warning message to the console and overlay.
     * @public
     * @param {string} category - Log category label.
     * @param {...any} args - Values to log.
     * @returns {void}
     */
    warn(category, ...args) {
        if (!this.enabled) return;
        console.warn(`%c[${category}]`, 'color:yellow; font-weight:bold;', ...args);
        this.pushToOverlay(category, args);
    }

    /**
     * Logs an error message to the console and overlay.
     * @public
     * @param {string} category - Log category label.
     * @param {...any} args - Values to log.
     * @returns {void}
     */
    error(category, ...args) {
        if (!this.enabled) return;
        console.error(`%c[${category}]`, 'color:red; font-weight:bold;', ...args);
        this.pushToOverlay(category, args);
    }

    /**
     * Per-frame update entry point.
     * Called from SceneController.update().
     * @public
     * @returns {void}
     */
    update() {
        if (!this.enabled) {
            // Performance graph disabled
            // if (this.perf) this.perf.update(false);
            if (this.inspector) this.inspector.update(false);
            return;
        }

        // Performance graph disabled
        // if (this.perf) this.perf.update(true);
        if (this.inspector) this.inspector.update(true);
    }
}
