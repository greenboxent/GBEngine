/**
 * Centralized title and subtitle theme configuration.
 * @module ui/styles/titleTheme
 */

/**
 * Default visual theme for scene titles and secondary text.
 * Properties can be spread into `scene.add.text()` style configs.
 *
 * @type {object}
 * @property {string} fontFamily - Font family name.
 * @property {string} fontSize - CSS font-size for main title text.
 * @property {string} fontStyle - CSS font-style (e.g. 'bold').
 * @property {string} color - Main title colour.
 * @property {string} colorAlt - Alternate title colour variant.
 * @property {string} colorSubtitle - Colour for subtitles / secondary text.
 * @property {string} stroke - Stroke (outline) colour.
 * @property {number} strokeThickness - Stroke width in pixels; 0 = no stroke.
 * @property {object} subtitle - Style preset for subtitle text.
 * @property {object} sectionHeader - Style preset for world/section headers.
 * @property {object} narrativeBody - Style preset for narrative scene body text.
 */
export const TitleTheme = {
    // Font settings
    fontFamily: 'Arial',
    fontSize: '42px',
    fontStyle: 'bold',
    
    // Colors
    color: '#3223db',          // Reddish-pink - main title color
    colorAlt: '#3528e7',       // Lighter variant
    colorSubtitle: '#aaddff',  // Cyan - for subtitles/secondary text
    
    // Text styling
    stroke: '#000000',         // Stroke color (outline)
    strokeThickness: 0,        // Stroke width (0 = no stroke)
    
    // Shadow settings
    shadowColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowBlur: 4,
    shadowStroke: false,
    shadowFill: false,
    
    // Alignment
    align: 'center',
    
    // Subtitle/secondary text settings
    subtitle: {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'normal',
        color: '#aaddff',
        align: 'center'
    },
    
    // World/section headers
    sectionHeader: {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ff4488',
        align: 'center'
    },

    // Narrative scene body text
    // Font size is computed at runtime: clamp(screenWidth * scaleFactor, minSize, maxSize)
    narrativeBody: {
        fontFamily: 'Arial',
        color: '#e8e8e8',
        lineSpacing: 8,
        align: 'left',
        minSize: 16,
        maxSize: 24,
        scaleFactor: 0.038
    }
};
