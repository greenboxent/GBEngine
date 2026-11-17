// src/systems/resize.js
// Keeping a game right when the window changes size, e.g. a phone turned from portrait to landscape.
//
// With `scale: { mode: Phaser.Scale.NONE }` Phaser never resizes the canvas by itself: the canvas keeps the size the window had at launch,
// and a bigger or turned window only stretches it with CSS (a landscape game turned on its side comes out wide and unreadable).
// `fitCanvasToWindow` resizes the game to the window; scenes that lay themselves out once in create() then need `restartOnResize`.

/**
 * Keeps the Phaser game the size of the window: sets the canvas CSS size and calls `game.scale.resize`, which makes every scene's
 * `scale.on('resize')` listener run. Also follows `orientationchange` (a phone often reports the new size a moment late).
 * @param {Phaser.Game} game  With `scale: { mode: Phaser.Scale.NONE }`.
 * @param {Window} [win=window]
 * @returns {() => void} Stops following the window.
 */
export function fitCanvasToWindow(game, win = globalThis.window) {
    let timer = null;
    const apply = () => {
        const w = Math.round(win.innerWidth), h = Math.round(win.innerHeight);
        if (!(w > 0 && h > 0)) return;
        const canvas = game.canvas;
        if (canvas) { canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
        if (game.scale && (game.scale.width !== w || game.scale.height !== h)) game.scale.resize(w, h);
    };
    const onOrientation = () => { apply(); clearTimeout(timer); timer = setTimeout(apply, 300); };
    if (game.canvas) apply(); else game.events?.once('ready', apply);
    win.addEventListener('resize', apply);
    win.addEventListener('orientationchange', onOrientation);
    return () => { clearTimeout(timer); win.removeEventListener('resize', apply); win.removeEventListener('orientationchange', onOrientation); };
}

/**
 * For a scene that builds its layout once in create(): restarts it when the game size changes while it is showing (after a short pause,
 * so a stream of resize events restarts it once), and when it wakes up showing a different size than it was built for. Call it at the end
 * of create(). A restart passes the scene's last launch data again, so give the scene an `init()` that can rebuild from it.
 * @param {Phaser.Scene} scene
 * @param {number} [delay=150] ms to wait after the last resize event.
 */
export function restartOnResize(scene, delay = 150) {
    const built = { w: scene.scale.width, h: scene.scale.height };
    let timer = null;
    const check = () => {
        if (!scene.scene.isActive() || (scene.scale.width === built.w && scene.scale.height === built.h)) return;
        scene.scene.restart();
    };
    const onResize = () => { clearTimeout(timer); timer = setTimeout(check, delay); };
    scene.scale.on('resize', onResize);
    scene.events.on('wake', check);
    scene.events.once('shutdown', () => {
        clearTimeout(timer);
        scene.scale.off('resize', onResize);
        scene.events.off('wake', check);
    });
}
