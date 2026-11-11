// src/scenes/LeaderboardScene.js
// Global board (works for guests too) and "my best scores", with a left/right toggle.
import { BaseLeaderboardScene, createText } from '@gamebase/gbengine';
import { leaderboardService } from '../systems/leaderboardService.js';
import { bestScores, syncProgress } from '../systems/progress.js';

export default class LeaderboardScene extends BaseLeaderboardScene {
    constructor() {
        super('LeaderboardScene', leaderboardService);
    }

    // The personal view comes from the progress store (see progress.js).
    async _renderPersonalView(cx, startY) {
        await syncProgress(); // no-op unless the signed-in account changed
        const rows = bestScores();
        const text = rows.length
            ? rows.map(r => `Level ${r.level}:  ${r.score.toLocaleString()}`).join('\n')
            : 'No personal scores yet.\nComplete some levels!';
        this.contentContainer.add(
            createText(this, cx, startY + 100, text, { fontSize: this._fs(22), color: '#AAAAAA', align: 'center' }).setOrigin(0.5, 0)
        );
    }
}
