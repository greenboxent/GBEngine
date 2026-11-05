/**
 * Player-name → Firebase key helpers. A separate dependency-free module so the
 * standalone delete-account page can use them without loading the engine.
 * @module systems/nameKey
 */

/** Synthetic email domain used to turn a player name + PIN into a real Firebase Auth credential. */
export const NAME_AUTH_DOMAIN = 'players.gbent';

/**
 * Normalise a player name to a Firebase-safe key (also used as the local
 * part of the synthetic name+PIN auth email — see `FirebaseService#signInWithNamePin`).
 * Lowercases, replaces dots with `_dot_`, and strips `# $ [ ] /`.
 * @param {string} name  Raw player name to sanitise.
 * @returns {string}
 */
export function sanitizeNameKey(name) {
    return name.toLowerCase().replace(/\./g, '_dot_').replace(/[#$[\]/]/g, '_');
}
