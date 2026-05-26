/**
 * @module systems/AdService
 */

import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { Settings } from './SettingsManager.js';
import { SoundManager } from './SoundManager.js';

// ---------------------------------------------------------------------------
// Ad Unit IDs
// Replace with production IDs from the AdMob console before release.
// ---------------------------------------------------------------------------
const AD_UNITS = {
    // Google's official test interstitial — safe during development
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    // Google's official test rewarded video — safe during development
    rewarded:     'ca-app-pub-3940256099942544/5224354917',
    // ── Production IDs (fill in before release) ──────────────────────────
    // interstitial: 'ca-app-pub-4949919190549446/5448525574',
    // rewarded:     'ca-app-pub-4949919190549446/2567211360',
};

// ---------------------------------------------------------------------------
// AdService singleton
// ---------------------------------------------------------------------------

/**
 * Singleton service wrapping `@capacitor-community/admob` v8.
 *
 * Provides interstitial and rewarded video ads with automatic pre-loading.
 * Uses Google test IDs by default — call `configure()` before `initialize()`
 * to set production unit IDs.
 *
 * Ad Unit IDs: test IDs (Google's official test unit IDs) are used by default.
 * Replace `AD_UNITS` at the top of this file with your production IDs from the
 * AdMob console before releasing, and set `isTesting: false` in
 * `capacitor.config.json`.
 *
 * Silently no-ops on web (non-native) platforms so you can run in the browser
 * during development without any configuration.
 *
 * @example
 * // Once at app startup (e.g. BootScene.create):
 * await AdService.initialize();
 *
 * // Show interstitial (fire-and-forget, safe on non-Android):
 * await AdService.showInterstitial();
 *
 * // Show rewarded ad and wait for the result:
 * const rewarded = await AdService.showRewarded();
 * if (rewarded) { // grant reward }
 *
 * // Check if a rewarded ad is loaded before showing the "Watch Ad" button:
 * if (AdService.rewardedReady) { // show button }
 */
class AdServiceClass {

    /**
     * Do not instantiate directly — use the exported `AdService` singleton.
     */
    constructor() {
        this._initialized       = false;
        this._interstitialReady = false;
        this._rewardedReady     = false;
        /** Only show interstitials at or above this level */
        this._minLevel          = 9;
        /** Tag ads as child-directed (COPPA). Set via configure(). */
        this._childDirected     = false;
    }

    // -------------------------------------------------------------------------
    // Configure (call before initialize)
    // -------------------------------------------------------------------------

    /**
     * Override the default (test) ad unit IDs with production IDs.
     * Call this before AdService.initialize() in your BootScene.
     *
     * @param {object} ids  Ad unit IDs and configuration flags.
     * @param {string} [ids.interstitial] - Interstitial ad unit ID.
     * @param {string} [ids.rewarded] - Rewarded ad unit ID.
     * @param {boolean} [ids.childDirected] - Tag ads as child-directed (COPPA).
     */
    configure(ids = {}) {
        if (ids.interstitial)              AD_UNITS.interstitial = ids.interstitial;
        if (ids.rewarded)                  AD_UNITS.rewarded     = ids.rewarded;
        if (ids.childDirected !== undefined) this._childDirected = ids.childDirected;
    }

    // -------------------------------------------------------------------------
    // Initialize
    // -------------------------------------------------------------------------

