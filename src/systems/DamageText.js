/**
 * Creates floating damage numbers that animate upward and fade out.
 * Used by both player and enemy damage systems.
 * @module systems/DamageText
 */

/**
 * Creates a floating damage number at the given world position.
 *
 * The text rises upward and fades out over ~600 ms before destroying itself.
 * Safe to call from any Phaser scene.
 *
 * @param {Phaser.Scene} scene - The scene that owns the text object.
 * @param {number} x - World X coordinate to spawn at.
 * @param {number} y - World Y coordinate to spawn at.
 * @param {number|string} amount - The damage value to display.
 * @param {string} [color='#ff4444'] - CSS colour string for the text.
 * @returns {void}
 */
export function spawnDamageText(scene, x, y, amount, color = '#ff4444') {
    const txt = scene.add.text(x, y, amount.toString(), {
        fontFamily: 'Arial',
        fontSize: '24px',
        color,
        stroke: '#000000',
        strokeThickness: 3
    }).setOrigin(0.5);

    scene.tweens.add({
        targets: txt,
        y: y - 30,     // float upward
        alpha: 0,      // fade out
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => txt.destroy()
    });
}
