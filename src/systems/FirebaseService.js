/**
 * Unified Firebase initialization and authentication service shared by
 * {@link PersonalScores}, {@link BaseSettingsManager}, and {@link LeaderboardService}.
 * @module systems/FirebaseService
 */

import { Debug } from '../engine/Debug.js';

/**
 * Unified Firebase initialisation and authentication service.
 *
 * Shared by {@link PersonalScores}, {@link BaseSettingsManager}, and
 * {@link LeaderboardService}.  Handles app initialisation, anonymous
 * sign-in, and auth-state tracking.  Exposes the Firebase `Database`,
 * `Functions`, and `Auth` instances through typed getters.
 *
 * Call `firebaseService.init(firebaseConfig)` once at boot; subsequent calls
 * return the cached promise.
 *
 * @example
 * await firebaseService.init({
 *   apiKey:            '...',
 *   authDomain:        '...',
 *   databaseURL:       '...',
 *   projectId:         '...',
 *   storageBucket:     '...',
 *   messagingSenderId: '...',
 *   appId:             '...',
 * });
 */
class FirebaseService {
    /** @private — use the exported singleton, not `new FirebaseService()`. */
    constructor() {
        /** @private */ this.firebaseDB = null;
        /** @private */ this.firebaseFunctions = null;
        /** @private */ this.auth = null;
        /** @private */ this.user = null;
        /** @private */ this.playerId = null;
        /** @private */ this.initialized = false;
        /** @private */ this.initPromise = null;
        /** @private */ this._pendingConfig = null;
    }

    /**
     * Initialize Firebase and authenticate anonymously.
     * Safe to call multiple times — returns cached result after first init.
     *
     * @param {object} [firebaseConfig] Firebase config object (required on first call).
     * @returns {Promise<boolean>}
     */
    async init(firebaseConfig) {
        if (this.initialized) return true;
        if (this.initPromise) return this.initPromise;

        if (firebaseConfig) this._pendingConfig = firebaseConfig;

        this.initPromise = this._doInit();
        return this.initPromise;
    }

    /** @private */
    async _doInit() {
        try {
            const { initializeApp, getApps } = await import('firebase/app');
            const { getDatabase, ref, set, get, query, orderByChild, limitToLast, push, equalTo, update } =
                await import('firebase/database');
            const { getAuth, signInAnonymously, onAuthStateChanged } = await import('firebase/auth');

            this._isNative = !!(window.Capacitor?.isNativePlatform?.());

            let app;
            const apps = getApps();
            if (apps.length > 0) {
                app = apps[0];
                Debug.log('FirebaseService', 'Using existing Firebase app');
            } else {
                if (!this._pendingConfig) {
                    throw new Error('FirebaseService.init() requires a firebaseConfig on the first call.');
                }
                app = initializeApp(this._pendingConfig);
                Debug.log('FirebaseService', 'Firebase app initialized');
            }

            this.firebaseDB = getDatabase(app);
            this.firebaseFunctions = { ref, set, get, query, orderByChild, limitToLast, push, equalTo, update };
            this.auth = getAuth(app);

            // Fallback player ID from localStorage
            this.playerId = localStorage.getItem('playerId');
            if (!this.playerId) {
                this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('playerId', this.playerId);
                Debug.log('FirebaseService', `Created fallback player ID: ${this.playerId}`);
            }

            // Restore existing auth session (may live in IndexedDB)
            // On Android with @capacitor-firebase/authentication, the native plugin fires
            // its initial authStateChange before the JS/WebView loads, so the JS
            // onAuthStateChanged callback may never receive the initial state.
            // Guard with a 6-second timeout so init() never hangs indefinitely.
            await new Promise((resolve) => {
                let resolved = false;

                const finish = (label) => {
                    if (resolved) return;
                    resolved = true;
                    unsubscribe();
                    resolve();
                    Debug.log('FirebaseService', label);
                };

                // Timeout: give onAuthStateChanged 6 s to fire, then proceed without session.
                const timeoutId = setTimeout(() => {
                    Debug.warn('FirebaseService', 'onAuthStateChanged timed out — proceeding without auth session (Android native bridge may have fired before JS loaded)');
                    finish('Auth session restore timed out');
                }, 6000);

                const unsubscribe = onAuthStateChanged(this.auth, async (user) => {
                    clearTimeout(timeoutId);
                    if (resolved) return;
                    if (user) {
                        this.user = user;
                        const method = user.isAnonymous ? 'anonymous' : (user.providerData[0]?.providerId || 'unknown');
                        finish(`Restored auth session: ${user.uid} (${method})`);
                    } else {
                        Debug.log('FirebaseService', 'First auth check returned null, waiting for IndexedDB…');
                        await new Promise(r => setTimeout(r, 300));
                        if (this.auth.currentUser) {
                            this.user = this.auth.currentUser;
                            const method = this.user.isAnonymous ? 'anonymous' : (this.user.providerData[0]?.providerId || 'unknown');
                            finish(`Restored auth session after delay: ${this.user.uid} (${method})`);
                        } else {
                            finish('No existing auth session — user must sign in');
                        }
                    }
                });
            });

            // Permanent auth-state listener
            onAuthStateChanged(this.auth, (user) => {
                if (user && user.uid !== this.user?.uid) {
                    this.user = user;
                    Debug.log('FirebaseService', `Auth state changed: ${user.uid}`);
                } else if (!user && this.user) {
                    Debug.warn('FirebaseService', 'Auth state changed: signed out');
                    this.user = null;
                }
            });

            this.initialized = true;
            Debug.log('FirebaseService', 'Firebase initialization complete');
            return true;
        } catch (error) {
            Debug.error('FirebaseService', 'Initialization failed:', error);
            this.initialized = false;
            this.initPromise = null;  // allow retry with a real config
            return false;
        }
    }

