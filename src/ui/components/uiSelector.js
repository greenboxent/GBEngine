/**
 * Horizontal selector UI component with left/right arrows that cycles through
 * a list of options, invoking a callback on change.
 * @module ui/components/uiSelector
 */
import * as Phaser from 'phaser';

/**
 * Creates a horizontal value-selector control (prev/next arrows + current value label).
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {number} x - Center X position.
 * @param {number} y - Center Y position.
 * @param {string} label - Display label shown above the selector.
 * @param {string[]} options - Array of selectable values.
 * @param {string} currentValue - Initially selected value (must exist in `options`).
 * @param {Function} onChange - Callback invoked with the new value when selection changes.
 * @param {object} [config={}] - Style options.
 * @param {string} [config.fontSize='28px'] - CSS font-size string.
 * @param {string} [config.color='#ffffff'] - Label text colour.
 * @param {string} [config.valueColor='#00ffcc'] - Value text colour.
 * @param {string} [config.hoverColor='#ffff88'] - Arrow hover colour.
 * @param {number} [config.scale=1] - Normal scale.
 * @param {number} [config.hoverScale=1.15] - Hover scale.
 * @returns {Phaser.GameObjects.Container}
 */
export function createSelector(scene, x, y, label, options, currentValue, onChange, config = {}) {
    const {
        fontSize = "28px",
        color = "#ffffff",
        valueColor = "#00ffcc",
        hoverColor = "#ffff88",
        scale = 1,
        hoverScale = 1.15
    } = config;

    // -------------------------------------------------------------------------
    // Container
    // -------------------------------------------------------------------------
    const container = scene.add.container(x, y).setDepth(99999);

    // -------------------------------------------------------------------------
    // Label
    // -------------------------------------------------------------------------
    const labelText = scene.add.text(0, 0, label, {
        fontFamily: "Arial",
        fontSize,
        color
    }).setOrigin(0.5);

    container.add(labelText);

    // -------------------------------------------------------------------------
    // Value Text
    // -------------------------------------------------------------------------
    const valueText = scene.add.text(0, 40, currentValue, {
        fontFamily: "Arial",
        fontSize: "32px",
        color: valueColor
    }).setOrigin(0.5);

    container.add(valueText);

    // -------------------------------------------------------------------------
    // Internal state
    // -------------------------------------------------------------------------
    let index = options.indexOf(currentValue);
    if (index === -1) index = 0;

    function updateValue() {
        const newValue = options[index];
        valueText.setText(newValue);
        if (onChange) onChange(newValue);
    }

    // -------------------------------------------------------------------------
    // Helper: arrow hover animation
    // -------------------------------------------------------------------------
    function applyHoverBehavior(textObj) {
        textObj.on("pointerover", () => {
            scene.tweens.add({
                targets: textObj,
                scale: hoverScale,
                duration: 120,
                ease: "Sine.easeOut"
            });
            textObj.setColor(hoverColor);
        });

        textObj.on("pointerout", () => {
            scene.tweens.add({
                targets: textObj,
                scale: scale,
                duration: 120,
                ease: "Sine.easeIn"
            });
            textObj.setColor(color);
        });
    }

    // -------------------------------------------------------------------------
    // Left Arrow
    // -------------------------------------------------------------------------
    const leftArrow = scene.add.text(-140, 40, "<", {
        fontFamily: "Arial",
        fontSize: "36px",
        color
    })
    .setOrigin(0.5)
    .setInteractive({ hitArea: new Phaser.Geom.Rectangle(-40, -35, 80, 70), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true })
    .setDepth(99999);

    leftArrow.setScale(scale);
    applyHoverBehavior(leftArrow);

    leftArrow.on("pointerdown", () => {
        index = (index - 1 + options.length) % options.length;
        updateValue();
    });

    container.add(leftArrow);

    // -------------------------------------------------------------------------
    // Right Arrow
    // -------------------------------------------------------------------------
    const rightArrow = scene.add.text(140, 40, ">", {
        fontFamily: "Arial",
        fontSize: "36px",
        color
    })
    .setOrigin(0.5)
    .setInteractive({ hitArea: new Phaser.Geom.Rectangle(-40, -35, 80, 70), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true })
    .setDepth(99999);

    rightArrow.setScale(scale);
    applyHoverBehavior(rightArrow);

    rightArrow.on("pointerdown", () => {
        index = (index + 1) % options.length;
        updateValue();
    });

    container.add(rightArrow);

    return container;
}
