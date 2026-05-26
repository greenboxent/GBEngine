/**
 * Centralized button theme configuration for `createButton` and `createMenuButton`.
 * @module ui/styles/buttonTheme
 */

/**
 * Default visual theme for all `createButton` / `createMenuButton` instances.
 * Override individual properties when calling those functions via their `options` parameter.
 *
 * @type {object}
 * @property {{normal:string, hover:string, selected:string, disabled:string}} color - Text colours.
 * @property {{normal:number, hover:number, selected:number}} backgroundTint - Image tint colours.
 * @property {{normal:number, hover:number, selected:number}} scale - Scale multipliers.
 * @property {string} fontSize - Default CSS font-size.
 * @property {number} backgroundColor - Fill colour for fallback graphic background.
 * @property {number} backgroundAlpha - Alpha for fallback graphic background.
 * @property {number} borderColor - Stroke / glow colour.
 * @property {boolean} borderGlow - Whether to render the animated glow layers.
 * @property {number} padding - Horizontal padding (pixels) added to each side of the label.
 */
export const ButtonTheme = {
    // Text colors
    color: {
        normal: '#aaddff',      // Bright cyan - default button color
        hover: '#00ffcc',       // Brighter cyan/green - mouse hover
        selected: '#00ffcc',    // Same as hover - keyboard/gamepad focused button
        disabled: '#666666'     // Disabled button color
    },
    
    // Background image tint colors
    backgroundTint: {
        normal: 0xaaddff,       // Bright cyan tint for background images
        hover: 0x00ffcc,        // Hover tint
        selected: 0x00ffcc      // Selected tint (same as hover)
    },
    
    // Scale values
    scale: {
        normal: 1.0,
        hover: 1.15,
        selected: 1.15
    },
    
    // Other default options
    fontSize: "32px",
    backgroundColor: 0x1a1a1a,
    backgroundAlpha: 0.7,
    borderColor: 0x4488ff,
    borderGlow: true,
    padding: 20
};
