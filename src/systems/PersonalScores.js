/**
 * Manages personal high scores per level with Firebase → localStorage fallback.
 * @module systems/PersonalScores
 */

import { Debug } from '../engine/Debug.js';

/**
 * Manages personal high scores per level.
 *
 * Persists to Firebase Realtime DB under `games/<gameKey>/personalScores/<uid>/`
 * with a localStorage fallback keyed to `<gameKey>_personalScores`.
 *
 * @example
 * PersonalScores.configure('maze-teasers', firebaseService);
 * await PersonalScores.init();
 */
export class PersonalScores {
    /** @private */ static _gameKey  = 'game';
    /** @private */ static _fbRoot   = null;
    /** @private */ static _fb       = null;
    /** @private */ static _migrationChecked = false;

    /**
     * Configure the service before first use.
     * Must be called before init() / any read or write.
     *
     * @param {string} gameKey         Short identifier for the game (e.g. 'maze-teasers').
     *                                 Used as a Firebase path prefix and localStorage key prefix.
     * @param {object} firebaseService FirebaseService singleton.
     * @param {string} [fbRoot]        Optional flat Firebase root path (e.g. 'mazeteasers-personalscores').
     *                                 If omitted, defaults to games/{gameKey}/personalScores.
     */
    static configure(gameKey, firebaseService, fbRoot = null) {
        this._gameKey = gameKey;
        this._fb      = firebaseService;
        this._fbRoot  = fbRoot;
    }

    /** @private */
    static _lsKey()         { return `${this._gameKey}_personalScores`; }
    /** @private */
    static _fbPath(uid)     { return this._fbRoot ? `${this._fbRoot}/${uid}` : `games/${this._gameKey}/personalScores/${uid}`; }
    /** @private */
    static _migKey(uid)     { return `${this._gameKey}_migrated_${uid}`; }

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    /**
     * Ensure Firebase is connected and run auto-migration if needed.
     */
    static async init() {
        if (!this._fb) throw new Error('PersonalScores: call configure() before init()');
        await this._fb.init();

        if (!this._migrationChecked && this._fb.isReady() && this._fb.getUser() && !this._fb.getUser().isAnonymous) {
            this._migrationChecked = true;
            this._checkAndMigrateLocalData();
        }
    }

    /** @private */
    static async _checkAndMigrateLocalData() {
        const user = this._fb.getUser();
        if (!user) return;

        const migKey = this._migKey(user.uid);
        if (localStorage.getItem(migKey)) return;

        try {
            const localRaw = localStorage.getItem(this._lsKey());
            if (!localRaw) { localStorage.setItem(migKey, 'true'); return; }
            const local = JSON.parse(localRaw);
            if (!Array.isArray(local) || local.length === 0) { localStorage.setItem(migKey, 'true'); return; }

            const { ref, get } = this._fb.getFunctions();
            const snap = await get(ref(this._fb.getDatabase(), this._fbPath(user.uid)));
            if (snap.exists()) { localStorage.setItem(migKey, 'true'); return; }

            const result = await this.migrateFromLocalStorage();
            if (result.success) {
                Debug.log('PersonalScores', `Auto-migration complete: ${result.migrated} scores`);
                localStorage.setItem(migKey, 'true');
            }
        } catch (error) {
            Debug.error('PersonalScores', 'Auto-migration error:', error);
        }
    }

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    /**
     * Get all personal scores for this game.
     * @returns {Promise<Array>}
     */
    static async getAll() {
        await this.init();
        const db  = this._fb.getDatabase();
        const uid = this._fb.getPlayerId();

        if (this._fb.isReady() && db && uid) {
            try {
                const { ref, get } = this._fb.getFunctions();
                const snap = await get(ref(db, this._fbPath(uid)));
                if (!snap.exists()) return [];
                const scores = [];
                snap.forEach(child => {
                    const d = child.val();
                    scores.push({ level: d.level, score: d.score, date: d.date, difficulty: d.difficulty, timeElapsed: d.timeElapsed ?? null, errors: d.errors ?? null });
                });
                return scores;
            } catch (error) {
                Debug.error('PersonalScores', 'Firebase read failed, using localStorage:', error);
                return this._getFromLocalStorage();
            }
        }
        return this._getFromLocalStorage();
    }

    /**
     * Get personal high score for a specific level.
     * @param {number} level  Level index to look up.
     * @returns {Promise<number|null>}
     */
    static async getForLevel(level) {
        const scores = await this.getAll();
        const entry  = scores.find(s => s.level === level);
        return entry ? entry.score : null;
    }

