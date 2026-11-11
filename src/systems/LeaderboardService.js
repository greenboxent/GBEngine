/**
 * Leaderboard submission and retrieval backed by Firebase Realtime Database,
 * with a mock-data fallback for testing.
 * @module systems/LeaderboardService
 */

import { Capacitor } from '@capacitor/core';
import { Debug }     from '../engine/Debug.js';

/**
 * Leaderboard submission and retrieval backed by Firebase Realtime Database,
 * with a mock-data fallback for testing.
 *
 * @example
 * const leaderboard = new LeaderboardService({
 *   firebaseService,
 *   collectionPath: 'leaderboards/maze-battle',
 *   backendMode: 'firebase',
 * });
 * await leaderboard.init();
 */
export class LeaderboardService {
    /**
     * Creates a new LeaderboardService.
     *
     * @param {object} options
     * @param {object}  options.firebaseService  FirebaseService singleton instance.
     * @param {string}  [options.collectionPath] Firebase Realtime DB path for scores.
     *                                           E.g. `'leaderboards/maze-teasers'`
     * @param {string}  [options.backendMode]    `'firebase'` | `'mock'`. Defaults to `'firebase'`.
     */
    constructor(options = {}) {
        this._fb             = options.firebaseService;
        this.collectionPath  = options.collectionPath  ?? 'leaderboard';
        this.backendMode     = options.backendMode     ?? 'firebase';
        this.platform        = Capacitor.getPlatform();

        /** Fallback mock data */
        this.mockLeaderboard = [
            { rank: 1,  playerName: 'ProGamer',    score: 125000, level: 15, difficulty: 'hard'   },
            { rank: 2,  playerName: 'Runner',      score:  98500, level: 12, difficulty: 'hard'   },
            { rank: 3,  playerName: 'BattleMaster',score:  87300, level: 18, difficulty: 'medium' },
            { rank: 4,  playerName: 'PixelWarrior', score:  76200, level: 10, difficulty: 'hard'   },
            { rank: 5,  playerName: 'GameChamp',   score:  65100, level: 14, difficulty: 'medium' },
            { rank: 6,  playerName: 'TopShooter',  score:  54800, level:  9, difficulty: 'medium' },
            { rank: 7,  playerName: 'Elite',       score:  43600, level:  8, difficulty: 'medium' },
            { rank: 8,  playerName: 'HighScorer',  score:  32400, level:  6, difficulty: 'easy'   },
            { rank: 9,  playerName: 'Explorer',    score:  21200, level:  5, difficulty: 'easy'   },
            { rank: 10, playerName: 'Beginner',    score:  10500, level:  3, difficulty: 'easy'   },
        ];
    }

    /**
     * Initialize the service (connects to Firebase if mode is 'firebase').
     * @returns {Promise<void>}
     */
    async init() {
        Debug.log('LeaderboardService', `Init — backend: ${this.backendMode}, path: ${this.collectionPath}`);
        if (this.backendMode === 'firebase') {
            await this._initFirebase();
        }
    }

    /** @private */
    async _initFirebase() {
        try {
            const ok = await this._fb.init();
            if (!ok) throw new Error('FirebaseService.init() returned false');
            Debug.log('LeaderboardService', 'Firebase ready');
        } catch (error) {
            Debug.error('LeaderboardService', 'Firebase init failed, falling back to mock:', error);
            this.backendMode = 'mock';
        }
    }

    // -------------------------------------------------------------------------
    // Submit
    // -------------------------------------------------------------------------