    /** @returns {boolean} True once Firebase is ready and a user session exists. */
    isReady()       { return this.initialized && this.user !== null; }
    /** @returns {object} The Firebase Realtime Database instance. */
    getDatabase()   { return this.firebaseDB; }
    /** @returns {object} Map of Firebase database helper functions. */
    getFunctions()  { return this.firebaseFunctions; }
    /** @returns {object} The Firebase Auth instance. */
    getAuth()       { return this.auth; }
    /** @returns {object|null} The currently authenticated Firebase user. */
    getUser()       { return this.user; }
    /** @returns {string|null} The current player's UID (Firebase uid if signed in, else playerId). */
    getPlayerId()   { return this.user ? this.user.uid : this.playerId; }

    getAuthProvider() {
        if (!this.user) return 'none';
        if (this.user.isAnonymous) return 'anonymous';
        const p = this.user.providerData[0]?.providerId;
        if (p === 'google.com') return 'google';
        if (p === 'password')   return 'email';
        return 'unknown';
    }

    // =========================================================================
    // Authentication
    // =========================================================================

    async signInWithGoogle() {
        try {
            if (this._isNative) {
                const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
                const nativeResult = await FirebaseAuthentication.signInWithGoogle();
                if (!nativeResult?.credential?.idToken)
                    return { success: false, error: 'No ID token from native sign-in' };
                const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
                const credential = GoogleAuthProvider.credential(nativeResult.credential.idToken);
                const uc = await signInWithCredential(this.auth, credential);
                this.user = uc.user;
                return { success: true, user: this.user };
            } else {
                const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
                const provider = new GoogleAuthProvider();
                const uc = await signInWithPopup(this.auth, provider);
                this.user = uc.user;
                return { success: true, user: this.user };
            }
        } catch (error) {
            Debug.error('FirebaseService', 'Google sign-in failed:', error);
            return { success: false, error: error.message };
        }
    }

    async signInAnonymously() {
        try {
            const { signInAnonymously } = await import('firebase/auth');
            const uc = await signInAnonymously(this.auth);
            this.user = uc.user;
            Debug.log('FirebaseService', `Anonymous sign-in: ${this.user.uid}`);
            return { success: true, user: this.user };
        } catch (error) {
            Debug.error('FirebaseService', 'Anonymous sign-in failed:', error);
            return { success: false, error: error.message };
        }
    }

    async linkAnonymousToGoogle() {
        if (!this.user?.isAnonymous) return { success: false, error: 'Not signed in anonymously' };
        try {
            if (this._isNative) {
                const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
                const nativeResult = await FirebaseAuthentication.signInWithGoogle();
                if (!nativeResult?.credential?.idToken)
                    return { success: false, error: 'No ID token' };
                const { GoogleAuthProvider, linkWithCredential } = await import('firebase/auth');
                const credential = GoogleAuthProvider.credential(nativeResult.credential.idToken);
                const uc = await linkWithCredential(this.user, credential);
                this.user = uc.user;
                return { success: true, user: this.user };
            } else {
                const { GoogleAuthProvider, linkWithPopup } = await import('firebase/auth');
                const provider = new GoogleAuthProvider();
                const uc = await linkWithPopup(this.user, provider);
                this.user = uc.user;
                return { success: true, user: this.user };
            }
        } catch (error) {
            Debug.error('FirebaseService', 'Link-to-Google failed:', error);
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        try {
            const { signOut } = await import('firebase/auth');
            await signOut(this.auth);
            this.user = null;
            Debug.log('FirebaseService', 'User signed out');
            return { success: true };
        } catch (error) {
            Debug.error('FirebaseService', 'Sign-out failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Migrate Firebase data from an old anonymous player ID to the current signed-in UID.
     * @param {string} oldPlayerId  Firebase UID of the anonymous player to migrate from.
     * @returns {Promise.<{success: boolean, migrated: number, error: string}>}
     */
    async migratePlayerData(oldPlayerId) {
        if (!this.user) return { success: false, error: 'Not signed in' };
        const newId = this.getPlayerId();
        if (oldPlayerId === newId) return { success: false, error: 'IDs are identical' };

        try {
            const { ref, get, set } = this.firebaseFunctions;
            let count = 0;

            const oldScores = await get(ref(this.firebaseDB, `personalScores/${oldPlayerId}`));
            if (oldScores.exists()) {
                await set(ref(this.firebaseDB, `personalScores/${newId}`), oldScores.val());
                count += Object.keys(oldScores.val()).length;
            }

            const oldSettings = await get(ref(this.firebaseDB, `settings/${oldPlayerId}`));
            if (oldSettings.exists()) {
                await set(ref(this.firebaseDB, `settings/${newId}`), oldSettings.val());
            }

            return { success: true, migrated: count };
        } catch (error) {
            Debug.error('FirebaseService', 'Migration failed:', error);
            return { success: false, error: error.message };
        }
    }
}

export const firebaseService = new FirebaseService();
