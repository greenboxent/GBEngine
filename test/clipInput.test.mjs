// clipInput: a clipped (scrolled out of view) object does not take presses meant for what is on top of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipInput } from '../src/ui/components/clipInput.js';

const hit = (o, x, y) => o.input.hitAreaCallback(o.input.hitArea, x, y, o);
const button = (name, list) => ({ name, input: { hitArea: {}, hitAreaCallback: () => true }, list });

test('a point outside the visible area misses, inside it hits, whatever the original hit test says', () => {
    const b = button('delete');
    clipInput(b, (go, x, y) => y < 100);
    assert.equal(hit(b, 5, 50), true);
    assert.equal(hit(b, 5, 150), false, 'clipped part');
    const never = button('never'); never.input.hitAreaCallback = () => false;
    clipInput(never, () => true);
    assert.equal(hit(never, 5, 5), false, 'its own hit area still decides');
});

test('everything inside a container is clipped, however deep, and non-interactive objects are skipped', () => {
    const inner = button('inner'), mid = { list: [inner, { list: [] }, { name: 'plain text' }] }, root = { list: [mid, button('sibling')] };
    clipInput(root, () => false);
    assert.equal(hit(inner, 0, 0), false);
    assert.equal(hit(root.list[1], 0, 0), false);
});

test('calling it again does not wrap twice, and picks up objects made interactive later', () => {
    let calls = 0;
    const late = { list: [] }, root = { list: [late] };
    const inside = () => { calls++; return true; };
    clipInput(root, inside); clipInput(root, inside);
    late.input = { hitArea: {}, hitAreaCallback: () => true };                  // setInteractive after it was added
    clipInput(root, inside); clipInput(root, inside);
    assert.equal(hit(late, 1, 1), true);
    assert.equal(calls, 1, 'one wrapper, one check');
});

test('the visible area can change between presses (the list scrolls)', () => {
    let top = 0;
    const b = button('x');
    clipInput(b, (go, x, y) => y >= top);
    assert.equal(hit(b, 0, 10), true);
    top = 50;
    assert.equal(hit(b, 0, 10), false);
});
