/**
 * A piece of game data (level progress, unlocks, best scores…) that lives in
 * localStorage and is mirrored to the signed-in account's cloud copy, with the
 * identity rules that took many device tests to get right:
 *
 * - **Guest data merges into an account.** Local data with no `owner` (the
 *   player had no account yet) is kept and merged into whichever account signs
 *   in — new or existing — best-value-wins via your `merge()`.
 * - **A different account never inherits it.** Local data owned by another
 *   account is dropped and the signing-in account's cloud copy is loaded
 *   instead. `resetForGuest()` drops it when a guest session starts after an
 *   account signed out.
 * - **Once per account per session**, with a timeout, so it is cheap to call
 *   from any screen that shows the data and never hangs offline.
 * - **Never throws.**
 *
 * Reference implementation: Balloonatics' `src/systems/progress.js`.
 * @module systems/AccountScopedStore
 */

/**
 * @typedef {object} AccountScopedStoreOptions
 * @property {object}   firebaseService  The `firebaseService` singleton (injected so this stays testable).
 * @property {string}   storageKey       localStorage key.
 * @property {function(string): string} readPath
 *           Cloud node to read for `uid`, e.g. `uid => \`games/foo/personalScores/${uid}\``.
 * @property {function(string): string} [writePath]  Cloud node to write; defaults to `readPath`.
 * @property {function(): object} emptyData
 *           Fresh data for a new owner. May include any fields; `owner` is added/managed here.
 * @property {function(object, object): void} merge
 *           `merge(localData, cloudNode)` — fold the cloud copy into local data (best value wins). Mutate `localData`.
 * @property {function(object): object} serialize
 *           Local data → the object stored in the cloud (include a `migrated: true` marker if you use `migrate`).
 * @property {function(object): boolean} [isMigrated]
 *           True once the one-time `migrate()` has run for this account (read from the cloud node). Default: always true.
 * @property {function(object, string, object, object): (void|Promise<void>)} [migrate]
 *           One-time per-account hook `migrate(localData, uid, cloudNode, authUser)` — e.g. rebuild history from leaderboard submissions.
 * @property {function(object): object} [revive]
 *           Rebuilds data from what was stored locally; default shallow-merges onto `emptyData()`.
 * @property {number}   [timeoutMs=10000]  Give up waiting for the cloud after this long.
 */

export class AccountScopedStore {
    /** @param {AccountScopedStoreOptions} options */
    constructor(options) {
        this._o         = { timeoutMs: 10000, ...options };
        this._fb        = options.firebaseService;
        this._data      = null;
        this._syncedUid = null;   // account the local data was last merged with
        this._syncing   = null;   // { uid, promise } while a sync is in flight
    }

    /** The live local data (loaded from localStorage on first use). */
    get data() { return this._load(); }

    /** Persists the local data. Call after mutating `store.data`. */
    save() {
        try { localStorage.setItem(this._o.storageKey, JSON.stringify(this._data)); } catch { /* storage full */ }
    }

    /**
     * Signed-in Firebase uid, or null if signed out / offline.
     * @returns {string|null}
     */
    cloudUid() {
        if (!this._fb.isReady() || !this._fb.getDatabase()) return null;
        return this._fb.getUser()?.uid ?? null;
    }

    /**
     * Call when a guest session starts (`initSession({ onGuestStart })`): drops
     * data that belongs to an account that was signed out on this device, so a
     * guest never sees someone else's progress. Earlier guest data is kept.
     */
    resetForGuest() {
        if (this._load().owner) { this._data = this._empty(null); this.save(); }
        this._syncedUid = null;
    }

    /**
     * Writes one value under the account's cloud node (e.g. a single record
     * after the player earns it). No-op when signed out. Never throws.
     * @param {string} relPath  Path below `writePath(uid)`.
     * @param {*} value
     */
    writeRecord(relPath, value) {
        const uid = this.cloudUid();
        if (!uid) return;
        const { ref, set } = this._fb.getFunctions();
        set(ref(this._fb.getDatabase(), `${this._writePath(uid)}/${relPath}`), value)
            .catch(e => console.warn('[AccountScopedStore] cloud save failed:', e));
    }

    /**
     * Merges local data with the signed-in account's cloud copy and writes the
     * result to both. Only does the work once per account.
     * @returns {Promise<boolean>} True if the local data changed.
     */
    sync() {
        const uid = this.cloudUid();
        if (!uid || uid === this._syncedUid) return Promise.resolve(false);
        if (this._syncing?.uid === uid) return this._syncing.promise;

        const timeout = new Promise(resolve => setTimeout(() => resolve(false), this._o.timeoutMs));
        const promise = Promise.race([this._sync(uid), timeout])
            .finally(() => { if (this._syncing?.promise === promise) this._syncing = null; });
        this._syncing = { uid, promise };
        return promise;
    }

    // -------------------------------------------------------------------------

    _empty(owner = null) { return { ...this._o.emptyData(), owner }; }

    _writePath(uid) { return (this._o.writePath ?? this._o.readPath)(uid); }

    _load() {
        if (this._data) return this._data;
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(this._o.storageKey)); } catch { /* corrupt */ }
        if (stored && typeof stored === 'object') {
            const base = this._empty(null);
            this._data = this._o.revive
                ? this._o.revive(stored)
                : { ...base, ...stored, owner: stored.owner ?? null };
        } else {
            this._data = this._empty(null);
            this.save();
        }
        return this._data;
    }

    async _sync(uid) {
        try {
            const { ref, get, set } = this._fb.getFunctions();
            const db   = this._fb.getDatabase();
            const snap = await get(ref(db, this._o.readPath(uid)));
            const node = snap.exists() ? snap.val() : {};

            let data = this._load();
            const before  = JSON.stringify(data);
            const isGuest = this._fb.getUser()?.isAnonymous ?? true;

            // Data saved under a different account stays with that account —
            // start from this account's cloud copy instead of merging the two.
            // Guest data (no owner — the device had no account) is kept and
            // merged into whichever account signs in, new or existing.
            if (!isGuest && data.owner && data.owner !== uid) data = this._data = this._empty(null);
            if (!isGuest) data.owner = uid;

            this._o.merge(data, node);
            if (this._o.migrate && !(this._o.isMigrated?.(node) ?? true)) {
                await this._o.migrate(data, uid, node, this._fb.getUser());
            }
            this.save();
            this._syncedUid = uid;

            await set(ref(db, this._writePath(uid)), this._o.serialize(data));
            return JSON.stringify(data) !== before;
        } catch (e) {
            console.warn('[AccountScopedStore] sync failed:', e);
            return false;
        }
    }
}
