/**
 * @module ui/components/uiLayout
 */
// ui/uiLayout.js

/**
 * Positions a list of display objects in a vertical column.
 * @param {Phaser.Scene} scene - The owning Phaser scene (unused, kept for API consistency).
 * @param {number} x - X position for all elements.
 * @param {number} y - Y position for the first element.
 * @param {number} spacing - Vertical gap between element centers (pixels).
 * @param {Phaser.GameObjects.GameObject[]} elements - Objects to lay out.
 */
export function verticalLayout(scene, x, y, spacing, elements) {
    let offset = 0;
    elements.forEach(el => {
        el.setPosition(x, y + offset);
        offset += spacing;
    });
}
