/**
 * Scrollable viewport UI component with scene-level wheel/drag scrolling,
 * optional scrollbar, and a public `scrollBy()` API.
 * @module ui/components/uiScrollablePanel
 */
import * as Phaser from 'phaser';

/**
 * @typedef {Object} UIScrollablePanelOptions
 * @property {boolean} [showScrollbar=true] - Whether to display a scrollbar.
 * @property {boolean} [transparentBackground=false] - Whether to make background transparent.
 * @property {boolean} [showFrame=true] - Whether to show the border frame.
 * @property {boolean} [autoHideScrollbar=false] - Whether to hide scrollbar when not needed.
 */

/**
 * Creates a scrollable panel UI component.
 *
 * @param {Phaser.Scene} scene - The scene to attach the panel to.
 * @param {number} x - World X position of the panel.
 * @param {number} y - World Y position of the panel.
 * @param {number} width - Width of the visible viewport.
 * @param {number} height - Height of the visible viewport.
 * @param {UIScrollablePanelOptions} [options]
 *
 * @returns {Phaser.GameObjects.Container} Container extended with addItem, scrollBy, scrollToBottom,
 *   scrollToContentY, and getScrollState methods.
 */
export function UIScrollablePanel(scene, x, y, width, height, options = {}) {
    const showScrollbar = options.showScrollbar !== false;
    const transparentBackground = options.transparentBackground === true;
    const showFrame = options.showFrame !== false;
    const autoHideScrollbar = options.autoHideScrollbar === true;
    // Positive value shifts the scrollbar to the right (useful when the panel
    // sits inside a modal and the bar would otherwise be hidden by a border).
    const scrollbarOffset = options.scrollbarOffset || 0;

    // Root container (non-interactive; children handle their own input)
    const root = scene.add.container(x, y);
    root.disableInteractive();

    // Background frame
    const frame = scene.add.rectangle(0, 0, width, height, 0x111111)
        .setOrigin(0, 0);
    
    if (!transparentBackground) {
        frame.setFillStyle(0x111111);
    } else {
        frame.setAlpha(0);
    }
    
    if (showFrame) {
        frame.setStrokeStyle(2, 0xffffff);
    }
    
    root.add(frame);

    // Content container (this is what scrolls)
    const content = scene.add.container(0, 0);
    content.disableInteractive();
    root.add(content);

    // Mask (world-space geometry mask)
    const maskShape = scene.add.rectangle(
        x + width / 2,
        y + height / 2,
        width,
        height,
        0xffffff
    ).setOrigin(0.5).setVisible(false);

    // Phaser 4 WebGL uses the filter system for masking (geometry masks removed).
    // Canvas renderer still supports the classic geometry mask.
    if (scene.sys.game.renderer.gl) {
        root.enableFilters();
        root.filters.external.addMask(maskShape, false, scene.cameras.main, 'world');
    } else {
        const mask = maskShape.createGeometryMask();
        root.setMask(mask);
    }

    // Scroll state
    let scrollY = 0;
    let contentHeight = 0;
    let minScrollY = 0;
    let maxScrollY = 0;

    // Scrollbar elements
    let track = null;
    let thumb = null;
    const scrollbarWidth = 10;
    const thumbMinHeight = 20;

    /**
     * Recalculates scroll bounds based on content height.
     * @private
     */
    function recalcBounds() {
        if (content.list.length === 0) {
            contentHeight = 0;
            minScrollY = 0;
            maxScrollY = 0;
            applyScroll();
            updateThumbGeometry();
            return;
        }
        const bounds = content.getBounds();
        // bounds.height = distance from topmost to bottommost item only.
        // We need the bottom edge measured from y=0 (panel origin) so that any
        // top-padding before the first item is included in the overflow calculation.
        // bounds.bottom (world) - root.y (world top of panel) - content.y (scrollY) = local bottom.
        contentHeight = Math.max(0, bounds.bottom - root.y - content.y);

        const overflow = contentHeight - height;
        if (overflow > 0) {
            minScrollY = -overflow;
            maxScrollY = 0;
        } else {
            minScrollY = 0;
            maxScrollY = 0;
        }

        applyScroll();
        updateThumbGeometry();
    }

    /**
     * Applies scrollY to content and updates scrollbar.
     * @private
     */
    function applyScroll() {
        scrollY = Phaser.Math.Clamp(scrollY, minScrollY, maxScrollY);
        content.y = scrollY;
        maskShape.y = root.y + height / 2;
        updateThumbFromScroll();
    }

    /**
     * Updates scrollbar geometry.
     * @private
     */
    function updateThumbGeometry() {
        if (!showScrollbar) return;
        
        // Hide scrollbar if auto-hide is enabled and content fits
        const needsScrollbar = contentHeight > height;
        if (autoHideScrollbar && !needsScrollbar) {
            if (track) track.setVisible(false);
            if (thumb) thumb.setVisible(false);
            return;
        }

        if (!track) {
            track = scene.add.rectangle(
                width - scrollbarWidth / 2 + scrollbarOffset,
                height / 2,
                scrollbarWidth,
                height,
                0x000000,
                0.4
            ).setOrigin(0.5);
            root.add(track);
        } else {
            track.setVisible(true);
        }

        const visibleRatio = contentHeight > 0 ? height / contentHeight : 1;
        const thumbHeight = Phaser.Math.Clamp(height * visibleRatio, thumbMinHeight, height);

        if (!thumb) {
            thumb = scene.add.rectangle(
                width - scrollbarWidth / 2 + scrollbarOffset,
                thumbHeight / 2,
                scrollbarWidth - 2,
                thumbHeight,
                0xffffff,
                0.8
            ).setOrigin(0.5);

            thumb.setInteractive({ useHandCursor: true });
            scene.input.setDraggable(thumb);

            thumb.on('drag', (pointer, dragX, dragY) => {
                const top = 0;
                const bottom = height - thumb.height;
                const localY = Phaser.Math.Clamp(dragY, top, bottom);
                thumb.y = localY + thumb.height / 2;

                const t = (localY - top) / (bottom - top || 1);
                scrollY = maxScrollY + (minScrollY - maxScrollY) * t;
                applyScroll();
            });

            root.add(thumb);
        } else {
            thumb.height = thumbHeight;
            thumb.x = width - scrollbarWidth / 2 + scrollbarOffset;
        }

        updateThumbFromScroll();
    }

    /**
     * Updates scrollbar thumb position from scrollY.
     * @private
     */
    function updateThumbFromScroll() {
        if (!showScrollbar || !thumb || !track) return;
        if (contentHeight <= height) {
            thumb.setVisible(false);
            track.setVisible(false);
            return;
        }
        thumb.setVisible(true);
        track.setVisible(true);

        const top = 0;
        const bottom = height - thumb.height;
        const t = (scrollY - maxScrollY) / (minScrollY - maxScrollY || 1);
        const localY = top + (bottom - top) * t;
        thumb.y = localY + thumb.height / 2;
    }

    /**
     * Adds an item to the scrollable content.
     * Does NOT modify the item's interactivity.
     *
     * @param {Phaser.GameObjects.GameObject} item  Game object to add to the scrollable content.
     */
    root.addItem = function (item) {
        content.add(item);
        recalcBounds();
    };

    /**
     * Scrolls the panel by a delta amount.
     *
     * @param {number} deltaY - Amount to scroll vertically.
     */
    root.scrollBy = function (deltaY) {
        scrollY += deltaY;
        applyScroll();
    };

    /**
     * Scrolls the panel to the bottom.
     */
    root.scrollToBottom = function () {
        scrollY = minScrollY;
        applyScroll();
    };

    /**
     * Scrolls so that the given content-local Y is vertically centred in the panel.
     * @param {number} contentY - Y position within the content container to centre on.
     */
    root.scrollToContentY = function (contentY) {
        scrollY = height / 2 - contentY;
        applyScroll(); // clamps to minScrollY..maxScrollY automatically
    };

    /**
     * Gets the current scroll state.
     * @returns {{scrollY: number, minScrollY: number, maxScrollY: number, panelHeight: number, contentHeight: number}}
     */
    root.getScrollState = function () {
        return {
            scrollY,
            minScrollY,
            maxScrollY,
            panelHeight: height,
            contentHeight
        };
    };

    // -------------------------------------------------------------------------
    // Scene-level wheel + drag scrolling
    // -------------------------------------------------------------------------

    let dragging = false;
    let lastY = 0;
    let dragStartY = 0;
    const DRAG_THRESHOLD = 12;

    function pointerInsidePanel(worldX, worldY) {
        // Use the fixed visual viewport (root.x/y + width/height) rather than
        // root.getBounds(), which expands to include all content children even
        // when they are scrolled out of view — causing click-through below the panel.
        return (
            worldX >= root.x &&
            worldX <= root.x + width &&
            worldY >= root.y &&
            worldY <= root.y + height
        );
    }

    function onWheel(pointer, gameObjects, dx, dy) {
        if (!pointerInsidePanel(pointer.worldX, pointer.worldY)) return;
        root.scrollBy(-dy * 0.5);
    }

    function onPointerDown(pointer) {
        if (!pointerInsidePanel(pointer.worldX, pointer.worldY)) return;
        dragging = true;
        lastY = pointer.worldY;
        dragStartY = pointer.worldY;
    }

    function onPointerUp() {
        dragging = false;
    }

    function onPointerMove(pointer) {
        if (!dragging) return;
        if (Math.abs(pointer.worldY - dragStartY) < DRAG_THRESHOLD) return;
        const deltaY = pointer.worldY - lastY;
        lastY = pointer.worldY;
        root.scrollBy(deltaY);
    }

    scene.input.on('wheel', onWheel);
    scene.input.on('pointerdown', onPointerDown);
    scene.input.on('pointerup', onPointerUp);
    scene.input.on('pointermove', onPointerMove);

    // Cleanup: only remove our own handlers
    root.once('destroy', () => {
        scene.input.off('wheel', onWheel);
        scene.input.off('pointerdown', onPointerDown);
        scene.input.off('pointerup', onPointerUp);
        scene.input.off('pointermove', onPointerMove);
        maskShape.destroy();
        if (track) track.destroy();
        if (thumb) thumb.destroy();
    });

    return root;
}
