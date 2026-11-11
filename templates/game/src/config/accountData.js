// src/config/accountData.js
// Where {{NAME}} stores a player's data — used by account deletion (the Settings
// Delete Account button and the delete-account web page). Keep in sync with
// database.rules.json; update it whenever a new per-player data path is added.
export const ACCOUNT_DATA = {
    perUserPaths: ['{{SLUG}}-settings', 'games/{{SLUG}}/personalScores'], // <path>/<uid> is removed
    leaderboards: ['{{SLUG}}-leaderboard'],                              // entries whose playerId == uid are removed
};
