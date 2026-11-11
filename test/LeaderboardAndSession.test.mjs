import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage, makeFakeFirebase } from './helpers.mjs';

globalThis.window = globalThis.window ?? globalThis; // Debug/Capacitor touch window at import
const { LeaderboardService } = await import('../src/systems/LeaderboardService.js');

beforeEach(() => installLocalStorage());

const google = uid => ({ uid, isAnonymous: false });
const board = fb => new LeaderboardService({ firebaseService: fb, collectionPath: 'lb', backendMode: 'firebase' });

test('publishMissingScores posts only scores the account does not already have', async () => {
    localStorage.setItem('playerName', 'tester');
    const fb = makeFakeFirebase({
        user: google('A'),
        tree: { lb: { e1: { playerId: 'A', playerName: 'tester', score: 500, level: 1, difficulty: 'easy' } } },
    });
    const lb = board(fb);
    const posted = await lb.publishMissingScores([
        { score: 500, level: 1, difficulty: 'easy' },   // already there
        { score: 925, level: 1, difficulty: 'easy' },   // improved
        { score: 1525, level: 2, difficulty: 'easy' },  // new level
    ], { extra: { difficultyScaled: true } });
    assert.equal(posted, 2);
    const entries = Object.values(fb.tree.lb);
    assert.equal(entries.length, 3);
    assert.ok(entries.every(e => e.playerId === 'A' && e.playerName === 'tester'));
    assert.ok(entries.filter(e => e.difficultyScaled).length === 2);
});

test('publishMissingScores is idempotent and runs once per session', async () => {
    localStorage.setItem('playerName', 'tester');
    const fb = makeFakeFirebase({ user: google('A') });
    const entries = [{ score: 100, level: 1, difficulty: 'easy' }];
    assert.equal(await board(fb).publishMissingScores(entries), 1);
    assert.equal(await board(fb).publishMissingScores(entries), 0); // fresh instance: already on the board
    const lb = board(makeFakeFirebase({ user: google('A') }));
    await lb.publishMissingScores(entries);
    assert.equal(await lb.publishMissingScores(entries), 0);        // same instance: guarded
});

test('publishMissingScores does nothing without a name, an account, or for guests', async () => {
    const entries = [{ score: 1, level: 1, difficulty: 'easy' }];
    assert.equal(await board(makeFakeFirebase({ user: google('A') })).publishMissingScores(entries), 0); // no name
    localStorage.setItem('playerName', 'tester');
    assert.equal(await board(makeFakeFirebase({ user: null })).publishMissingScores(entries), 0);        // signed out
    assert.equal(await board(makeFakeFirebase({ user: { uid: 'G', isAnonymous: true } })).publishMissingScores(entries), 0);
});

test('getTopScores works for a signed-out guest (public-read leaderboard)', async () => {
    const fb = makeFakeFirebase({ user: null, tree: { lb: { e1: { playerId: 'A', playerName: 'tester', score: 5, level: 1, difficulty: 'easy' } } } });
    fb.functions.limitToLast = n => ({ n });
    fb.functions.query = r => ({ path: r.path });
    const scores = await board(fb).getTopScores(10);
    assert.equal(scores.length, 1);
    assert.equal(scores[0].playerName, 'tester');
});
