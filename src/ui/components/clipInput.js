/**
 * Makes the interactive objects inside a clipped area (a scrolling list) answer touches only where they can be seen.
 * A mask hides what is outside a viewport but does not stop it being pressed, so a button scrolled out of view that sits under another
 * button (Back, say) would take that button's press. Phaser-free, so it can be tested.
 * @module ui/components/clipInput
 */

/**
 * Wraps the hit test of `obj` and everything inside it (a container's `list`, recursively) so that a point only counts when
 * `inside(worldX, worldY)` is true as well. Objects already wrapped are left alone, so call it as often as needed (objects made
 * interactive after they were added are picked up on the next call).
 * @param {object} obj A Phaser game object (or anything with `input` and `list`).
 * @param {(go: object, x: number, y: number) => boolean} inside Whether the hit-test point (x, y in the object's own space, origin
 *   at its top left, as Phaser passes it to `hitAreaCallback`) lies inside the visible area.
 */
export function clipInput(obj, inside) {
    const inp = obj?.input;
    if (inp && !inp.clipWrapped && typeof inp.hitAreaCallback === 'function') {
        inp.clipWrapped = true;
        const orig = inp.hitAreaCallback;
        inp.hitAreaCallback = (area, x, y, go) => orig(area, x, y, go) && inside(go ?? obj, x, y);
    }
    if (Array.isArray(obj?.list)) for (const c of obj.list) clipInput(c, inside);
}