    /**
     * Submit a score.  Player name is read from localStorage key 'playerName'
     * (Google players get one claimed at sign-in — see `ensureGooglePlayerName`).
     * Returns false (silently) when no name is set.
     *
     * @param {number} score  Score value to submit.
     * @param {number} [level=1]
     * @param {string} [difficulty='medium']
     * @param {number} [timeElapsed=0]  seconds
     * @param {number} [errors=0]       wrong-path excursions
     * @returns {Promise<boolean>}
     */
    async submitScore(score, level = 1, difficulty = 'medium', timeElapsed = 0, errors = 0, extra = {}) {
        // No fallback to the Google profile name: it is not unique, so it must
        // go through the claim at sign-in before it can appear on a leaderboard.
        const playerName = localStorage.getItem('playerName') || '';
        if (!playerName || playerName.toLowerCase() === 'anonymous') {
            Debug.log('LeaderboardService', 'Score not submitted: no player name set');
            return false;
        }

        if (this.backendMode === 'firebase') {
            return this._submitFirebase(score, level, difficulty, playerName, timeElapsed, errors, extra);
        }
        return this._submitMock(score, level, difficulty, playerName);
    }

    /**
     * Submits a score entry to Firebase Realtime Database.
     * @private
     * @param {number} score       Score value.
     * @param {number} level       Level the score was achieved on.
     * @param {string} difficulty  Difficulty setting ('easy' | 'medium' | 'hard').
     * @param {string} playerName  Display name of the player.
     * @param {number} timeElapsed Elapsed time in seconds.
     * @param {number} errors      Wrong-path excursion count.
     * @param {object} [extra] Additional fields merged into the entry.
     * @returns {Promise<boolean>}
     */
    async _submitFirebase(score, level, difficulty, playerName, timeElapsed = 0, errors = 0, extra = {}) {
        if (!this._fb.isReady()) { Debug.error('LeaderboardService', 'Firebase not ready'); return false; }
        try {
            const { ref, push, set } = this._fb.getFunctions();
            const db = this._fb.getDatabase();
            const scoreRef = push(ref(db, this.collectionPath));
            await set(scoreRef, {
                playerId:   this._fb.getPlayerId(),
                playerName,
                score, level, difficulty,
                timeElapsed, errors,
                ...extra,
                timestamp: Date.now(),
            });
            Debug.log('LeaderboardService', `Firebase score submitted: ${score}`);
            return true;
        } catch (error) {
            Debug.error('LeaderboardService', 'Submit failed:', error);
            return false;
        }
    }

    /**
     * Posts local best scores the board doesn't hold yet. Scores are normally
     * submitted when a level is completed, which needs a signed-in player with
     * a name — so scores earned as a guest (or before a name was set) never
     * reach the board. Call this after a name is set / a sign-in / when the
     * leaderboard opens: for each entry it submits one score unless this
     * account already has one at least as high for the same key.
     *
     * Idempotent (safe to repeat) and runs at most once per account per app
     * session. Does nothing without a player name, a non-anonymous signed-in
     * account, or the `firebase` backend. Never throws.
     *
     * @param {Array<{score:number, level?:number, difficulty?:string}>} entries
     *        Local bests, e.g. one per level and difficulty.
     * @param {object} [options]
     * @param {object} [options.extra]  Fields merged into every submitted entry (e.g. `{ difficultyScaled: true }`).
     * @param {function(object): string} [options.keyOf]
     *        Identity of an entry (default `` `${difficulty}:${level}` ``); must work on both local entries and stored ones.
     * @param {function(object): number} [options.existingScore]
     *        Score of a stored board entry (default `e.score`) — use to normalise legacy entries.
     * @returns {Promise<number>} How many scores were submitted.
     */
    async publishMissingScores(entries, { extra = {}, keyOf, existingScore } = {}) {
        const playerName = (localStorage.getItem('playerName') || '').trim();
        const uid = this._fb.getUser?.()?.uid;
        if (this.backendMode !== 'firebase' || !playerName || !uid || !this._fb.isReady()
            || this._fb.getUser().isAnonymous || this._publishedUid === uid) return 0;
        this._publishedUid = uid;

        const key = keyOf ?? (e => `${e.difficulty ?? 'medium'}:${e.level ?? 1}`);
        const scoreOf = existingScore ?? (e => e.score);
        try {
            const { ref, get, query, orderByChild, equalTo } = this._fb.getFunctions();
            const coll = ref(this._fb.getDatabase(), this.collectionPath);
            const have = new Map(); // key -> best score this account already has on the board
            const snap = await get(query(coll, orderByChild('playerId'), equalTo(uid)));
            snap.forEach(child => {
                const e = child.val();
                have.set(key(e), Math.max(have.get(key(e)) ?? 0, scoreOf(e)));
            });

            let posted = 0;
            for (const e of entries) {
                if ((have.get(key(e)) ?? 0) >= e.score) continue;
                const ok = await this._submitFirebase(e.score, e.level ?? 1, e.difficulty ?? 'medium', playerName, 0, 0, extra);
                if (!ok) throw new Error('submit failed');
                posted++;
            }
            return posted;
        } catch (error) {
            Debug.warn('LeaderboardService', 'publishMissingScores failed:', error?.message);
            this._publishedUid = null; // retry next time
            return 0;
        }
    }

