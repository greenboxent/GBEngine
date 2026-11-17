// resize.js: the canvas follows the window; a scene restarts once when the size really changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitCanvasToWindow, restartOnResize } from '../src/systems/resize.js';

function fakeWindow(w, h) {
    const l = {};
    return { innerWidth: w, innerHeight: h, addEventListener: (e, f) => { (l[e] ??= new Set()).add(f); }, removeEventListener: (e, f) => l[e]?.delete(f), fire: e => [...(l[e] ?? [])].forEach(f => f()), count: e => l[e]?.size ?? 0 };
}
function fakeGame(w, h, hasCanvas = true) {
    const ready = [];
    const g = { canvas: hasCanvas ? { style: {} } : null, scale: { width: w, height: h, resizes: [], resize(a, b) { this.width = a; this.height = b; this.resizes.push([a, b]); } }, events: { once: (e, f) => ready.push(f) }, ready };
    return g;
}

test('fitCanvasToWindow: the canvas CSS size and the game size follow the window', () => {
    const win = fakeWindow(412, 915), game = fakeGame(412, 915);
    fitCanvasToWindow(game, win);
    assert.deepEqual([game.canvas.style.width, game.canvas.style.height], ['412px', '915px']);
    assert.equal(game.scale.resizes.length, 0, 'already the right size: no resize');
    win.innerWidth = 915; win.innerHeight = 412;
    win.fire('resize');
    assert.deepEqual(game.scale.resizes, [[915, 412]]);
    assert.deepEqual([game.canvas.style.width, game.canvas.style.height], ['915px', '412px']);
});

test('fitCanvasToWindow: waits for the canvas, follows a late orientation change, and can stop', async () => {
    const win = fakeWindow(800, 400), game = fakeGame(400, 800, false);
    const stop = fitCanvasToWindow(game, win);
    assert.equal(game.ready.length, 1, 'no canvas yet: waits for ready');
    game.canvas = { style: {} }; game.ready[0]();
    assert.deepEqual(game.scale.resizes, [[800, 400]]);
    win.innerWidth = 400; win.innerHeight = 800;
    win.fire('orientationchange');
    assert.deepEqual(game.scale.resizes.at(-1), [400, 800]);
    win.innerWidth = 360;                                   // the phone reports its final size a moment later
    await new Promise(r => setTimeout(r, 350));
    assert.deepEqual(game.scale.resizes.at(-1), [360, 800]);
    stop();
    assert.equal(win.count('resize') + win.count('orientationchange'), 0);
});

test('fitCanvasToWindow ignores a window with no size', () => {
    const win = fakeWindow(0, 0), game = fakeGame(400, 800);
    fitCanvasToWindow(game, win);
    assert.equal(game.scale.resizes.length, 0);
});

function fakeScene(w, h, active = true) {
    const sl = {}, el = {};
    const reg = (o, e, f) => { (o[e] ??= new Set()).add(f); };
    const scene = {
        restarts: 0, active,
        scale: { width: w, height: h, on: (e, f) => reg(sl, e, f), off: (e, f) => sl[e]?.delete(f) },
        events: { on: (e, f) => reg(el, e, f), once: (e, f) => reg(el, e, f), off: (e, f) => el[e]?.delete(f) },
        scene: { isActive: () => scene.active, restart: () => { scene.restarts++; } },
        emit: (o, e) => [...((o === 's' ? sl : el)[e] ?? [])].forEach(f => f()),
        listeners: () => (sl.resize?.size ?? 0) + (el.wake?.size ?? 0),
    };
    return scene;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('restartOnResize: restarts once after a burst of resizes that changed the size', async () => {
    const s = fakeScene(400, 800);
    restartOnResize(s, 20);
    s.scale.width = 800; s.scale.height = 400;
    s.emit('s', 'resize'); s.emit('s', 'resize'); s.emit('s', 'resize');
    assert.equal(s.restarts, 0, 'not at once');
    await sleep(60);
    assert.equal(s.restarts, 1);
});

test('restartOnResize: no restart when the size is back where it was, or the scene is not showing', async () => {
    const a = fakeScene(400, 800);
    restartOnResize(a, 10);
    a.scale.width = 800; a.emit('s', 'resize'); a.scale.width = 400;
    await sleep(40);
    assert.equal(a.restarts, 0);
    const b = fakeScene(400, 800, false);                   // asleep behind another scene
    restartOnResize(b, 10);
    b.scale.width = 800; b.emit('s', 'resize');
    await sleep(40);
    assert.equal(b.restarts, 0);
});

test('restartOnResize: waking up at a different size restarts; cleaning up on shutdown', () => {
    const s = fakeScene(400, 800, false);
    restartOnResize(s);
    s.scale.width = 800; s.active = true;
    s.emit('e', 'wake');
    assert.equal(s.restarts, 1);
    assert.equal(s.listeners() > 0, true);
    s.emit('e', 'shutdown');
    assert.equal(s.listeners(), 0);
});
