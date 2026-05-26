/**
 * "Remove Interstitial Ads" non-consumable in-app purchase via `@capgo/native-purchases`.
 * Uses Google Play inventory as source of truth; call `restorePurchases()` on boot
 * and app resume to catch refunds promptly.
 * @module systems/IAPService
 */
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';
import { Settings } from './SettingsManager.js';

const PRODUCT_ID = 'remove_interstitial_ads';

/**
 * Singleton service managing the "Remove Interstitial Ads" non-consumable
 * in-app purchase via `@capgo/native-purchases`.
 *
 * Uses the Google Play inventory as the source of truth: `restorePurchases()`
 * must be called on boot and on every app resume so that refunds are caught
 * and the benefit is revoked promptly.
 *
 * Silent no-op on web (non-native) platforms.
 */
class IAPServiceClass {

    /** @private — use the exported `IAPService` singleton. */
    constructor() {
        this._initialized = false;
    }

    // -------------------------------------------------------------------------
    // Platform check
    // -------------------------------------------------------------------------

    /**
     * Returns `true` when running on a native (Android/iOS) platform.
     * @type {boolean}
     */
    get isAvailable() {
        return Capacitor.isNativePlatform();
    }

    // -------------------------------------------------------------------------
    // Restore / verify  (call at boot AND on app resume)
    // -------------------------------------------------------------------------

    /**
     * Queries Google Play for active purchases and syncs Settings.adsRemoved.
     *
     * - Found in Play  â†’ adsRemoved = true
     * - Absent in Play â†’ adsRemoved = false  (catches refunds & chargebacks)
     * - Play unavailable (offline) â†’ leave local state unchanged
     *
     * Silent no-op on web.
     */
    async restorePurchases() {
        if (!this.isAvailable) return;
        try {
            const { purchases } = await NativePurchases.getPurchases({
                productType: PURCHASE_TYPE.INAPP
            });
            // purchaseState: "1" = PURCHASED, "2" = PENDING, "0" = UNSPECIFIED/voided.
            // Cancelled/refunded test purchases can still appear in queryPurchasesAsync()
            // results but with purchaseState != "1". Only treat state "1" as an active licence.
            const found = purchases?.some(
                p => p.productIdentifier === PRODUCT_ID && String(p.purchaseState) === '1'
            );
            console.log('[IAPService] restorePurchases: raw results:', JSON.stringify(
                (purchases ?? []).map(p => ({ id: p.productIdentifier, state: p.purchaseState }))
            ));
            if (found) {
                if (!Settings.adsRemoved) {
                    Settings.adsRemoved = true;
                    console.log('[IAPService] restorePurchases: active purchase found (state=1) — ads removed');
                }
            } else {
                // Play responded but no product with state=PURCHASED — no active licence.
                if (Settings.adsRemoved) {
                    Settings.adsRemoved = false;
                    console.log('[IAPService] restorePurchases: no PURCHASED state — benefit revoked (refunded/voided?)');
                }
            }
        } catch (e) {
            // Offline or Play unavailable â€” keep local state so we don't
            // accidentally revoke the benefit while the user is offline.
            console.warn('[IAPService] restorePurchases: query failed, keeping local state:', e?.message ?? e);
        }
    }

    // -------------------------------------------------------------------------
    // Debug status  (for on-screen debug panel)
    // -------------------------------------------------------------------------

    /**
     * Queries getPurchases() and returns raw state for debugging.
     * @returns {Promise.<{platform:string, found:boolean, purchases:Array, error:string}>}
     */
    async debugCheckStatus() {
        if (!this.isAvailable) {
            return { platform: 'web', found: null, purchases: [], error: null };
        }
        try {
            const { purchases } = await NativePurchases.getPurchases({
                productType: PURCHASE_TYPE.INAPP
            });
            const list = purchases ?? [];
            const match = list.find(p => p.productIdentifier === PRODUCT_ID);
            // purchaseState "1" = PURCHASED (active), "2" = PENDING, "0" = voided/cancelled
            const found = match != null && String(match.purchaseState) === '1';
            const foundRaw = match != null; // appears in list regardless of state
            return {
                platform: 'native',
                found,
                foundRaw,
                purchaseState: match ? String(match.purchaseState) : null,
                isAcknowledged: match ? match.isAcknowledged : null,
                purchases: list,
                error: null
            };
        } catch (e) {
            return { platform: 'native', found: null, purchases: [], error: e?.message ?? String(e) };
        }
    }