    /**
     * Initialize the AdMob SDK and preload both ad types.
     * Call once during BootScene (or before any ad is needed).
     * Safe to call on non-Android — will silently no-op.
     *
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) return;
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('AdMob init timeout')), 5000));
            await Promise.race([AdMob.initialize(), timeout]);
            this._initialized = true;
            console.log('[AdService] initialized');
            // Kick off pre-loading in parallel — don't await so boot isn't delayed
            this._preloadInterstitial();
            this._preloadRewarded();
        } catch (e) {
            // Silently swallowed on browser / non-Android
            console.warn('[AdService] initialize failed (not Android?):', e?.message ?? e);
        }
    }

    // -------------------------------------------------------------------------
    // Interstitial
    // -------------------------------------------------------------------------

    /**
     * Pre-loads an interstitial ad into the AdMob cache.
     * Called automatically after initialization and after each show.
     * @private
     * @returns {Promise<void>}
     */
    async _preloadInterstitial() {
        if (!this._initialized) return;
        try {
            await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial, tagForChildDirectedTreatment: this._childDirected });
            this._interstitialReady = true;
            console.log('[AdService] interstitial ready');
        } catch (e) {
            console.warn('[AdService] prepareInterstitial failed:', e?.message ?? e);
            this._interstitialReady = false;
        }
    }

    /**
     * Show an interstitial ad then preload the next one.
     * Only shows when level >= MIN_LEVEL (default 9). Pass level=0 to bypass
     * the level check entirely.
     * Silent no-op when not on Android or no ad is loaded.
     *
     * @param {number} [level=0] - Current game level; use 0 to skip level check
     * @returns {Promise<void>}
     */
    async showInterstitial(level = 0) {
        if (Settings.adsRemoved) return;
        if (level > 0 && level < this._minLevel) return;
        if (!this._initialized || !this._interstitialReady) return;
        this._interstitialReady = false;
        const sm = SoundManager.getInstance();
        if (sm) sm.pauseMusic();
        try {
            // 10s timeout guards against AdMob hanging after lifecycle events
            // (e.g. billing sheet returning) which would freeze level transitions.
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('showInterstitial timeout')), 10000));
            await Promise.race([AdMob.showInterstitial(), timeout]);
        } catch (e) {
            console.warn('[AdService] showInterstitial failed:', e?.message ?? e);
        } finally {
            if (sm) sm.resumeMusic();
            this._preloadInterstitial();
        }
    }

    // -------------------------------------------------------------------------
    // Rewarded
    // -------------------------------------------------------------------------

    /**
     * Pre-loads a rewarded video ad into the AdMob cache.
     * Called automatically after initialization and after each show.
     * @private
     * @returns {Promise<void>}
     */
    async _preloadRewarded() {
        if (!this._initialized) return;
        try {
            await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, tagForChildDirectedTreatment: this._childDirected });
            this._rewardedReady = true;
            console.log('[AdService] rewarded ad ready');
        } catch (e) {
            console.warn('[AdService] prepareRewardVideoAd failed:', e?.message ?? e);
            this._rewardedReady = false;
        }
    }

    /**
     * Show a rewarded ad and resolve with whether the user earned the reward.
     * Returns false immediately if no ad is loaded or not on Android.
     *
     * @returns {Promise<boolean>} true if the user watched to completion and earned reward
     */
    async showRewarded() {
        if (!this._initialized || !this._rewardedReady) return false;
        this._rewardedReady = false;
        const sm = SoundManager.getInstance();
        if (sm) sm.pauseMusic();
        try {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('showRewarded timeout')), 35000));
            const reward = await Promise.race([AdMob.showRewardVideoAd(), timeout]);
            // resolves with AdMobRewardItem { type, amount } when reward is earned
            return reward != null;
        } catch (e) {
            // Throws when the user dismisses early or ad fails to show
            console.warn('[AdService] showRewardVideoAd failed or dismissed:', e?.message ?? e);
            return false;
        } finally {
            if (sm) sm.resumeMusic();
            this._preloadRewarded();
        }
    }

    /**
     * Re-trigger preloading of both ad types.
     * Call after any lifecycle event that may invalidate preloaded ads
     * (e.g. after an IAP billing sheet closes).
     */
    preloadAds() {
        this._preloadInterstitial();
        this._preloadRewarded();
    }

    /**
     * Whether a rewarded ad is loaded and ready to show.
     * Use this to conditionally display a "Watch Ad" button.
     *
     * @returns {boolean}
     */
    get rewardedReady() {
        return this._initialized && this._rewardedReady;
    }

    /**
     * Whether AdMob initialised successfully (i.e. running on a native platform).
     * Returns false on web/browser where the plugin is a no-op.
     *
     * @returns {boolean}
     */
    get isNative() {
        return Capacitor.isNativePlatform();
    }
}

export const AdService = new AdServiceClass();
