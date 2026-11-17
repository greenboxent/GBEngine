// Gamepads.js: merging pads for the menus, one pad as game controls, and one pad per player.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { connectedPads, padCount, firstTwoPads, mergePads, mergedPad, PadControls, givePads } from '../src/systems/Gamepads.js';

const pad = (index, pressed = [], axes = [0, 0, 0, 0], values = {}) => ({
    index, connected: true, mapping: 'standard', timestamp: index, axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: pressed.includes(i), value: values[i] ?? (pressed.includes(i) ? 1 : 0) })),
});

// navigator.getGamepads() answers with whatever the test puts in `slots`
let slots, saved;
beforeEach(() => {
    slots = [];
    saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [...slots, null, null, null, null].slice(0, 4) }, configurable: true, writable: true });
});
afterEach(() => {
    if (saved) Object.defineProperty(globalThis, 'navigator', saved); else delete globalThis.navigator;
});

test('connectedPads skips empty slots and disconnected pads; padCount and firstTwoPads follow', () => {
    assert.equal(padCount(), 0);
    slots = [pad(0), null, pad(2), { ...pad(3), connected: false }];
    assert.deepEqual(connectedPads().map(p => p.index), [0, 2]);
    assert.equal(padCount(), 2);
    assert.deepEqual(firstTwoPads(), [0, 2]);
    slots = [pad(0), pad(1), pad(2)];
    assert.deepEqual(firstTwoPads(), [0, 1], 'only the first two');
});

test('without the pad API nothing is found', () => {
    globalThis.navigator = {};
    assert.equal(padCount(), 0);
    assert.equal(mergedPad(), null);
});

test('mergePads: no pad is null, one pad is that pad itself', () => {
    assert.equal(mergePads([]), null);
    assert.equal(mergePads([null, null]), null);
    const one = pad(0, [0]);
    assert.equal(mergePads([null, one]), one);
});

test('mergePads: a button is down when it is down on either pad, an axis is the one pushed furthest', () => {
    const m = mergePads([pad(0, [0], [0.3, -0.9, 0, 0]), pad(1, [13], [-0.7, 0.2, 0, 0])]);
    assert.equal(m.buttons[0].pressed, true);
    assert.equal(m.buttons[13].pressed, true);
    assert.equal(m.buttons[1].pressed, false);
    assert.equal(m.axes[0], -0.7);
    assert.equal(m.axes[1], -0.9);
    assert.equal(m.buttons.length, 17);
});

test('mergePads: pads with different numbers of buttons or axes merge without errors', () => {
    const a = pad(0, [], [0.5, 0]);
    a.buttons = a.buttons.slice(0, 4);
    const m = mergePads([a, pad(1, [10], [0, 0, 0.4, 0])]);
    assert.equal(m.buttons.length, 17);
    assert.equal(m.buttons[10].pressed, true);
    assert.equal(m.axes[0], 0.5);
    assert.equal(m.axes[2], 0.4);
});

test('mergedPad merges what is connected now', () => {
    slots = [pad(0, [3]), pad(1, [4])];
    const m = mergedPad();
    assert.equal(m.buttons[3].pressed && m.buttons[4].pressed, true);
});

test('PadControls: the stick and the D-pad steer, with a dead zone', () => {
    slots = [pad(0, [], [0.1, 0.15, 0, 0])];
    const c = new PadControls(0);
    assert.deepEqual([c.poll().x, c.poll().y], [0, 0]);
    slots = [pad(0, [], [0.8, -0.5, 0, 0])];
    const r = c.poll();
    assert.equal(r.x, 0.8); assert.equal(r.y, -0.5);
    slots = [pad(0, [14, 13])];
    const d = c.poll();
    assert.equal(d.x, -1); assert.equal(d.y, 1);
});

test('PadControls: fire (A or RT) and alt (LB) are one-frame presses', () => {
    const c = new PadControls(0);
    slots = [pad(0)]; c.poll();
    slots = [pad(0, [0])];
    assert.equal(c.poll().fire, true);
    assert.equal(c.poll().fire, false, 'held: no second press');
    assert.equal(c.poll().fireHeld, true);
    slots = [pad(0)]; c.poll();
    slots = [pad(0, [], [0, 0, 0, 0], { 7: 0.9 })];
    assert.equal(c.poll().fire, true, 'RT counts');
    slots = [pad(0)]; c.poll();
    slots = [pad(0, [4])];
    const a = c.poll();
    assert.equal(a.alt, true); assert.equal(a.fire, false);
});

test('PadControls: a button already held when it starts is not a press; a missing pad is idle and lost', () => {
    slots = [pad(0, [0])];
    const c = new PadControls(0);
    assert.equal(c.poll().fire, false);
    slots = [];
    const gone = c.poll();
    assert.equal(gone.lost, true); assert.equal(gone.x, 0); assert.equal(gone.fire, false);
    assert.equal(new PadControls(-1).poll().lost, true);
});

/** A stand-in for an ArcadeGame: a scene with a frame counter and a host that has its own fields. */
function fakeGame() {
    const host = { score: 0, flashes: [], addScore(n) { this.score += n; }, setScore(n) { this.score = n; }, flash(t) { this.flashes.push(t); }, controls: { x: 99 } };
    const game = { scene: { game: { frame: 0, getFrame() { return this.frame; } } }, host };
    return { game, host, nextFrame: () => { game.scene.game.frame++; } };
}

