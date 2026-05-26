/**
 * Styled menu button with rounded rectangle background and glowing border —
 * the standard button style for all menu screens.
 * @module ui/components/uiMenuButton
 */

import { createButton } from './uiButton.js';

/**
 * Creates a styled menu button with rounded background and glowing border.
 * This is a wrapper around createButton with styled defaults.
 *
 * @param {Phaser.Scene} scene - The scene to create the button in.
 * @param {number} x - The x position.
 * @param {number} y - The y position.
 * @param {string} text - The button text.
 * @param {Function} onClick - The click handler.
 * @param {Object} [options={}] - Additional options to override defaults.
 * @returns {Phaser.GameObjects.Container} The button container.
 */
export function createMenuButton(scene, x, y, text, onClick, options = {}) {
    // Merge with styled defaults
    const styledOptions = {
        showBackground: true,
        borderGlow: true,
        ...options
    };
    
    return createButton(scene, x, y, text, onClick, styledOptions);
}
