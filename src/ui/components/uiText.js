/**
 * @module ui/components/uiText
 */
// ui/uiText.js

/**
 * Creates a centered, fixed-position text object at the given coordinates.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {number} x - Center X position.
 * @param {number} y - Center Y position.
 * @param {string} text - The text to display.
 * @param {object} [options={}] - Style options.
 * @param {string} [options.fontSize='32px'] - CSS font-size string.
 * @param {string} [options.color='#ffffff'] - CSS colour string.
 * @param {string} [options.align='center'] - Text alignment.
 * @returns {Phaser.GameObjects.Text}
 */
export function createText(scene, x, y, text, options = {}) {
    const {
        fontSize = "32px",
        color = "#ffffff",
        align = "center"
    } = options;

    return scene.add.text(x, y, text, {
        fontFamily: "Arial",
        fontSize,
        color,
        align
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(99999);
}
