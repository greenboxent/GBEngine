/**
 * Horizontal slider UI component (0–100) with label and percentage display,
 * invoking a callback when the value changes.
 * @module ui/components/uiSlider
 */

import * as Phaser from 'phaser';

/**
 * Creates a horizontal slider control with a draggable handle.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {number} x - Center X position.
 * @param {number} y - Center Y position.
 * @param {string} label - Display label shown above the slider.
 * @param {number} currentValue - Initial value (within `config.min`–`config.max`, default 0–100).
 * @param {Function} onChange - Callback invoked with the new value when the handle moves.
 * @param {object} [config={}] - Style and range options.
 * @param {string} [config.fontSize='28px'] - CSS font-size string.
 * @param {string} [config.color='#ffffff'] - Label text colour.
 * @param {string} [config.valueColor='#00ffcc'] - Value text colour.
 * @param {number} [config.sliderWidth=300] - Width of the slider track (pixels).
 * @param {number} [config.sliderHeight=10] - Height of the slider track (pixels).
 * @param {number} [config.min=0] - Minimum value.
 * @param {number} [config.max=100] - Maximum value.
 * @returns {Phaser.GameObjects.Container}
 */
export function createSlider(scene, x, y, label, currentValue, onChange, config = {}) {
    const {
        fontSize = "28px",
        color = "#ffffff",
        valueColor = "#00ffcc",
        sliderWidth = 300,
        sliderHeight = 10,
        min = 0,
        max = 100
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
    // Value Text (percentage)
    // -------------------------------------------------------------------------
    const valueText = scene.add.text(0, 35, `${Math.round(currentValue)}%`, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: valueColor
    }).setOrigin(0.5);

    container.add(valueText);

    // -------------------------------------------------------------------------
    // Slider Background
    // -------------------------------------------------------------------------
    const sliderBg = scene.add.graphics();
    sliderBg.fillStyle(0x333333, 1);
    sliderBg.fillRect(-sliderWidth / 2, 60, sliderWidth, sliderHeight);
    container.add(sliderBg);

    // -------------------------------------------------------------------------
    // Slider Fill
    // -------------------------------------------------------------------------
    const sliderFill = scene.add.graphics();
    container.add(sliderFill);

    // -------------------------------------------------------------------------
    // Slider Handle
    // -------------------------------------------------------------------------
    const handle = scene.add.circle(0, 65, 12, 0x00ffcc)
        .setInteractive({ draggable: true, useHandCursor: true });
    container.add(handle);

    // -------------------------------------------------------------------------
    // Internal state
    // -------------------------------------------------------------------------
    let value = currentValue;

    function updateVisuals() {
        const ratio = (value - min) / (max - min);
        const fillWidth = sliderWidth * ratio;
        
        // Update fill
        sliderFill.clear();
        sliderFill.fillStyle(0x00ffcc, 1);
        sliderFill.fillRect(-sliderWidth / 2, 60, fillWidth, sliderHeight);

        // Update handle position
        handle.x = -sliderWidth / 2 + fillWidth;

        // Update text
        valueText.setText(`${Math.round(value)}%`);
    }

    function setValue(newValue) {
        value = Phaser.Math.Clamp(newValue, min, max);
        updateVisuals();
        if (onChange) onChange(value);
    }

    // -------------------------------------------------------------------------
    // Drag handling
    // -------------------------------------------------------------------------
    handle.on('drag', (pointer, dragX) => {
        const relX = dragX;
        const ratio = Phaser.Math.Clamp((relX + sliderWidth / 2) / sliderWidth, 0, 1);
        const newValue = min + ratio * (max - min);
        setValue(newValue);
    });

    // Click on slider bar to jump to position
    sliderBg.setInteractive(
        new Phaser.Geom.Rectangle(-sliderWidth / 2, 60, sliderWidth, sliderHeight),
        Phaser.Geom.Rectangle.Contains
    );

    sliderBg.on('pointerdown', (pointer) => {
        const localX = pointer.x - (container.x + x);
        const ratio = Phaser.Math.Clamp((localX + sliderWidth / 2) / sliderWidth, 0, 1);
        const newValue = min + ratio * (max - min);
        setValue(newValue);
    });

    // Initial visuals
    updateVisuals();

    return container;
}

/**
 * Class wrapper so callers can use `new UiSlider(scene, x, y, options)`.
 * options: { value, onChange, label, min, max, ...config }
 */
export class UiSlider {
    constructor(scene, x, y, options = {}) {
        const { value = 50, onChange, label = '', min, max, ...rest } = options;
        const config = { min, max, ...rest };
        // remove undefined keys so createSlider defaults apply
        Object.keys(config).forEach(k => config[k] === undefined && delete config[k]);
        this.container = createSlider(scene, x, y, label, value, onChange, config);
    }
}
