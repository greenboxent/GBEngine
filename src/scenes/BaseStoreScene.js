/**
 * @module scenes/BaseStoreScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton, createText } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';

/**
 * In-app purchase shop scene.
 *
 * Renders the items returned by `_getStoreItems()` and handles the purchase
 * flow via `IAPService`.  Each item shows a label, description, price, and a
 * Buy button.
 *
 * Override hooks:
 * - `_getStoreItems()` — return `Array<{id, label, description, price}>`
 * - `_onPurchase(productId)` — called after a successful purchase
 * - `_onClose()` — called when the store scene closes
 */
export default class BaseStoreScene extends Phaser.Scene {
    /**
     * @param {string} [key='StoreScene']
     * @param {object} [iapService]  IAPService instance (optional).
     */
    constructor(key = 'StoreScene', iapService = null) {
        super(key);
        this._iap          = iapService;
        this.modal         = null;
        this.inputController = null;
        this.inputCooldown = 0;
    }

    /**
     * Builds the store modal with item list and Close button.
     * @override
     */
    create() {
        const { width, height } = this.scale;
        this.modal = new ModalBase(this, {
            width:   Math.min(520, width  * 0.86),
            height:  Math.min(500, height * 0.80),
            padding: 28,
        });

        const cx = width  / 2;
        let   y  = height / 2 - 200;

        createText(this, cx, y, 'STORE', { fontSize: '24px', color: '#ffcc00' }).setOrigin(0.5).setDepth(99999);
        y += 44;

        const items = this._getStoreItems();
        items.forEach(item => {
            createText(this, cx, y, `${item.label} — ${item.price}`, {
                fontSize: '16px', color: '#ffffff'
            }).setOrigin(0.5).setDepth(99999);
            y += 22;
            createText(this, cx, y, item.description, {
                fontSize: '13px', color: '#aaaaaa', wordWrap: { width: 420 }
            }).setOrigin(0.5).setDepth(99999);
            y += 24;
            createMenuButton(this, cx, y, 'Buy', async () => {
                await this._purchase(item.id);
            });
            y += 52;
        });

        if (items.length === 0) {
            createText(this, cx, y, 'No items available.', { fontSize: '15px', color: '#888888' }).setOrigin(0.5).setDepth(99999);
        }

        createMenuButton(this, cx, y + 20, 'Close', () => this._close());
        this._setupInput();
    }

    /** @override */
    update() {
        if (this.inputCooldown > 0) { this.inputCooldown--; return; }
        this.inputController?.update();
    }

    // -------------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------------

    /**
     * Return the list of store items.
     * @returns {Array<{id:string, label:string, description:string, price:string}>}
     */
    _getStoreItems() { return []; }

    /**
     * Called after a successful purchase.
     * @param {string} productId  IAP product identifier that was purchased.
     */
    _onPurchase(_productId) {}

    /** Called when the store closes. */
    _onClose() {}

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /**
     * Attempts the purchase via IAPService and calls `_onPurchase` on success.
     * @private
     * @param {string} productId  IAP product identifier to purchase.
     * @returns {Promise<void>}
     */
    async _purchase(productId) {
        if (this._iap) {
            const ok = await this._iap.purchaseProduct(productId);
            if (ok) this._onPurchase(productId);
        }
    }

    /**
     * Calls `_onClose`, fades the camera out, then stops the scene.
     * @private
     */
    _close() {
        this._onClose();
        this.cameras.main.fadeOut(200);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.stop());
    }

    /**
     * Wires up gamepad/keyboard back-button to close the store.
     * @private
     */
    _setupInput() {
        this.inputController = new InputController(this, {
            onBack: () => this._close(),
        });
    }
}
