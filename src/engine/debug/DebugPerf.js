/**
 * Simple FPS and memory usage performance graph. Lives in SceneController.
 * @module engine/DebugPerf
 */

/**
 * Simple FPS and memory usage performance graph.
 *
 * Renders a scrolling bar chart in the top-right corner of the SceneController.
 * Only visible when debug mode is enabled. Samples FPS and JS heap size
 * (where available) each frame and keeps a rolling history.
 */
export class DebugPerf {
    /**
     * @param {DebugCore} core - Shared debug core.
     */
    constructor(core) {
        /** @type {DebugCore} */
        this.core = core;

        /** @type {Phaser.Scene|null} */
        this.scene = null;

        /** @type {Phaser.GameObjects.Graphics|null} */
        this.graphics = null;

        /** @type {number[]} */
        this.fpsHistory = [];

        /** @type {number[]} */
        this.memHistory = [];
    }

    /**
     * Attaches the performance graph to the given SceneController.
     * @public
     * @param {Phaser.Scene} scene - The SceneController instance.
     * @returns {void}
     */
    attachScene(scene) {
        this.scene = scene;
        this.graphics = scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(99997)
            .setVisible(false);
    }

    /**
     * Called when debug is disabled to hide the graph.
     * @public
     * @returns {void}
     */
    onDisable() {
        if (this.graphics) this.graphics.setVisible(false);
    }

    /**
     * Per-frame update for the performance graph.
     * @public
     * @param {boolean} active - Whether debug is currently enabled.
     * @returns {void}
     */
    update(active) {
        if (!this.scene || !this.graphics) return;

        if (!active) {
            this.graphics.setVisible(false);
            return;
        }

        this.graphics.setVisible(true);
        this.graphics.clear();

        const fps = Math.round(this.scene.game.loop.actualFps);
        const mem = performance?.memory?.usedJSHeapSize / 1048576 || 0;

        this.fpsHistory.push(fps);
        this.memHistory.push(mem);

        if (this.fpsHistory.length > 120) this.fpsHistory.shift();
        if (this.memHistory.length > 120) this.memHistory.shift();

        // Background
        this.graphics.fillStyle(0x000000, 0.6);
        this.graphics.fillRect(10, 500, 300, 120);

        // FPS line
        this.graphics.lineStyle(2, 0x00ff00, 1);
        this.graphics.beginPath();
        this.fpsHistory.forEach((v, i) => {
            const x = 10 + i * 2;
            const y = 620 - (v / 120) * 100;
            if (i === 0) this.graphics.moveTo(x, y);
            else this.graphics.lineTo(x, y);
        });
        this.graphics.strokePath();

        // Memory line
        this.graphics.lineStyle(2, 0x00aaff, 1);
        this.graphics.beginPath();
        this.memHistory.forEach((v, i) => {
            const x = 10 + i * 2;
            const y = 620 - (v / 200) * 100;
            if (i === 0) this.graphics.moveTo(x, y);
            else this.graphics.lineTo(x, y);
        });
        this.graphics.strokePath();
    }
}
