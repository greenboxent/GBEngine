/**
 * Labeled ON/OFF toggle UI component invoking a callback on change.
 * Returns a `Phaser.GameObjects.Container` for easy positioning.
 * @module ui/components/uiToggle
 */

/**
 * Creates a labeled ON/OFF toggle control.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {number} x - Center X position.
 * @param {number} y - Center Y position.
 * @param {string} label - Display label shown above the toggle.
 * @param {boolean} initialValue - Starting value (`true` = ON).
 * @param {Function} onChange - Callback invoked with the new boolean value when toggled.
 * @param {object} [config={}] - Style options.
 * @param {string} [config.fontSize='28px'] - CSS font-size string.
 * @param {string} [config.color='#ffffff'] - Label text colour.
 * @param {string} [config.activeColor='#00ffcc'] - Colour used when value is ON.
 * @param {string} [config.hoverColor='#ffff88'] - Hover colour.
 * @param {number} [config.scale=1] - Normal scale.
 * @param {number} [config.hoverScale=1.15] - Hover scale.
 * @returns {Phaser.GameObjects.Container}
 */
export function createToggle(scene, x, y, label, initialValue, onChange, config = {}) {
    const {
        fontSize = "28px",
        color = "#ffffff",
        activeColor = "#00ffcc",
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
    // Value Text (ON/OFF)
    // -------------------------------------------------------------------------
    let value = initialValue;

    const valueText = scene.add.text(0, 40, value ? "ON" : "OFF", {
        fontFamily: "Arial",
        fontSize: "32px",
        color: value ? activeColor : color
    }).setOrigin(0.5);

    container.add(valueText);

    // -------------------------------------------------------------------------
    // Hover behavior (matches createButton)
    // -------------------------------------------------------------------------
    function applyHover(textObj) {
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
            textObj.setColor(value ? activeColor : color);
        });
    }

    // -------------------------------------------------------------------------
    // Make the value text interactive
    // -------------------------------------------------------------------------
    valueText
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(99999)
        .setScale(scale);

    applyHover(valueText);

    valueText.on("pointerdown", () => {
        value = !value;
        valueText.setText(value ? "ON" : "OFF");
        valueText.setColor(value ? activeColor : color);
        if (onChange) onChange(value);
    });

    return container;
}
