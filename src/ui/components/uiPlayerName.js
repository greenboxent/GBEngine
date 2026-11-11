/**
 * Small helpers for showing the player's name in menus. The name is the
 * localStorage `playerName` (a name only exists together with an account — see
 * `systems/Session.js`).
 * @module ui/components/uiPlayerName
 */

/** @returns {string} The saved player name, trimmed ('' if none). */
export function getPlayerName() {
    return (localStorage.getItem('playerName') || '').trim();
}

/**
 * The player name, or a pointer to where to set one, as a text object for a
 * main menu (under the title). Call `label.refreshPlayerName()` from the
 * scene's `update()` so it follows a name set or changed in Settings.
 *
 * @example
 * this._name = createPlayerNameLabel(this, cx, titleY + 45, { width: 360 });
 * // in update():  this._name.refreshPlayerName();
 *
 * @param {Phaser.Scene} scene
 * @param {number} x  Center X.
 * @param {number} y  Center Y.
 * @param {object} [options]
 * @param {number} [options.width=360]       Word-wrap width of the no-name hint.
 * @param {number} [options.nameSize=22]     Font size of the name.
 * @param {number} [options.hintSize=14]     Font size of the hint.
 * @param {string} [options.nameColor='#00ffcc']
 * @param {string} [options.hintColor='#ffaa00']
 * @param {string} [options.hint='Go to Settings > Game tab and set a player name']
 * @param {number} [options.depth=99999]
 * @returns {Phaser.GameObjects.Text & {refreshPlayerName: function(): void}}
 */
export function createPlayerNameLabel(scene, x, y, options = {}) {
    const {
        width = 360, nameSize = 22, hintSize = 14,
        nameColor = '#00ffcc', hintColor = '#ffaa00',
        hint = 'Go to Settings > Game tab and set a player name',
        depth = 99999,
    } = options;

    const label = scene.add.text(x, y, '', {
        fontFamily: 'Arial', align: 'center', wordWrap: { width },
    }).setOrigin(0.5).setDepth(depth);

    let shown = null;
    label.refreshPlayerName = () => {
        const name = getPlayerName();
        if (name === shown) return;
        shown = name;
        if (name) label.setText(name).setColor(nameColor).setFontSize(nameSize);
        else      label.setText(hint).setColor(hintColor).setFontSize(hintSize);
    };
    label.refreshPlayerName();
    return label;
}

/**
 * A small note for the level-select screen: without a player name nothing is
 * posted to the leaderboard. Returns null when the player has a name, so the
 * caller can lay out as usual.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x  Center X.
 * @param {number} y  Top Y (origin 0.5, 0).
 * @param {number} width  Word-wrap width.
 * @param {object} [options]
 * @param {string} [options.text]
 * @param {number} [options.fontSize=13]
 * @param {string} [options.color='#ffaa00']
 * @returns {Phaser.GameObjects.Text|null}  Add it to your container; use `note.y + note.height` to place content below.
 */
export function createNoPlayerNameNote(scene, x, y, width, options = {}) {
    if (getPlayerName()) return null;
    const {
        text = 'There is no playername so any levels played will not be recorded in high scores.',
        fontSize = 13, color = '#ffaa00',
    } = options;
    return scene.add.text(x, y, text, {
        fontFamily: 'Arial', fontSize, color, align: 'center', wordWrap: { width },
    }).setOrigin(0.5, 0);
}
