// src/ui/menuButtonSize.js
// The font size and padding for a menu button that has to fit in `gap` pixels of a list (Phaser-free, so it can be tested).
//
// A button from createButton / createMenuButton is about 1.17 x the font size plus 1.5 x the padding tall. The usual 28px font with
// 20px padding is 63px, which overlaps its neighbours as soon as a list is squeezed onto a short screen (a phone turned to landscape).
// Pass the result as options: createMenuButton(scene, x, y, label, fn, menuButtonSize(gap)).

/** How tall a button is (see createButton): the text's height plus 1.5 x the padding. */
export const buttonHeight = (fontSize, padding) => Math.round(fontSize * 1.17 + padding * 1.5);

/**
 * @param {number} gap  Distance between the centres of two neighbouring buttons.
 * @param {object} [opt]
 * @param {number} [opt.maxFont=28]  The size to use when there is room.
 * @param {number} [opt.minFont=14]
 * @param {number} [opt.maxPadding=20]
 * @param {number} [opt.space=6]  The least empty space to leave between two buttons.
 * @returns {{fontSize: string, padding: number, height: number}}  Options for createButton, and the button's height.
 */
export function menuButtonSize(gap, { maxFont = 28, minFont = 14, maxPadding = 20, space = 6 } = {}) {
    const room = gap - space;
    for (let fs = maxFont; fs >= minFont; fs--) {
        const padding = Math.max(6, Math.min(maxPadding, Math.round(fs * 0.7)));
        const height = buttonHeight(fs, padding);
        if (height <= room) return { fontSize: `${fs}px`, padding, height };
    }
    const padding = 6;
    return { fontSize: `${minFont}px`, padding, height: buttonHeight(minFont, padding) };
}
