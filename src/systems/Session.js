/**
 * Start-of-app identity for games with no login screen: the game opens on the
 * main menu and a player signs in (Google) or claims a name+PIN later from
 * Settings (see `BaseSettingsScene._buildAccountSection`).
 *
 * The rule: **no account ⇒ no player name**. A name only exists together with
 * an account, so a signed-out player is a local guest with nothing in the
 * database; their progress lives in localStorage until they sign in, when it
 * merges into the account (see `AccountScopedStore`).
 * @module systems/Session
 */

import { firebaseService } from './FirebaseService.js';
import { Settings } from './SettingsManager.js';

/**
 * Settles who is playing. Call once from `SceneController._onReady()`, before
 * the main menu shows, after `firebaseService.init()` and `Settings.load()`.
 *
 * - A restored Google / name+PIN session is left alone.
 * - Otherwise the player is a guest: any player name left on the device is
 *   cleared (it belonged to an account that is gone) and `onGuestStart` runs
 *   so the game can drop progress that belongs to that account.
 * - A legacy anonymous account with no name is signed out so it saves nothing.
 * - If the session restore timed out (`firebaseService.authRestoreTimedOut`)
 *   "nobody is signed in" is only a guess, so nothing is wiped.
 *
 * @param {object} [options]
 * @param {function(): (void|Promise<void>)} [options.onGuestStart]
 *        Runs when the player starts as a guest — e.g. `() => store.resetForGuest()`.
 * @returns {Promise<{guest: boolean, uncertain?: boolean}>}
 */
export async function initSession({ onGuestStart } = {}) {
    const fb       = firebaseService;
    const provider = fb.getAuthProvider();
    const hasName  = !!(localStorage.getItem('playerName') || '').trim();

    if (provider !== 'none' && !(provider === 'anonymous' && !hasName)) return { guest: false };
    if (provider === 'none' && fb.authRestoreTimedOut) return { guest: false, uncertain: true };

    try {
        if (provider === 'anonymous') await fb.signOut();
        localStorage.removeItem('playerName');
        if (Settings.playerName) Settings.playerName = ''; // signed out, so this only saves locally
        await onGuestStart?.();
    } catch { /* proceed as a guest regardless */ }
    return { guest: true };
}
