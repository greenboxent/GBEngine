/**
 * @module ui/components/uiTransitions
 */
// ui/uiTransitions.js

/**
 * Fades a display object in by tweening its alpha from 0 to 1.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {Phaser.GameObjects.GameObject} target - The object to fade in.
 * @param {number} [duration=400] - Tween duration in milliseconds.
 * @param {number} [delay=0] - Delay before the tween starts (ms).
 */
export function fadeIn(scene, target, duration = 400, delay = 0) {
    target.alpha = 0;
    scene.tweens.add({
        targets: target,
        alpha: 1,
        duration,
        delay,
        ease: 'Sine.easeOut'
    });
}

/**
 * Fades a display object out by tweening its alpha to 0.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {Phaser.GameObjects.GameObject} target - The object to fade out.
 * @param {number} [duration=400] - Tween duration in milliseconds.
 * @param {number} [delay=0] - Delay before the tween starts (ms).
 * @param {Function|null} [onComplete=null] - Callback fired when the tween finishes.
 */
export function fadeOut(scene, target, duration = 400, delay = 0, onComplete = null) {
    scene.tweens.add({
        targets: target,
        alpha: 0,
        duration,
        delay,
        ease: 'Sine.easeIn',
        onComplete
    });
}

/**
 * Slides a display object in from above its current position.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {Phaser.GameObjects.GameObject} target - The object to slide.
 * @param {number} [offset=200] - Pixels to slide from (upward offset).
 * @param {number} [duration=500] - Tween duration in milliseconds.
 */
export function slideInFromTop(scene, target, offset = 200, duration = 500) {
    target.y -= offset;
    scene.tweens.add({
        targets: target,
        y: target.y + offset,
        duration,
        ease: 'Back.easeOut'
    });
}

/**
 * Slides a display object down and off-screen.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {Phaser.GameObjects.GameObject} target - The object to slide.
 * @param {number} [offset=200] - Pixels to slide downward.
 * @param {number} [duration=500] - Tween duration in milliseconds.
 * @param {Function|null} [onComplete=null] - Callback fired when the tween finishes.
 */
export function slideOutToBottom(scene, target, offset = 200, duration = 500, onComplete = null) {
    scene.tweens.add({
        targets: target,
        y: target.y + offset,
        duration,
        ease: 'Back.easeIn',
        onComplete
    });
}

/**
 * Scales a display object in with a "pop" animation from half-size to full size.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {Phaser.GameObjects.GameObject} target - The object to animate.
 * @param {number} [duration=300] - Tween duration in milliseconds.
 */
export function popIn(scene, target, duration = 300) {
    target.setScale(0.5);
    scene.tweens.add({
        targets: target,
        scale: 1,
        duration,
        ease: 'Back.easeOut'
    });
}
