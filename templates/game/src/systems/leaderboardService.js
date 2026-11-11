// src/systems/leaderboardService.js
// One LeaderboardService for the whole game. `getTopScores()` works signed out (the rules
// allow public reads) and `submitScore()` needs an account + a player name.
import { LeaderboardService, firebaseService } from '@gamebase/gbengine';

export const leaderboardService = new LeaderboardService({
    firebaseService,
    collectionPath: '{{SLUG}}-leaderboard',
    backendMode: 'firebase',
});
