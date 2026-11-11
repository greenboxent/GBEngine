// src/scenes/SettingsScene.js
// GBEngine's tabbed settings; the Game tab holds the account block (Google sign-in, "or",
// player name, Sign Out, Delete Account) and the legal links — add your own settings around them.
import { BaseSettingsScene } from '@gamebase/gbengine';
import { ACCOUNT_DATA } from '../config/accountData.js';
import { syncProgress, publishLocalScores } from '../systems/progress.js';

export default class SettingsScene extends BaseSettingsScene {
    constructor() {
        super('SettingsScene', 'SceneController');
    }

    _buildGameTab(scrollPanel, panelW, tabFs, cfs) {
        let cy = 16;
        // Your game's own settings go here (createSelector / createSlider / createToggle), e.g. difficulty.
        cy = this._buildAccountSection(scrollPanel, cy, { panelW, tabFs, cfs });
        cy = this._buildLegalLinks(scrollPanel, cy, { panelW, tabFs });
        scrollPanel.addItem(this.add.rectangle(panelW / 2, cy, 4, 16, 0x000000, 0)); // bottom spacer
    }

    // Where this game keeps per-player data — enables the Delete Account button.
    _getAccountData() { return ACCOUNT_DATA; }

    // After any account change (Google sign-in, name+PIN): re-key progress to the new account.
    async _onAccountChanged() { await syncProgress(); }

    // After Google sign-in: post scores earned as a guest.
    async _afterGoogleSignIn() { publishLocalScores(); }

    // After a player name is set (name+PIN path): post scores earned before it existed.
    _claimPlayerName(newName, oldName) {
        super._claimPlayerName(newName, oldName);
        publishLocalScores();
    }
}
