// menuButtonSize: a button always fits the gap it is given (while there is any room), and the normal size stays normal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuButtonSize, buttonHeight } from '../src/ui/menuButtonSize.js';

test('with plenty of room the normal 28px button with 20px padding comes back', () => {
    const s = menuButtonSize(80);
    assert.deepEqual([s.fontSize, s.padding], ['28px', 20]);
});

test('a tighter list gets a smaller font and padding, and the button is never taller than the gap less the space', () => {
    let last = Infinity;
    for (const gap of [75, 68, 60, 54, 50, 46, 42, 38, 34, 32]) {
        const s = menuButtonSize(gap);
        assert.ok(s.height <= gap - 6, `gap ${gap}: height ${s.height}`);
        const fs = parseInt(s.fontSize);
        assert.ok(fs <= last, 'the font only shrinks as the gap does');
        last = fs;
    }
});

test('the height it reports is the height of a button made with those options', () => {
    const s = menuButtonSize(50);
    assert.equal(s.height, buttonHeight(parseInt(s.fontSize), s.padding));
});

test('no room at all: the smallest button, not nonsense', () => {
    const s = menuButtonSize(10);
    assert.deepEqual([s.fontSize, s.padding], ['14px', 6]);
});

test('options: another top size, and the space between buttons', () => {
    assert.equal(menuButtonSize(200, { maxFont: 20 }).fontSize, '20px');
    assert.ok(menuButtonSize(50, { space: 20 }).height <= 30);
});
