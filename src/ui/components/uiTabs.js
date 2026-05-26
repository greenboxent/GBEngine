/**
 * Horizontal tab bar UI component with highlighted active tab and a
 * callback invoked on tab switch.
 * @module ui/components/uiTabs
 */

/**
 * Creates a horizontal tab bar with selectable labelled tabs.
 * Automatically computes font size and layout to fit within `config.panelWidth`
 * (if provided), optionally wrapping to two rows.
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {number} x - Center X position of the tab bar.
 * @param {number} y - Y position of the first tab row.
 * @param {string[]} tabNames - Labels for each tab.
 * @param {string} initialTab - The tab that starts highlighted.
 * @param {Function} onChange - Callback invoked with the selected tab label when changed.
 * @param {object} [config={}] - Style and layout options.
 * @param {string} [config.color='#ffffff'] - Inactive tab colour.
 * @param {string} [config.activeColor='#00ffcc'] - Active (selected) tab colour.
 * @param {string} [config.hoverColor='#ffff88'] - Hover colour.
 * @param {number} [config.hoverScale=1.15] - Scale applied on hover.
 * @param {number} [config.rowGap=52] - Vertical gap between rows when two rows are used.
 * @param {number|null} [config.panelWidth=null] - Available panel width for auto-sizing.
 * @param {string} [config.fontSize='24px'] - Font size (used when panelWidth is null).
 * @param {number} [config.spacing=160] - Tab spacing in pixels (used when panelWidth is null).
 * @returns {Phaser.GameObjects.Container}
 */
export function createTabs(scene, x, y, tabNames, initialTab, onChange, config = {}) {
    const {
        color      = "#ffffff",
        activeColor = "#00ffcc",
        hoverColor = "#ffff88",
        hoverScale = 1.15,
        rowGap     = 52,
        // When provided, font size and row count are computed automatically.
        // Falls back to manual fontSize / spacing if not given.
        panelWidth = null,
        fontSize   = "24px",
        spacing    = 160,
    } = config;

    const n        = tabNames.length;
    const maxChars = Math.max(...tabNames.map(t => t.length));

    // -------------------------------------------------------------------------
    // Auto-layout engine
    // Estimates rendered width using Arial character-width heuristic:
    //   rendered px ≈ fontSize * 0.58 * numChars  +  horizontal padding
    // We binary-search the largest integer fontSize that keeps every label
    // within its cell, trying 1 row first then 2 rows.
    // -------------------------------------------------------------------------
    let numRows = 1;
    let actualFs;        // font size in px (number)
    let actualSpacing;   // centre-to-centre spacing per column

    if (panelWidth) {
        const PAD        = 18;   // extra px per label (breathing room)
        const CHAR_RATIO = 0.60; // Arial width/height ratio estimate
        const MAX_FS     = 24;
        const MIN_FS     = 12;

        // Returns the largest integer fontSize that fits `cols` tabs in `panelWidth`
        const fitFs = (cols) => {
            const availPerTab = (panelWidth * 0.94) / cols;
            const fs = (availPerTab - PAD) / (maxChars * CHAR_RATIO);
            return Math.max(MIN_FS, Math.min(MAX_FS, Math.floor(fs)));
        };

        const fs1    = fitFs(n);
        const need1  = n * (maxChars * fs1 * CHAR_RATIO + PAD);

        if (need1 <= panelWidth * 0.96 && fs1 >= 16) {
            // Single row fits at a readable size
            numRows       = 1;
            actualFs      = fs1;
            actualSpacing = (panelWidth * 0.94) / n;
        } else {
            // Two rows
            numRows = 2;
            const perRow  = Math.ceil(n / 2);
            actualFs      = Math.min(MAX_FS, fitFs(perRow));
            actualSpacing = (panelWidth * 0.94) / perRow;
        }
    } else {
        actualFs      = parseInt(fontSize, 10);
        actualSpacing = spacing;
    }

    const fsPx = `${actualFs}px`;

    // -------------------------------------------------------------------------
    // Build row arrays
    // -------------------------------------------------------------------------
    let rows;
    if (numRows === 2) {
        const perRow = Math.ceil(n / 2);
        rows = [tabNames.slice(0, perRow), tabNames.slice(perRow)];
    } else {
        rows = [tabNames];
    }

    // -------------------------------------------------------------------------
    // Container + state
    // -------------------------------------------------------------------------
    const container = scene.add.container(x, y).setDepth(99999);
    let activeTab   = initialTab || tabNames[0];

    function refresh() {
        container.iterate(child => {
            if (!child.isTabLabel) return;
            if (child.tabName === activeTab) {
                child.setColor(activeColor).setScale(1.1);
            } else {
                child.setColor(color).setScale(1.0);
            }
        });
    }

    function applyHover(tab) {
        tab.on("pointerover", () => {
            if (tab.tabName === activeTab) return;
            scene.tweens.add({ targets: tab, scale: hoverScale, duration: 120, ease: "Sine.easeOut" });
            tab.setColor(hoverColor);
        });
        tab.on("pointerout", () => refresh());
    }

    // -------------------------------------------------------------------------
    // Create labels — each row centred at local x = 0
    // -------------------------------------------------------------------------
    rows.forEach((rowTabs, rowIdx) => {
        const rowSpacing = panelWidth
            ? (panelWidth * 0.94) / rowTabs.length
            : actualSpacing;

        rowTabs.forEach((name, j) => {
            const tx = (j - (rowTabs.length - 1) / 2) * rowSpacing;
            const ty = rowIdx * rowGap;

            const tab = scene.add.text(tx, ty, name, {
                fontFamily: "Arial",
                fontSize: fsPx,
                color
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(99999);

            tab.isTabLabel = true;
            tab.tabName    = name;

            tab.on("pointerdown", () => {
                activeTab = name;
                refresh();
                if (onChange) onChange(name);
            });

            applyHover(tab);
            container.add(tab);
        });
    });

    // Total height of the tab bar (callers use this to offset content)
    container.tabsHeight  = numRows * rowGap;
    // Resolved font size in px (callers can cap their content fonts to this)
    container.tabsFontSize = actualFs;

    refresh();
    return container;
}
