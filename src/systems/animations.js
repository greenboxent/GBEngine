/**
 * Animation loader for spritesheets using a direction-agnostic naming scheme:
 * `<sheetKey>-idle`, `-walk`, `-run`, `-shoot`, `-hurt`, `-death`.
 * Supports auto-detecting frame size, explicit frame ranges, debug visualization,
 * and array-based configs for multiple sprites (heroes, enemies).
 * @module systems/animations
 */

import { Debug } from '../engine/Debug.js';

/**
 * Loads all Phaser animations described by a JSON animation config cached under `configKey`.
 * Supports single-sprite configs as well as array-based `heroes` / `enemies` configs.
 *
 * @param {Phaser.Scene} scene - The scene whose animation manager will receive the animations.
 * @param {object} [options={}] - Options.
 * @param {string} [options.configKey='heroAnimations'] - Cache key for the JSON animation config.
 * @param {string|null} [options.sheetKeyOverride=null] - Overrides the spritesheet key in the config.
 * @param {boolean} [options.enableDebug=false] - When true, logs frame-range debug info to the console.
 * @returns {void}
 */
function createAnimations(scene, {
    configKey = 'heroAnimations',
    sheetKeyOverride = null,
    enableDebug = false
} = {}) {
    const animConfig = scene.cache.json.get(configKey);

    if (!animConfig) {
        Debug.warn('AnimLoader', `Animation config '${configKey}' not found.`);
        return;
    }

    // Handle array-based configs (heroes/enemies arrays)
    if (animConfig.heroes) {
        animConfig.heroes.forEach(heroConfig => {
            if (sheetKeyOverride) {
                heroConfig.sheetKey = sheetKeyOverride;
            }
            createAllAnimations(scene, heroConfig);
            if (enableDebug) {
                debugAnimations(scene, heroConfig);
            }
        });
        return;
    }

    if (animConfig.enemies) {
        animConfig.enemies.forEach(enemyConfig => {
            if (sheetKeyOverride) {
                enemyConfig.sheetKey = sheetKeyOverride;
            }
            createAllAnimations(scene, enemyConfig);
            if (enableDebug) {
                debugAnimations(scene, enemyConfig);
            }
        });
        return;
    }

    // Handle legacy single sprite config
    if (sheetKeyOverride) {
        animConfig.sheetKey = sheetKeyOverride;
    }

    createAllAnimations(scene, animConfig);

    if (enableDebug) {
        debugAnimations(scene, animConfig);
    }
}

// -----------------------------------------------------------------------------
// CREATE ALL ANIMATIONS
// -----------------------------------------------------------------------------
/**
 * Creates all Phaser animations defined in the given single-sprite `animConfig`.
 * @param {Phaser.Scene} scene      The scene whose animation manager will receive the animations.
 * @param {object} animConfig       Single-sprite animation config (see module description).
 */
function createAllAnimations(scene, animConfig) {
    const sheetKey = animConfig.sheetKey;
    const textureObj = scene.textures.get(sheetKey);

    if (!textureObj) {
        Debug.warn('AnimLoader', `Texture '${sheetKey}' not found.`);
        return;
    }

    const texture = textureObj.getSourceImage();

    // Get frame size from spritesheet (frame dimensions come from loader config)
    let frameWidth;
    let frameHeight;

    const firstFrameKey = Object.keys(textureObj.frames)[0];
    const frame = textureObj.frames[firstFrameKey];

    if (frame) {
        frameWidth = frame.width;
        frameHeight = frame.height;
    }

    // Auto‑detect frames per row
    let framesPerRow = animConfig.defaultFramesPerRow;

    if (animConfig.useAutoDetect && frameWidth) {
        framesPerRow = Math.floor(texture.width / frameWidth);
    }

    // Create each animation definition
    for (const def of animConfig.animations) {
        createSimpleAnimation(scene, sheetKey, framesPerRow, def, {
            frameWidth,
            frameHeight
        });
    }
}

// -----------------------------------------------------------------------------
// CREATE A SINGLE ANIMATION
// -----------------------------------------------------------------------------
/**
 * Registers a single animation with Phaser's animation manager.
 * @param {Phaser.Scene} scene          The scene whose animation manager will receive the animation.
 * @param {string} sheetKey - Spritesheet cache key.
 * @param {number} framesPerRow - Total frames in one row of the spritesheet.
 * @param {object} def - Animation definition from the config.
 * @param {{frameWidth:number,frameHeight:number}} globals - Sheet-level frame size.
 */
function createSimpleAnimation(scene, sheetKey, framesPerRow, def, globals) {
    const anims = scene.anims;

    // Namespace animation key by sheet
    const key = `${sheetKey}-${def.base}`;

    const frameCount = def.frames;
    const frameRate  = def.frameRate;
    const repeat     = def.repeat;

    const row = def.pairRows?.right ?? 0;
    const explicitStart = def.explicit?.right?.startIndex ?? null;

    const frameWidth  = def.frameWidth  ?? globals.frameWidth;
    const frameHeight = def.frameHeight ?? globals.frameHeight;

    if (!frameWidth || !frameHeight) {
        Debug.warn('AnimLoader', `Missing frame size for '${key}'.`);
    }

    const { start, end } = computeFrameRange({
        row,
        explicitStartIndex: explicitStart,
        framesPerRow,
        frameCount
    });

    if (start == null) {
        Debug.warn('AnimLoader', `Could not compute frame range for '${key}'.`);
        return;
    }

    if (!anims.exists(key)) {
        anims.create({
            key,
            frames: anims.generateFrameNumbers(sheetKey, { start, end }),
            frameRate,
            repeat
        });
    }
}

