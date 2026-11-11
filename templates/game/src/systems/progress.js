// src/systems/progress.js
// Best score per level, kept in localStorage and mirrored to the signed-in account.
// AccountScopedStore handles the identity rules (a guest's data merges into the account
// that signs in; another account's data is never inherited). Replace the data shape with
// whatever your game saves — keep `merge` (best wins) and `serialize` in step with it.
import { AccountScopedStore, firebaseService } from '@gamebase/gbengine';
import { leaderboardService } from './leaderboardService.js';

const store = new AccountScopedStore({
    firebaseService,
    storageKey: '{{SLUG}}_progress',
    readPath:   uid => `games/{{SLUG}}/personalScores/${uid}`,          // database.rules.json: per-user
    writePath:  uid => `games/{{SLUG}}/personalScores/${uid}/progress`,
    emptyData:  () => ({ best: {} }),                                     // { [level]: score }
    merge: (local, node) => {
        for (const [level, score] of Object.entries(node.progress?.best ?? {})) {
            if (!(local.best[level] >= score)) local.best[level] = score;
        }
    },
    serialize: data => ({ best: data.best }),
});

/** Call from SceneController: a guest session must not see a signed-out account's progress. */
export const resetGuestProgress = () => store.resetForGuest();

/** Merges this device's progress with the signed-in account's. Cheap to call from any screen. */
export const syncProgress = () => store.sync();

/** Best score per level: [{ level, score }] ascending by level. */
export function bestScores() {
    return Object.entries(store.data.best).map(([level, score]) => ({ level: Number(level), score })).sort((a, b) => a.level - b.level);
}

/** Highest level completed (0 if none) — the next one is unlocked. */
export function highestCompleted() {
    return Math.max(0, ...bestScores().map(s => s.level));
}

/**
 * Records a level completion: keeps the best score locally and in the account, and posts
 * it to the leaderboard (a no-op without an account and a player name).
 */
export function recordCompletion(level, score) {
    const best = store.data.best;
    if (!(best[level] >= score)) {
        best[level] = score;
        store.save();
        store.writeRecord(`best/${level}`, score);
    }
    leaderboardService.submitScore(score, level, 'medium');
}

/** Posts local bests the leaderboard doesn't have yet (levels played as a guest, before a name was set). */
export async function publishLocalScores() {
    await syncProgress();
    await leaderboardService.publishMissingScores(
        bestScores().map(s => ({ score: s.score, level: s.level, difficulty: 'medium' })),
    );
}
