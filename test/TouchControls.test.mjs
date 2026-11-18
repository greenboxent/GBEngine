// TouchControls: the on-screen move stick, fire stick and (optionally) tap-to-jump, driven by a fake Phaser scene.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers.mjs';

installLocalStorage();
globalThis.window ??= { addEventListener() {}, removeEventListener() {}, innerWidth: 800, innerHeight: 360, location: { search: '', hostname: 'localhost' } };
const { TouchControls } = await import('../src/systems/TouchControls.js');

/** An object that answers every method call with itself (stands in for graphics and text game objects). */
const chain = () => { const p = new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : p), apply: () => p }); return p; };

function fakeScene(W = 800, H = 360) {
    const on = {};
    return {
        on,
        scale: { width: W, height: H, on() {}, off() {} },
        add: { graphics: chain, text: chain },
        input: { addPointer() {}, on(ev, fn, ctx) { on[ev] = fn.bind(ctx); }, off() {} },
        uiLayer: { add() {} },
    };
}
const ptr = (id, x, y) => ({ id, x, y });
const freshIC = () => ({ moveX: 0, moveY: 0, shoot: false, jump: false, pause: false, aimAngle: 0 });

const setTouchPoints = n => Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: n }, configurable: true, writable: true });
beforeEach(() => setTouchPoints(5));

test('on when the device has touch points, off without them, and `enabled` overrides both', () => {
    assert.equal(new TouchControls(fakeScene()).active, true);
    setTouchPoints(0);
    assert.equal(new TouchControls(fakeScene()).active, false);
    assert.equal(new TouchControls(fakeScene(), { enabled: true }).active, true);
    setTouchPoints(5);
    const scene = fakeScene();
    const off = new TouchControls(scene, { enabled: false });
    assert.equal(off.active, false);
    assert.equal(scene.on.pointerdown, undefined, 'no listeners when off');
    off.setVisible(false); off.update(freshIC()); off.destroy();       // all safe no-ops
});

test('the pause button is there by default and left out with pauseButton: false', () => {
    assert.ok(new TouchControls(fakeScene())._BTN.pause);
    const t = new TouchControls(fakeScene(), { pauseButton: false });
    assert.equal(t._BTN.pause, undefined);
    t.update(freshIC());                                                // nothing to read from it
});

test('the move stick on the left drives ic.moveX / moveY and lets go when the finger lifts', () => {
    const scene = fakeScene(), t = new TouchControls(scene);
    const ic = freshIC();
    scene.on.pointerdown(ptr(1, t._joyX + t._outerR * 2, t._joyY));          // pushed far right: clamped to full
    t.update(ic);
    assert.ok(ic.moveX > 0.99 && Math.abs(ic.moveY) < 0.01, `moveX ${ic.moveX}`);
    scene.on.pointermove(ptr(1, t._joyX - t._outerR, t._joyY));
    const ic2 = freshIC(); t.update(ic2);
    assert.ok(ic2.moveX < -0.99);
    scene.on.pointerup(ptr(1, 0, 0));
    const ic3 = freshIC(); t.update(ic3);
    assert.equal(ic3.moveX, 0);
});

test('the fire stick on the right fires while held and aims the way it is dragged', () => {
    const scene = fakeScene(), t = new TouchControls(scene);
    const ic = freshIC();
    scene.on.pointerdown(ptr(2, t._fireCX - t._fireR, t._fireCY));          // dragged left
    t.update(ic);
    assert.equal(ic.shoot, true);
    assert.ok(Math.abs(Math.abs(ic.aimAngle) - 180) < 1, `aim ${ic.aimAngle}`);
    scene.on.pointerup(ptr(2, 0, 0));
    const ic2 = freshIC(); t.update(ic2);
    assert.equal(ic2.shoot, false);
});

test('tapJump: a second finger tapping anywhere else while running jumps, once', () => {
    const scene = fakeScene(), t = new TouchControls(scene, { tapJump: true, pauseButton: false });
    scene.on.pointerdown(ptr(1, t._joyX + t._outerR, t._joyY));              // running
    scene.on.pointerdown(ptr(3, t._joystickZoneW - 20, 40));                 // tap elsewhere (left zone, stick already held)
    let ic = freshIC(); t.update(ic);
    assert.equal(ic.jump, true);
    assert.ok(ic.moveX > 0.9, 'still running');
    ic = freshIC(); t.update(ic);
    assert.equal(ic.jump, false, 'one jump per tap');
    scene.on.pointerdown(ptr(4, t._joystickZoneW + 20, 40));                 // tap in the right half, away from the fire ring
    ic = freshIC(); t.update(ic);
    assert.equal(ic.jump, true);
});

test('tapJump: the fire ring and the sticks themselves are not jump taps', () => {
    const scene = fakeScene(), t = new TouchControls(scene, { tapJump: true, pauseButton: false });
    scene.on.pointerdown(ptr(1, t._fireCX, t._fireCY));                      // fire stick
    scene.on.pointerdown(ptr(2, t._fireCX, t._fireCY - t._fireR));           // a second finger on the fire ring
    scene.on.pointerdown(ptr(3, t._joyX, t._joyY));                          // move stick (idle: it claims the touch)
    const ic = freshIC(); t.update(ic);
    assert.equal(ic.jump, false);
});

test('without tapJump no tap jumps, and hidden controls ignore touches', () => {
    const scene = fakeScene(), t = new TouchControls(scene);
    scene.on.pointerdown(ptr(1, t._joyX, t._joyY));
    scene.on.pointerdown(ptr(2, t._joystickZoneW + 20, 40));
    let ic = freshIC(); t.update(ic);
    assert.equal(ic.jump, false);
    t.setVisible(false);
    scene.on.pointerdown(ptr(5, t._fireCX, t._fireCY));
    ic = freshIC(); t.update(ic);
    assert.equal(ic.shoot, false);
});

test('fireStick: where the ring is and how far the knob is pushed, as -1..1', () => {
    const scene = fakeScene(), t = new TouchControls(scene);
    let f = t.fireStick();
    assert.equal(f.active, false);
    assert.equal(f.cx, t._fireCX); assert.equal(f.cy, t._fireCY); assert.equal(f.r, t._fireR);
    scene.on.pointerdown(ptr(2, t._fireCX - t._fireR, t._fireCY - t._fireR));            // up and to the left, past the ring
    f = t.fireStick();
    assert.equal(f.active, true);
    assert.ok(f.x < -0.6 && f.y < -0.6 && Math.hypot(f.x, f.y) <= 1.001, `knob ${f.x}, ${f.y}`);
    scene.on.pointerup(ptr(2, 0, 0));
    assert.deepEqual([t.fireStick().active, t.fireStick().x, t.fireStick().y], [false, 0, 0]);
});

test('fireStick on a device without touch is idle; the ring can carry other words', () => {
    const t = new TouchControls(fakeScene(), { enabled: false });
    assert.equal(t.fireStick().active, false);
    t.setFireLabel('PASS');                                                                // no-op when off
    const on = new TouchControls(fakeScene(), { fireLabel: 'HIT' });
    assert.equal(on._fireLabel, 'HIT');
    on.setFireLabel('PASS');
    assert.equal(on._fireLabel, 'PASS');
});