// -----------------------------------------------------------------------------
// FRAME RANGE COMPUTATION
// -----------------------------------------------------------------------------
/**
 * Computes the absolute start/end frame indices for an animation row.
 * @param {{row:number,explicitStartIndex:number|null,framesPerRow:number,frameCount:number}} opts
 * @returns {{start:number|null,end:number|null}}
 */
function computeFrameRange({ row, explicitStartIndex, framesPerRow, frameCount }) {
    // Explicit override
    if (explicitStartIndex != null) {
        const start = explicitStartIndex;
        const end = start + frameCount - 1;
        return { start, end };
    }

    // Auto‑compute from row
    if (row == null || framesPerRow == null) {
        return { start: null, end: null };
    }

    const start = row * framesPerRow;
    const end = start + frameCount - 1;
    return { start, end };
}

// -----------------------------------------------------------------------------
// DEBUG TOOLS
// -----------------------------------------------------------------------------
/**
 * Logs spritesheet layout and animation frame ranges to the console.
 * Useful during development to verify animation configs.
 *
 * @param {Phaser.Scene} scene - The scene used to look up the texture.
 * @param {object} animConfig - The animation config object (same shape as used by `createAnimations`).
 * @returns {void}
 */
function debugAnimations(scene, animConfig) {
    const sheetKey = animConfig.sheetKey;
    const textureObj = scene.textures.get(sheetKey);
    if (!textureObj) return;

    let frameWidth  = animConfig.frameWidth;
    let frameHeight = animConfig.frameHeight;

    if (!frameWidth || !frameHeight) {
        const firstFrameKey = Object.keys(textureObj.frames)[0];
        const frame = textureObj.frames[firstFrameKey];

        if (frame) {
            frameWidth  = frameWidth  ?? frame.width;
            frameHeight = frameHeight ?? frame.height;
        }
    }

    const texture = textureObj.getSourceImage();
    const framesPerRow = Math.floor(texture.width / frameWidth);

    debugPrintSheetLayout(scene, sheetKey, frameWidth, frameHeight);
    debugPrintAnimationRanges(animConfig, framesPerRow);
}

/**
 * Prints a visual map of every frame in the spritesheet to the debug log.
 * @param {Phaser.Scene} scene          Scene used to look up the texture.
 * @param {string} sheetKey             Cache key of the spritesheet.
 * @param {number} frameWidth           Width of a single frame in pixels.
 * @param {number} frameHeight          Height of a single frame in pixels.
 */
function debugPrintSheetLayout(scene, sheetKey, frameWidth, frameHeight) {
    const textureObj = scene.textures.get(sheetKey);
    const texture = textureObj?.getSourceImage();
    if (!texture) return;

    const sheetWidth  = texture.width;
    const sheetHeight = texture.height;

    const rows = Math.floor(sheetHeight / frameHeight);
    const cols = Math.floor(sheetWidth / frameWidth);

    Debug.log('AnimLoader', `\n=== SPRITESHEET MAP: ${sheetKey} ===`);
    Debug.log('AnimLoader', `Sheet: ${sheetWidth}x${sheetHeight}`);
    Debug.log('AnimLoader', `Frame: ${frameWidth}x${frameHeight}`);
    Debug.log('AnimLoader', `Rows: ${rows}, Cols: ${cols}\n`);

    for (let r = 0; r < rows; r++) {
        let line = `ROW ${String(r).padStart(2, '0')}: [ `;
        for (let c = 0; c < cols; c++) {
            const index = r * cols + c;
            line += `f${index} `;
        }
        line += "]";
        Debug.log('AnimLoader', line);
    }

    Debug.log('AnimLoader', "=== END MAP ===\n");
}

/**
 * Logs the computed start/end frame indices for every animation in `animConfig`.
 * @param {object} animConfig   Animation config object (same shape as used by `createAnimations`).
 * @param {number} framesPerRow Number of frames per row in the spritesheet.
 */
function debugPrintAnimationRanges(animConfig, framesPerRow) {
    Debug.log('AnimLoader', `\n=== ANIMATION FRAME RANGES ===`);

    for (const def of animConfig.animations) {
        const base = def.base;
        const count = def.frames;
        const row = def.pairRows?.right;
        const start = row * framesPerRow;

        Debug.log('AnimLoader', `\n${base.toUpperCase()}`);
        Debug.log('AnimLoader', `  Row ${row}, start ${start}, end ${start + count - 1}`);
    }

    Debug.log('AnimLoader', "\n=== END RANGES ===\n");
}

export { createAnimations, debugAnimations };