    // -------------------------------------------------------------------------
    // Price
    // -------------------------------------------------------------------------

    /**
     * Returns the localised price string (e.g. "$0.99") or null.
     * @returns {Promise<string|null>}
     */
    async getPrice() {
        if (!this.isAvailable) return null;
        try {
            const { products } = await NativePurchases.getProducts({
                productIdentifiers: [PRODUCT_ID],
                productType: PURCHASE_TYPE.INAPP
            });
            return products?.[0]?.localizedPriceString ?? null;
        } catch (e) {
            console.warn('[IAPService] getPrice failed:', e?.message ?? e);
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Purchase
    // -------------------------------------------------------------------------

    /**
     * Launch the Google Play purchase flow for Remove Ads.
     *
     * The product is non-consumable: the token stays in Play inventory so
     * restorePurchases() can verify it on every boot/resume.
     *
     * @returns {Promise.<{success: boolean, error: string}>}
     */
    async purchase() {
        if (!this.isAvailable) {
            return { success: false, error: 'Not available on this platform' };
        }

        // Pre-flight: confirm the product is active in Play Console.
        try {
            const { products } = await NativePurchases.getProducts({
                productIdentifiers: [PRODUCT_ID],
                productType: PURCHASE_TYPE.INAPP
            });
            if (!products || products.length === 0) {
                return {
                    success: false,
                    error: `"${PRODUCT_ID}" not found in Play Console.\nCheck it is Active and app has been uploaded to a track.`
                };
            }
            console.log('[IAPService] Product found:', products[0]?.localizedPriceString);
        } catch (e) {
            const msg = e?.message ?? String(e);
            console.warn('[IAPService] getProducts pre-flight failed:', msg);
            return { success: false, error: `Store unavailable: ${msg}` };
        }

        try {
            const transaction = await NativePurchases.purchaseProduct({
                productIdentifier: PRODUCT_ID,
                productType: PURCHASE_TYPE.INAPP,
                isConsumable: false,            // non-consumable â€” stays in Play inventory
                autoAcknowledgePurchases: true  // acknowledge so Play doesn't auto-void it
            });
            console.log('[IAPService] purchaseProduct resolved:', JSON.stringify(transaction));
            Settings.adsRemoved = true;
            console.log('[IAPService] Purchase successful â€” ads removed');
            return { success: true };

        } catch (e) {
            const msg = e?.message ?? String(e);
            const cancelled = msg.includes('cancel') || msg.includes('Cancel') || msg.includes('USER_CANCELED');
            console.warn('[IAPService] purchase threw:', msg);

            if (!cancelled) {
                // ITEM_ALREADY_OWNED = token still in Play inventory (non-consumable).
                // Verify purchaseState=1 before granting — refunded tokens linger but have voided state.
                if (msg.includes('already own') || msg.includes('ITEM_ALREADY_OWNED')) {
                    try {
                        const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
                        const active = purchases?.some(
                            p => p.productIdentifier === PRODUCT_ID && String(p.purchaseState) === '1'
                        );
                        if (active) {
                            Settings.adsRemoved = true;
                            console.log('[IAPService] ITEM_ALREADY_OWNED — active licence confirmed, granting benefit');
                            return { success: true };
                        } else {
                            console.warn('[IAPService] ITEM_ALREADY_OWNED but no active state=1 licence — likely refunded');
                            return { success: false, error: 'PURCHASE_NOT_AVAILABLE' };
                        }
                    } catch (verifyErr) {
                        // Cannot reach Play — grant conservatively to avoid stranding the user
                        Settings.adsRemoved = true;
                        console.warn('[IAPService] ITEM_ALREADY_OWNED — verification failed, granting conservatively:', verifyErr?.message);
                        return { success: true };
                    }
                }

                // Return the actual error so it's visible in the UI during debugging.
                return { success: false, error: msg };
            }

            return { success: false, error: cancelled ? null : msg };
        }
    }
}

export const IAPService = new IAPServiceClass();