    /**
     * Inserts or replaces a score in the in-memory mock leaderboard.
     * @private
     * @returns {Promise<boolean>}
     */
    async _submitMock(score, level, difficulty, playerName) {
        const entry = { rank: 0, playerName: playerName || 'You', score, level, difficulty };
        const idx = this.mockLeaderboard.findIndex(e => score > e.score);
        if (idx !== -1) {
            this.mockLeaderboard = this.mockLeaderboard.filter(e => e.playerName !== 'You');
            this.mockLeaderboard.splice(idx, 0, entry);
            this.mockLeaderboard = this.mockLeaderboard.slice(0, 10);
        } else if (this.mockLeaderboard.length < 10) {
            this.mockLeaderboard.push(entry);
        }
        this.mockLeaderboard.forEach((e, i) => { e.rank = i + 1; });
        return true;
    }

    // -------------------------------------------------------------------------
    // Retrieve
    // -------------------------------------------------------------------------

    /**
     * Get top scores.
     * @param {number} [limit=10]
     * @returns {Promise<Array>}
     */
    async getTopScores(limit = 10) {
        if (this.backendMode === 'firebase') return this._getTopFirebase(limit);
        return this.mockLeaderboard.slice(0, limit);
    }

    /**
     * Fetches the top `limit` scores from Firebase, ordered by score descending.
     * Falls back to an unordered fetch if the index is not yet deployed.
     * @private
     * @param {number} [limit=10]
     * @returns {Promise<Array>}
     */
    async _getTopFirebase(limit = 10) {
        // Does not need a signed-in user: guests (no account) can read a leaderboard
        // whose rules allow public reads (see templates/game/database.rules.json).
        if (!this._fb.initialized || !this._fb.getDatabase()) { Debug.error('LeaderboardService', 'Firebase not ready'); return []; }
        try {
            const { ref, get, query, orderByChild, limitToLast } = this._fb.getFunctions();
            const db = this._fb.getDatabase();
            const scoresRef = ref(db, this.collectionPath);
            let snapshot;
            try {
                snapshot = await get(query(scoresRef, orderByChild('score'), limitToLast(limit)));
            } catch {
                snapshot = await get(scoresRef); // fallback: fetch all and sort locally
            }
            if (!snapshot.exists()) return [];

            const currentId = this._fb.getPlayerId();
            const scores = [];
            snapshot.forEach(child => {
                const d = child.val();
                scores.push({
                    playerName:      d.playerName,
                    score:           d.score,
                    level:           d.level        || 1,
                    difficulty:      d.difficulty   || 'medium',
                    mazeType:        d.mazeType     || 'rectangular',
                    timeElapsed:     d.timeElapsed  ?? null,
                    errors:          d.errors       ?? null,
                    timestamp:       d.timestamp,
                    isCurrentPlayer: d.playerId === currentId,
                });
            });
            scores.sort((a, b) => b.score - a.score);
            return scores.slice(0, limit).map((e, i) => ({ rank: i + 1, ...e }));
        } catch (error) {
            Debug.error('LeaderboardService', 'getTopScores failed:', error);
            return [];
        }
    }
}