test('givePads: both players\' controls are read once per frame', () => {
    slots = [pad(0, [], [0.9, 0, 0, 0]), pad(1, [], [-0.9, 0, 0, 0])];
    const { game, nextFrame } = fakeGame();
    givePads(game);
    assert.deepEqual(game.padIdx, [0, 1]);
    const a = game.pads();
    assert.equal(a[0].x, 0.9); assert.equal(a[1].x, -0.9);
    slots = [pad(0), pad(1)];
    assert.equal(game.pads()[0].x, 0.9, 'same frame: same answer');
    nextFrame();
    assert.equal(game.pads()[0].x, 0, 'next frame: read again');
});

test('givePads: host.controls is the pad of whoever is named, nobody gets nothing', () => {
    slots = [pad(0, [], [0.9, 0, 0, 0]), pad(1, [], [-0.9, 0, 0, 0])];
    const { game, nextFrame } = fakeGame();
    let turn = 0;
    givePads(game, () => turn);
    assert.equal(game.host.controls.x, 0.9);
    turn = 1; nextFrame();
    assert.equal(game.host.controls.x, -0.9);
    turn = null; nextFrame();
    assert.equal(game.host.controls.x, 0);
    assert.equal(game.host.controls.lost, true);
});

test('givePads: host methods still work on the real host, and the score is ignored', () => {
    slots = [pad(0), pad(1)];
    const { game, host } = fakeGame();
    givePads(game);
    game.host.addScore(50); game.host.setScore(7);
    assert.equal(host.score, 0);
    game.host.flash('hello');
    assert.deepEqual(host.flashes, ['hello']);
    game.host.newField = 5;                                     // writes land on the real host too
    assert.equal(host.newField, 5);
});

test('givePads: a pad that goes away is reported once, and again after it comes back and goes', () => {
    slots = [pad(0), pad(1)];
    const { game, host, nextFrame } = fakeGame();
    givePads(game);
    game.pads();
    slots = [pad(0)]; nextFrame(); game.pads();
    nextFrame(); game.pads();
    assert.deepEqual(host.flashes, ['PLAYER 2: GAME PAD LOST']);
    slots = [pad(0), pad(1)]; nextFrame(); game.pads();
    slots = [pad(0)]; nextFrame(); game.pads();
    assert.equal(host.flashes.length, 2);
});

test('givePads with fewer than two pads: the missing player is lost from the start', () => {
    slots = [pad(0)];
    const { game, host } = fakeGame();
    givePads(game);
    assert.deepEqual(game.padIdx, [0]);
    const p = game.pads();
    assert.equal(p[0].lost, false); assert.equal(p[1].lost, true);
    assert.deepEqual(host.flashes, ['PLAYER 2: GAME PAD LOST']);
});

// ---- ActivePadTracker: the Settings gamepad test shows one pad at a time, and follows the one being used

import { ActivePadTracker, padActive } from '../src/systems/Gamepads.js';

test('padActive: a button, a trigger or a pushed stick; an idle pad is not', () => {
    assert.equal(padActive(null), false);
    assert.equal(padActive(pad(0)), false);
    assert.equal(padActive(pad(0, [2])), true);
    assert.equal(padActive(pad(0, [], [0, 0, 0, 0], { 7: 0.5 })), true);
    assert.equal(padActive(pad(0, [], [0.1, 0.2, 0, 0])), false, 'a little stick drift is not use');
    assert.equal(padActive(pad(0, [], [0, -0.9, 0, 0])), true);
});

test('ActivePadTracker: no pad, one pad, then a second pad that is used', () => {
    const t = new ActivePadTracker();
    assert.deepEqual(t.update([]), { pad: null, number: 0, count: 0 });
    const a = pad(0), b = pad(1);
    let r = t.update([a]);
    assert.equal(r.pad, a); assert.equal(r.number, 1); assert.equal(r.count, 1);
    r = t.update([a, b]);
    assert.equal(r.pad, a, 'both idle: it stays on the first');
    assert.equal(r.count, 2);
    const b2 = pad(1, [0]);
    r = t.update([a, b2]);
    assert.equal(r.pad, b2, 'the second pad is used: it takes over');
    assert.equal(r.number, 2);
    r = t.update([a, pad(1)]);
    assert.equal(r.number, 2, 'and stays on it when everything is idle again');
    r = t.update([pad(0, [3]), pad(1)]);
    assert.equal(r.number, 1, 'the first pad is used: back to it');
});

test('ActivePadTracker: the pad being shown keeps the screen while it is used, even if the other is used too', () => {
    const t = new ActivePadTracker();
    t.update([pad(0), pad(1, [0])]);                          // shows pad 2
    const r = t.update([pad(0, [5]), pad(1, [0])]);
    assert.equal(r.number, 2);
});

test('ActivePadTracker: when the shown pad is unplugged it falls back to what is left', () => {
    const t = new ActivePadTracker();
    t.update([pad(0), pad(1, [0])]);
    const r = t.update([pad(0), null]);
    assert.equal(r.number, 1); assert.equal(r.count, 1);
    assert.equal(t.update([null, null]).pad, null);
});
