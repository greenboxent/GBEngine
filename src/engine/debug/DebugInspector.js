/**
 * Click-to-inspect entity debugger and hitbox visualiser. Lives in SceneController.
 * @module engine/DebugInspector
 */

/**
 * Click-to-inspect entity debugger and hitbox visualiser.
 *
 * Attach a resolver function via {@link DebugInspector#setEntityResolver} that
 * maps the live GameScene to its entity lists, then call
 * {@link DebugInspector#attachScene} once from SceneController.create().
 * While debug is enabled, clicking an entity logs its state to the overlay;
 * hitboxes for all entities are drawn every frame.
 */
export class DebugInspector {
    /**
     * @param {DebugCore} core  Shared debug state managed by DebugSystemFacade.
     */
    constructor(core) {
        /** @type {DebugCore} */
        this.core = core;

        /** @type {Phaser.Scene|null} */
        this.scene = null;

        /** @type {Phaser.GameObjects.Graphics|null} */
        this.hitboxGfx = null;

        /** @type {Function|null} (gameScene) => { enemies, player, extras } */
        this._entityResolver = null;
    }

    /**
     * Provide a function that extracts entity lists from the live GameScene.
     * Must be called before attachScene() so click detection works.
     *
     * @param {Function} fn
     *   Callback that receives the live GameScene and returns entity lists.
     *   Receives the live gameScene and should return:
     *   ```
     *   {
     *     enemies: Phaser.GameObjects.Sprite[],
     *     player:  Phaser.GameObjects.Sprite | null,
     *     extras?: Array<{
     *       items:   Phaser.GameObjects.Sprite[],
     *       color:   number,       // 0xRRGGBB
     *       useBody?: boolean,     // draw physics body rect instead of display bounds
     *     }>,
     *   }
     *   ```
     */
    setEntityResolver(fn) {
        this._entityResolver = fn;
    }

    /**
     * Attach to the SceneController.  Sets up graphics and the pointer handler.
     *
     * @param {Phaser.Scene} scene  The SceneController scene to attach to.
     */
    attachScene(scene) {
        this.scene = scene;

        this.hitboxGfx = scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(99996)
            .setVisible(false);

        scene.input.on('pointerdown', pointer => {
            if (!this.core.enabled) return;
            const gameScene = this.core.gameScene;
            if (!gameScene) return;

            const x = pointer.worldX;
            const y = pointer.worldY;

            const { enemies = [], player = null } = this._resolve(gameScene);

            let target = enemies.find(e => e.getBounds().contains(x, y));
            if (!target && player && player.getBounds().contains(x, y)) target = player;
            if (target) this.inspectEntity(target);
        });
    }

    /**
     * Display entity information in the debug overlay.
     *
     * @param {Phaser.GameObjects.Sprite} entity  The entity to inspect and log state for.
     */
    inspectEntity(entity) {
        const info = [
            'ENTITY INSPECTOR',
            '---------------------',
            `Type: ${entity.type   ?? 'unknown'}`,
            `State: ${entity.state ?? 'unknown'}`,
            `Health: ${entity.health ?? '?'} / ${entity.maxHealth ?? '?'}`,
            `Pos: (${entity.x.toFixed(1)}, ${entity.y.toFixed(1)})`,
            entity.body
                ? `Vel: (${entity.body.velocity.x.toFixed(1)}, ${entity.body.velocity.y.toFixed(1)})`
                : 'Vel: n/a',
            `Facing: ${entity.facing ?? 'n/a'}`,
            `Anim: ${entity.anims?.currentAnim?.key ?? 'none'}`,
        ].join('\n');

        this.core.buffer.push(info);
        if (this.core.buffer.length > 10) this.core.buffer.shift();
        if (this.core.overlay) this.core.overlay.setText(this.core.buffer.join('\n'));
    }

    /**
     * Per-frame update — draws hitboxes.
     *
     * @param {boolean} active  Whether debug hitboxes should be visible.
     */
    update(active) {
        if (!this.hitboxGfx) return;
        this.hitboxGfx.clear();
        this.hitboxGfx.setVisible(active);
        if (!active) return;

        const gameScene = this.core.gameScene;
        if (!gameScene) return;

        // Sync graphics position with GameScene camera
        const cam = gameScene.cameras.main;
        this.hitboxGfx.x = -cam.scrollX;
        this.hitboxGfx.y = -cam.scrollY;

        const { enemies = [], player = null, extras = [] } = this._resolve(gameScene);

        // Player + enemies — red
        this.hitboxGfx.lineStyle(1, 0xff0000, 1);
        if (player && typeof player.debugDraw === 'function') player.debugDraw(this.hitboxGfx);
        enemies.forEach(e => { if (typeof e.debugDraw === 'function') e.debugDraw(this.hitboxGfx); });

        // Extras — colour-coded groups
        for (const group of extras) {
            this.hitboxGfx.lineStyle(1, group.color ?? 0xffffff, 1);
            for (const item of group.items || []) {
                if (!item.active) continue;
                if (group.useBody && item.body) {
                    const b = item.body;
                    this.hitboxGfx.strokeRect(b.x, b.y, b.width, b.height);
                } else {
                    const hw = (item.displayWidth  || item.width)  / 2;
                    const hh = (item.displayHeight || item.height) / 2;
                    this.hitboxGfx.strokeRect(item.x - hw, item.y - hh, hw * 2, hh * 2);
                }
            }
        }
    }

    /** @private */
    _resolve(gameScene) {
        if (!this._entityResolver) return { enemies: [], player: null, extras: [] };
        try {
            return this._entityResolver(gameScene) ?? {};
        } catch {
            return {};
        }
    }
}
