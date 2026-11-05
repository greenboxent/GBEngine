/**
 * Permanent account deletion (Google Play requires an in-app path *and* a web URL).
 *
 * Takes the Firebase `auth` / `db` instances as parameters instead of using
 * {@link firebaseService}, so the in-game dialog ({@link showDeleteAccountDialog})
 * and the standalone web page ({@link mountDeleteAccountPage}) share it.
 *
 * Each game describes where it keeps a player's data with an {@link AccountDataConfig}.
 * Its database rules must let a signed-in user delete their own records — see the
 * "Account deletion" section of the README.
 * @module systems/AccountDeletion
 */

/**
 * Where a game stores a player's data in the Realtime Database.
 * @typedef {object} AccountDataConfig
 * @property {string[]} [perUserPaths]  Roots holding one record per uid; `<path>/<uid>` is removed
 *   (e.g. `['balloonatics-settings', 'games/balloonatics/personalScores']`).
 * @property {string[]} [leaderboards]  Leaderboard roots; every entry whose `ownerField` equals the
 *   uid is removed. Needs `.indexOn: ["<ownerField>"]` in the rules.
 * @property {string} [ownerField='playerId']  Field on a leaderboard entry holding the owner's uid.
 * @property {string|null} [nameIndex='playerNames']  uid-valued player-name index (see README);
 *   needs `.indexOn: ".value"`. `null` if the game has none.
 */

/** @returns {string|undefined} 'google.com' | 'password' | 'anonymous', or undefined when signed out. */
export function authProviderId(user) {
    if (!user) return undefined;
    return user.isAnonymous ? 'anonymous' : user.providerData[0]?.providerId;
}

/** Re-authenticate a name+PIN account (its synthetic email is the user's email). */
export async function reauthWithPin(user, pin) {
    const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
    return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pin));
}

/** Re-authenticate a Google account with the browser popup (web only — native uses the plugin). */
export async function reauthWithGooglePopup(user) {
    const { GoogleAuthProvider, reauthenticateWithPopup } = await import('firebase/auth');
    return reauthenticateWithPopup(user, new GoogleAuthProvider());
}

/** Human-readable text for the errors a deletion attempt can produce. */
export function deletionErrorMessage(error) {
    switch (error?.code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential':      return 'Incorrect PIN.';
        case 'auth/user-mismatch':           return 'That is a different account from the one you are signed in with.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request': return 'Sign-in was cancelled.';
        case 'auth/too-many-requests':       return 'Too many attempts. Try again later.';
        case 'auth/network-request-failed':  return 'Network error. Check your connection and try again.';
        default: return error?.message || 'Something went wrong. Please try again.';
    }
}

/**
 * Delete the current user's database records and then the Firebase Auth account.
 *
 * Non-guest accounts are re-authenticated first (Firebase refuses to delete an
 * account whose sign-in is stale) via the caller's `reauthenticate(user)`, which
 * must throw if the user cancels or proves to be someone else. Data goes before
 * the account because the security rules need the user signed in to delete it.
 *
 * @param {import('firebase/auth').Auth} auth
 * @param {import('firebase/database').Database} db
 * @param {AccountDataConfig} config
 * @param {{ reauthenticate?: (user: import('firebase/auth').User) => Promise<void> }} [opts]
 * @returns {Promise<void>}
 */
export async function deleteAccount(auth, db, config, { reauthenticate } = {}) {
    const { perUserPaths = [], leaderboards = [], ownerField = 'playerId', nameIndex = 'playerNames' } = config ?? {};
    const user = auth.currentUser;
    if (!user) throw new Error('You are not signed in.');
    if (!user.isAnonymous && reauthenticate) await reauthenticate(user);

    const { deleteUser, signOut } = await import('firebase/auth');
    const { ref, get, update, query, orderByChild, orderByValue, equalTo } = await import('firebase/database');
    const uid = user.uid;

    const wipe = {};
    for (const path of perUserPaths) wipe[`${path}/${uid}`] = null;

    const lookups = leaderboards.map(async root => {
        const snap = await get(query(ref(db, root), orderByChild(ownerField), equalTo(uid)));
        snap.forEach(s => { wipe[`${root}/${s.key}`] = null; });
    });
    if (nameIndex) {
        lookups.push((async () => {
            const snap = await get(query(ref(db, nameIndex), orderByValue(), equalTo(uid)));
            snap.forEach(s => { wipe[`${nameIndex}/${s.key}`] = null; });
        })());
    }
    await Promise.all(lookups);

    if (Object.keys(wipe).length) await update(ref(db), wipe);

    try {
        await deleteUser(user);
    } catch (e) {
        // A long-lived guest session can't be re-authenticated; its data is already gone,
        // so just drop the orphaned anonymous account from this device.
        if (e.code === 'auth/requires-recent-login' && user.isAnonymous) await signOut(auth);
        else throw e;
    }
}
