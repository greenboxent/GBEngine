// src/systems/Gamepads.js
// Game pad helpers that do not depend on Phaser, for games with more than one pad.
//
// Browsers only list a pad (navigator.getGamepads) after a button has been pressed on it, so a menu that needs pads should look again
// every moment (`padCount()`), and tell the player to press a button on each pad.
//
// Two ways to use several pads:
//   * One player at a time, any pad (menus): `mergePads` / `mergedPad` turn every connected pad into ONE pad. The InputController uses
//     it, so every pad steers the engine's menus.
//   * One pad per player (a two-player game): `givePads(game, who)` gives the game `game.pads()` (each player's controls this frame)
//     and makes `game.host.controls` the controls of whoever `who()` names, so a game written for one player just works when only
//     the player whose turn it is may steer it.

/** The connected game pads, in the order the browser lists them. */
export function connectedPads() {
    try { return [...(navigator.getGamepads?.() ?? [])].filter(p => p && p.connected !== false); } catch { return []; }
}

export const padCount = () => connectedPads().length;

/** The slots (navigator.getGamepads() indexes) of the first two connected pads. */
export const firstTwoPads = () => connectedPads().slice(0, 2).map(p => p.index);

/**
 * All the given pads as ONE pad: a button is down when it is down on any pad, an axis is the one pushed furthest. With a single pad that
 * pad itself comes back; with none, null.
 * @param {ArrayLike<Gamepad|null>} pads Usually navigator.getGamepads(); null entries and disconnected pads are skipped.
 */
export function mergePads(pads) {
    const list = Array.from(pads ?? []).filter(p => p && p.connected !== false);
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];
    const nb = Math.max(...list.map(p => p.buttons.length)), na = Math.max(...list.map(p => p.axes.length));
    const buttons = Array.from({ length: nb }, (_, i) => {
        let pressed = false, touched = false, value = 0;
        for (const p of list) { const b = p.buttons[i]; if (!b) continue; pressed ||= !!b.pressed; touched ||= !!b.touched; value = Math.max(value, b.value ?? 0); }
        return { pressed, touched, value };
    });
    const axes = Array.from({ length: na }, (_, i) => list.reduce((best, p) => (Math.abs(p.axes[i] ?? 0) > Math.abs(best) ? p.axes[i] : best), 0));
    return { id: 'merged', index: list[0].index, connected: true, mapping: list[0].mapping, timestamp: Math.max(...list.map(p => p.timestamp ?? 0)), buttons, axes };
}

/** The merged pad of everything connected right now (null without a pad). */
export const mergedPad = () => mergePads(connectedPads());

const dead = v => (Math.abs(v) > 0.2 ? v : 0);
const IDLE = Object.freeze({ x: 0, y: 0, fire: false, alt: false, fireHeld: false, altHeld: false, lost: true });

/**
 * One pad as game controls: the stick (or D-pad) as x / y (-1..1), and `fire` (RT or A) and `alt` (LB) as one-frame presses, the same
 * shape as the controls a game gets from the InputController. `lost` is true when the pad is not there (unplugged, or never seen).
 */
export class PadControls {
    /** @param {number} index The pad's slot in navigator.getGamepads(). */
    constructor(index) {
        this.index = index;
        this.prevFire = true;                      // (a button held while the game starts does not count as a press)
        this.prevAlt = true;
    }

    /** Reads the pad now; call once per frame (a press is reported once, on the frame it starts). */
    poll() {
        let p = null;
        try { p = (navigator.getGamepads?.() ?? [])[this.index] ?? null; } catch { /* no pad API */ }
        if (!p) return IDLE;
        const b = p.buttons;
        let x = dead(p.axes?.[0] ?? 0), y = dead(p.axes?.[1] ?? 0);
        if (b[14]?.pressed) x = -1; else if (b[15]?.pressed) x = 1;
        if (b[12]?.pressed) y = -1; else if (b[13]?.pressed) y = 1;
        const fireHeld = (b[7]?.value ?? 0) > 0.3 || !!b[0]?.pressed;
        const altHeld = !!b[4]?.pressed;
        const out = { x, y, fire: fireHeld && !this.prevFire, alt: altHeld && !this.prevAlt, fireHeld, altHeld, lost: false };
        this.prevFire = fireHeld; this.prevAlt = altHeld;
        return out;
    }
}

/**
 * Gives a two-player game one pad per player. Afterwards `game.padIdx` holds the two pads' slots and `game.pads()` returns both players'
 * controls for this frame (read once per frame, so any number of calls agree; call it every frame so presses are never missed). The
 * game's `host.controls` becomes the controls of whoever `who()` names (0 or 1, or null for nobody), and `host.addScore` / `setScore`
 * do nothing (a pad-against-pad game has no score). A pad that goes away mid-game flashes "PLAYER n: GAME PAD LOST".
 *
 * `game.host` is replaced by a Proxy of the real host; its methods stay bound to the real host, so they still change its own fields.
 * @param {{scene: {game: {getFrame: () => number}}, host: object}} game An ArcadeGame-like object.
 * @param {() => (0|1|null)} [who] Whose pad drives `host.controls`; omit for games that read `game.pads()` themselves.
 */
export function givePads(game, who = () => null) {
    game.padIdx = firstTwoPads();
    const pads = [new PadControls(game.padIdx[0] ?? -1), new PadControls(game.padIdx[1] ?? -1)];
    let frame = -1, cache = [IDLE, IDLE];
    const warned = [false, false];
    game.pads = () => {
        const f = game.scene.game.getFrame();
        if (f !== frame) {
            frame = f;
            cache = pads.map(p => p.poll());
            cache.forEach((c, i) => {
                if (c.lost && !warned[i]) { warned[i] = true; game.host.flash?.(`PLAYER ${i + 1}: GAME PAD LOST`, '#ff7755', 30); }
                if (!c.lost) warned[i] = false;
            });
        }
        return cache;
    };
    const base = game.host;
    game.host = new Proxy(base, {
        get(t, k) {
            if (k === 'controls') { const w = who(); return w == null ? IDLE : game.pads()[w]; }
            if (k === 'addScore' || k === 'setScore') return () => {};
            const v = Reflect.get(t, k, t);
            return typeof v === 'function' ? v.bind(t) : v;
        },
    });
}

/** Whether a pad is being used right now: a button down, a trigger pulled or a stick pushed. */
export function padActive(p) {
    if (!p) return false;
    return p.buttons.some(b => b.pressed || (b.value ?? 0) > 0.2) || p.axes.some(v => Math.abs(v) > 0.3);
}

/**
 * For a screen that can show ONE pad at a time (the Settings gamepad test) when several are connected: follows the pad that is being
 * used. Call `update(pads)` every frame with navigator.getGamepads(); it keeps showing the same pad until another one is used.
 */
export class ActivePadTracker {
    constructor() { this.index = null; }

    /**
     * @param {ArrayLike<Gamepad|null>} pads
     * @returns {{pad: Gamepad|null, number: number, count: number}} The pad to show, its place among the connected pads (1-based; 0 for none)
     *   and how many pads are connected.
     */
    update(pads) {
        const list = Array.from(pads ?? []).filter(p => p && p.connected !== false);
        if (list.length === 0) { this.index = null; return { pad: null, number: 0, count: 0 }; }
        let cur = list.find(p => p.index === this.index) ?? null;
        if (!cur || !padActive(cur)) {
            const used = list.find(p => padActive(p));
            if (used) cur = used;
        }
        cur ??= list[0];
        this.index = cur.index;
        return { pad: cur, number: list.indexOf(cur) + 1, count: list.length };
    }
}
