/**
 * @module ui/components/uiPanel
 */
// ui/uiPanel.js

/**
 * Creates a solid rectangular panel game object.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {number} x - Center X position.
 * @param {number} y - Center Y position.
 * @param {number} width - Panel width in pixels.
 * @param {number} height - Panel height in pixels.
 * @param {object} [options={}] - Style options.
 * @param {number} [options.color=0x222222] - Fill colour (hex).
 * @param {number} [options.alpha=0.9] - Fill alpha (0–1).
 * @param {number} [options.radius=0] - Corner radius; > 0 adds a stroke outline.
 * @returns {Phaser.GameObjects.Rectangle}
 */
export function createPanel(scene, x, y, width, height, options = {}) {
    const {
        color = 0x222222,
        alpha = 0.9,
        radius = 0
    } = options;

    const panel = scene.add.rectangle(x, y, width, height, color, alpha)
        .setScrollFactor(0)
        .setDepth(99998);

    if (radius > 0) {
        panel.setStrokeStyle(2, 0xffffff, 0.3);
    }

    return panel;
}
