import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers.mjs';

globalThis.window = globalThis.window ?? globalThis;
const { firebaseService } = await import('../src/systems/FirebaseService.js');
const { Settings } = await import('../src/systems/SettingsManager.js');
const { initSession } = await import('../src/systems/Session.js');

// Drive the real singleton by overriding the few members initSession reads.
function auth({ provider = 'none', timedOut = false } = {}) {
    firebaseService.getAuthProvider = () => provider;
    firebaseService.authRestoreTimedOut = timedOut;
    firebaseService.signedOut = false;
    firebaseService.signOut = async () => { firebaseService.signedOut = true; };
}

beforeEach(() => { installLocalStorage(); Settings.playerName = ''; });

test('a restored Google / name+PIN session is left alone', async () => {
    auth({ provider: 'google' });
    localStorage.setItem('playerName', 'tester');
    let reset = false;
    const r = await initSession({ onGuestStart: () => { reset = true; } });
    assert.deepEqual(r, { guest: false });
    assert.equal(localStorage.getItem('playerName'), 'tester');
    assert.equal(reset, false);
});

test('signed out: the player is a guest — leftover name cleared, onGuestStart runs', async () => {
    auth({ provider: 'none' });
    localStorage.setItem('playerName', 'old-account-name');
    Settings.playerName = 'old-account-name';
    let reset = false;
    const r = await initSession({ onGuestStart: () => { reset = true; } });
    assert.deepEqual(r, { guest: true });
    assert.equal(localStorage.getItem('playerName'), null);
    assert.equal(Settings.playerName, '');
    assert.equal(reset, true);
});

test('a legacy anonymous account with no name is signed out; with a name it is kept', async () => {
    auth({ provider: 'anonymous' });
    assert.equal((await initSession()).guest, true);
    assert.equal(firebaseService.signedOut, true);

    auth({ provider: 'anonymous' });
    localStorage.setItem('playerName', 'named');
    assert.equal((await initSession()).guest, false);
    assert.equal(firebaseService.signedOut, false);
});

test('a timed-out session restore does not wipe the name or call onGuestStart', async () => {
    auth({ provider: 'none', timedOut: true });
    localStorage.setItem('playerName', 'tester');
    let reset = false;
    const r = await initSession({ onGuestStart: () => { reset = true; } });
    assert.deepEqual(r, { guest: false, uncertain: true });
    assert.equal(localStorage.getItem('playerName'), 'tester');
    assert.equal(reset, false);
});

test('a throwing onGuestStart does not stop the guest session', async () => {
    auth({ provider: 'none' });
    const r = await initSession({ onGuestStart: () => { throw new Error('boom'); } });
    assert.equal(r.guest, true);
});