    /** Get all scores sorted ascending by level. */
    static async getAllSorted() {
        return (await this.getAll()).sort((a, b) => a.level - b.level);
    }

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /**
     * Save a score for a level (only overwrites if new score >= existing).
     * @param {number} level  Level index to save the score for.
     * @param {number} score  Score to save (only persisted if >= existing high score).
     * @param {string} [difficulty='medium']
     * @param {number} [timeElapsed=0]
     * @param {number} [errors=0]
     * @returns {Promise<boolean>} true if new high score
     */
    static async saveScore(level, score, difficulty = 'medium', timeElapsed = 0, errors = 0) {
        await this.init();
        const db  = this._fb.getDatabase();
        const uid = this._fb.getPlayerId();

        console.log('[PersonalScores] saveScore | level:', level, 'score:', score, 'fbReady:', this._fb.isReady(), 'uid:', uid, 'path:', this._fbPath(uid));

        if (this._fb.isReady() && db && uid) {
            try {
                const { ref, get, set } = this._fb.getFunctions();
                const levelRef = ref(db, `${this._fbPath(uid)}/level_${level}`);
                const snap = await get(levelRef);
                let isNew = true;

                if (snap.exists()) {
                    isNew = score >= (snap.val().score || 0);
                }

                if (isNew) {
                    await set(levelRef, { level, score, difficulty, timeElapsed, errors, date: new Date().toISOString() });
                    this._saveToLocalStorage(level, score, difficulty, timeElapsed, errors);
                    console.log('[PersonalScores] saved to Firebase OK');
                    return true;
                }
                console.log('[PersonalScores] not a new high score, skipped');
                return false;
            } catch (error) {
                console.error('[PersonalScores] Firebase save failed:', error);
                return this._saveToLocalStorage(level, score, difficulty, timeElapsed, errors);
            }
        }
        console.warn('[PersonalScores] Firebase not ready — saving to localStorage only');
        return this._saveToLocalStorage(level, score, difficulty, timeElapsed, errors);
    }

    // -------------------------------------------------------------------------
    // Clear
    // -------------------------------------------------------------------------

    /** Clear all personal scores (Firebase + localStorage). */
    static async clear() {
        await this.init();
        const db  = this._fb.getDatabase();
        const uid = this._fb.getPlayerId();

        if (this._fb.isReady() && db && uid) {
            try {
                const { ref, set } = this._fb.getFunctions();
                await set(ref(db, this._fbPath(uid)), null);
            } catch (error) {
                Debug.error('PersonalScores', 'Firebase clear failed:', error);
            }
        }
        localStorage.removeItem(this._lsKey());
    }

    // -------------------------------------------------------------------------
    // Migration
    // -------------------------------------------------------------------------

    /**
     * Migrate localStorage scores to Firebase under the current user account.
     * @returns {Promise.<{success: boolean, migrated: number, error: string}>}
     */
    static async migrateFromLocalStorage() {
        await this.init();
        if (!this._fb.isReady()) return { success: false, error: 'Not signed in' };

        try {
            const local = this._getFromLocalStorage();
            if (local.length === 0) return { success: false, error: 'No localStorage scores' };

            const db  = this._fb.getDatabase();
            const uid = this._fb.getPlayerId();
            const { ref, set } = this._fb.getFunctions();
            let n = 0;
            for (const s of local) {
                await set(ref(db, `${this._fbPath(uid)}/level_${s.level}`), {
                    level: s.level, score: s.score,
                    difficulty: s.difficulty || 'medium',
                    kills: s.kills || {}, shots: s.shots || {},
                    date: s.date || new Date().toISOString(),
                });
                n++;
            }
            return { success: true, migrated: n };
        } catch (error) {
            Debug.error('PersonalScores', 'Migration failed:', error);
            return { success: false, error: error.message };
        }
    }

    // -------------------------------------------------------------------------
    // LocalStorage helpers
    // -------------------------------------------------------------------------

    /** @private */
    static _getFromLocalStorage() {
        try {
            const raw = localStorage.getItem(this._lsKey());
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    /** @private */
    static _saveToLocalStorage(level, score, difficulty = 'medium', timeElapsed = 0, errors = 0) {
        const scores = this._getFromLocalStorage();
        const idx    = scores.findIndex(s => s.level === level);
        if (idx >= 0) {
            if (score < scores[idx].score) return false;
            scores[idx] = { ...scores[idx], score, difficulty, timeElapsed, errors, date: new Date().toISOString() };
        } else {
            scores.push({ level, score, difficulty, timeElapsed, errors, date: new Date().toISOString() });
        }
        try {
            localStorage.setItem(this._lsKey(), JSON.stringify(scores));
        } catch { /* storage full */ }
        return true;
    }
}
