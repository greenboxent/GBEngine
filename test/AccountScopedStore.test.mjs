import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage, makeFakeFirebase } from './helpers.mjs';
import { AccountScopedStore } from '../src/systems/AccountScopedStore.js';

beforeEach(() => installLocalStorage());

// A tiny "best score per level" store, like Balloonatics' progress.
const make = (fb, extra = {}) => new AccountScopedStore({
    firebaseService: fb,
    storageKey: 'progress',
    readPath: uid => `scores/${uid}`,
    emptyData: () => ({ levels: {} }),
    merge: (local, node) => {
        for (const [lvl, score] of Object.entries(node.levels ?? {})) {
            if (!(local.levels[lvl] >= score)) local.levels[lvl] = score;
        }
    },
    serialize: d => ({ levels: d.levels }),
    timeoutMs: 200,
    ...extra,
});

const google = uid => ({ uid, isAnonymous: false });

test('guest data (no owner) is kept and merged into the account that signs in', async () => {
    const fb = makeFakeFirebase({ user: null, tree: { scores: { A: { levels: { 1: 500, 2: 100 } } } } });
    const store = make(fb);
    store.data.levels[1] = 300; store.data.levels[3] = 900; store.save(); // played as a guest
    fb.user = google('A');
    assert.equal(await store.sync(), true);
    assert.deepEqual(store.data.levels, { 1: 500, 2: 100, 3: 900 }); // best of each
    assert.equal(store.data.owner, 'A');
    assert.deepEqual(fb.tree.scores.A.levels, { 1: 500, 2: 100, 3: 900 }); // written back to the cloud
});

test('data owned by another account is replaced by the signing-in account\'s cloud copy', async () => {
    const fb = makeFakeFirebase({ user: google('B'), tree: { scores: { B: { levels: { 7: 70 } } } } });
    const store = make(fb);
    store.data.owner = 'A'; store.data.levels[1] = 999; store.save();
    await store.sync();
    assert.deepEqual(store.data.levels, { 7: 70 }); // A's progress did not leak into B
    assert.equal(store.data.owner, 'B');
});

test('runs once per account per session', async () => {
    const fb = makeFakeFirebase({ user: google('A') });
    const store = make(fb);
    await store.sync();
    const gets = fb.calls.get;
    assert.equal(await store.sync(), false);
    assert.equal(fb.calls.get, gets); // no second cloud read
});

test('concurrent syncs share one cloud read', async () => {
    const fb = makeFakeFirebase({ user: google('A') });
    const store = make(fb);
    await Promise.all([store.sync(), store.sync(), store.sync()]);
    assert.equal(fb.calls.get, 1);
});

test('resetForGuest drops account-owned data but keeps earlier guest data', () => {
    const fb = makeFakeFirebase();
    const owned = make(fb);
    owned.data.owner = 'A'; owned.data.levels[1] = 5; owned.save();
    const reload = make(fb);
    reload.resetForGuest();
    assert.deepEqual(reload.data.levels, {});
    assert.equal(reload.data.owner, null);

    const guest = make(fb);
    guest.data.levels[2] = 9; guest.save();
    const again = make(fb);
    again.resetForGuest();
    assert.deepEqual(again.data.levels, { 2: 9 });
});

test('gives up after the timeout when offline, and never throws', async () => {
    const fb = makeFakeFirebase({ user: google('A'), hang: true });
    const store = make(fb);
    assert.equal(await store.sync(), false);
});

test('a failing cloud read resolves false instead of throwing', async () => {
    const fb = makeFakeFirebase({ user: google('A') });
    fb.functions.get = async () => { throw new Error('permission denied'); };
    assert.equal(await make(fb).sync(), false);
});

test('migrate runs once, only while the account is not marked migrated', async () => {
    const fb = makeFakeFirebase({ user: google('A') });
    let ran = 0;
    const opts = {
        isMigrated: node => !!node.migrated,
        migrate: d => { ran++; d.levels[9] = 1; },
        serialize: d => ({ levels: d.levels, migrated: true }),
    };
    await make(fb, opts).sync();
    assert.equal(ran, 1);
    await make(fb, opts).sync(); // new session: cloud now says migrated
    assert.equal(ran, 1);
});

test('signed-out sync does nothing; writeRecord is a no-op signed out and writes under the account when in', async () => {
    const fb = makeFakeFirebase({ user: null });
    const store = make(fb);
    assert.equal(await store.sync(), false);
    store.writeRecord('levels/1', 5);
    assert.equal(fb.calls.set, 0);
    fb.user = google('A');
    store.writeRecord('levels/1', 5);
    await new Promise(r => setTimeout(r, 10));
    assert.equal(fb.tree.scores.A.levels[1], 5);
});
