/**
 * On-screen debug overlay and click-to-open debug panel. Lives in SceneController.
 * @module engine/DebugOverlay
 */

import { Capacitor } from '@capacitor/core';

/**
 * On-screen debug overlay and expandable debug panel.
 *
 * On mobile shows a small bug-icon button in the top-right corner.
 * On desktop shows a scrolling text overlay in the top-left.
 * Tapping / clicking the overlay opens a full-screen debug panel with
 * the current buffer of logged messages.
 */
export class DebugOverlay {
    /**
     * @param {DebugCore} core - Shared debug core.
     */
    constructor(core) {
        /** @type {DebugCore} */
        this.core = core;

        /** @type {Phaser.Scene|null} */
        this.scene = null;

        /** @type {Phaser.GameObjects.Text|null} */
        this.overlay = null;

        /** @type {Phaser.GameObjects.Rectangle|null} */
        this.panel = null;

        /** @type {Phaser.GameObjects.Text|null} */
        this.panelText = null;
    }

    /**
     * Attaches the overlay to the given SceneController.
     * Creates overlay and panel UI elements.
     * @public
     * @param {Phaser.Scene} scene - The SceneController instance.
     * @returns {void}
     */
    attachScene(scene) {
        this.scene = scene;
        
        // Detect if running on mobile (Android or iOS)
        const platform = Capacitor.getPlatform();
        const isMobile = platform === 'android' || platform === 'ios';

        // On mobile: small button in top-right corner
        // On desktop: full text overlay in top-left
        if (isMobile) {
            this.overlay = scene.add.text(scene.scale.width - 60, 10, '🐛', {
                fontFamily: 'Arial',
                fontSize: '32px',
                color: '#00ffcc',
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: { left: 8, right: 8, top: 4, bottom: 4 }
            })
            .setScrollFactor(0)
            .setDepth(99999)
            .setVisible(this.core.enabled)
            .setInteractive();
        } else {
            this.overlay = scene.add.text(10, 10, '', {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#00ffcc',
                backgroundColor: 'rgba(0,0,0,0.4)',
                padding: { left: 6, right: 6, top: 4, bottom: 4 }
            })
            .setScrollFactor(0)
            .setDepth(99999)
            .setVisible(this.core.enabled)
            .setInteractive();
        }

        this.overlay.on('pointerdown', () => {
            const visible = !this.panel.visible;
            this.panel.setVisible(visible);
            this.panelText.setVisible(visible);
            this.refreshPanel();
        });

        this.panel = scene.add.rectangle(200, 200, 350, 450, 0x000000, 0.85)
            .setScrollFactor(0)
            .setDepth(99998)
            .setVisible(false);

        this.panelText = scene.add.text(40, 40, '', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ffffff',
            wordWrap: { width: 300 }
        })
        .setScrollFactor(0)
        .setDepth(99999)
        .setVisible(false);
    }

    /**
     * Handles debug toggle state changes.
     * @public
     * @param {boolean} enabled - Whether debug is enabled.
     * @returns {void}
     */
    onToggle(enabled) {
        if (this.overlay) this.overlay.setVisible(enabled);
        if (!enabled) {
            this.panel?.setVisible(false);
            this.panelText?.setVisible(false);
        }
    }

    /**
     * Sets the overlay text content.
     * @public
     * @param {string} text - Text to display in the overlay.
     * @returns {void}
     */
    setText(text) {
        // On mobile, overlay is a button (🐛), so don't update text
        const platform = Capacitor.getPlatform();
        const isMobile = platform === 'android' || platform === 'ios';
        
        if (this.overlay && !isMobile) {
            this.overlay.setText(text);
        }
    }

    /**
     * Refreshes the debug panel contents (FPS, entity count, etc.).
     * @public
     * @returns {void}
     */
    refreshPanel() {
        if (!this.scene || !this.panelText) return;

        const fps = Math.round(this.scene.game.loop.actualFps);
        const gameScene = this.core.gameScene;
        const enemyCount = gameScene?.enemySpawner?.enemiesGroup.countActive(true) ?? 0;

        const lines = [
            'DEBUG PANEL',
            '---------------------',
            `FPS: ${fps}`,
            `Enemies: ${enemyCount}`,
            '',
            'Click overlay to close'
        ];
        this.panelText.setText(lines.join('\n'));
    }
}
