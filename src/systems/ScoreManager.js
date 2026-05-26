/**
 * Centralizes point calculations; configure once at boot with enemy point values.
 * @module systems/ScoreManager
 */

import { Debug } from '../engine/Debug.js';

/**
 * Centralizes point calculations for a game.
 *
 * Configure once at boot with a table of enemy types → base point values,
 * then use `calculateTotalScore()` to compute a final score from match stats.
 *
 * @example
 * ScoreManager.configure({ drone: 100, asteroid: 250, boss: 2000 });
 * const total = ScoreManager.calculateTotalScore(stats);
 */
export class ScoreManager {
    /**
     * Enemy point table.  Set per-game via configure().
     * Default is a minimal fallback so calculateTotalScore always works.
     * @type {Record<string, number>}
     */
    static ENEMY_POINTS = {};

    /**
     * Set the enemy-points table for this game.
     * Call once during your BootScene or before the first level starts.
     *
     * @param {Record<string, number>} pointsTable   Map of enemy-type key → base points.
     */
    static configure(pointsTable) {
        this.ENEMY_POINTS = { ...pointsTable };
    }

    // -------------------------------------------------------------------------
    // Calculations
    // -------------------------------------------------------------------------

    /**
     * Calculate total score from a stats object.
     *
     * @param {object} stats
     * @param {Record<string,number>} [stats.kills]          Kills by enemy type.
     * @param {Record<string,number>} [stats.shots]          Shots fired by enemy type.
     * @param {number}               [stats.tilesCleared]    Tiles revealed (fog-of-war).
     * @param {number}               [stats.treasurePoints]  Bonus treasure value.
     * @returns {number} Combined enemy, tiles, and treasure score.
     */
    static calculateTotalScore(stats) {
        const enemyScore    = this.calculateEnemyScore(stats);
        const tilesScore    = this.calculateTilesScore(stats);
        const treasureScore = stats.treasurePoints || 0;
        const total         = enemyScore + tilesScore + treasureScore;

        Debug.log('ScoreManager',
            `Total: ${total}  (enemies: ${enemyScore}, tiles: ${tilesScore}, treasure: ${treasureScore})`, 2);
        return total;
    }

    /**
     * Calculate score from enemy kills, with accuracy bonus (1×–2×).
     *
     * @param {object} stats  Stats containing `kills` and `shots` maps.
     * @returns {number} Kill score with accuracy multiplier applied.
     */
    static calculateEnemyScore(stats) {
        const kills = stats.kills || {};
        const shots = stats.shots || {};
        let total = 0;

        for (const [type, killCount] of Object.entries(kills)) {
            const base       = (this.ENEMY_POINTS[type] ?? 100) * killCount;
            const shotCount  = shots[type] || 0;
            let   multiplier = 1.0;
            if (shotCount > 0 && killCount > 0) {
                multiplier = 1.0 + Math.min(killCount / shotCount, 1.0);
            }
            const earned = Math.floor(base * multiplier);
            total += earned;
            Debug.log('ScoreManager', `${type}: ${killCount}k × ${base} × ${multiplier.toFixed(2)} = ${earned}`, 2);
        }
        return total;
    }

    /**
     * Calculate score from tiles cleared (1 pt each).
     *
     * @param {object} stats  Stats containing a `tilesCleared` count.
     * @returns {number} One point per tile cleared.
     */
    static calculateTilesScore(stats) {
        return stats.tilesCleared || 0;
    }

    /**
     * Format a score with locale-appropriate thousands separator.
     *
     * @param {number} score  Integer score to format.
     * @returns {string} Score formatted with thousands separators.
     */
    static formatScore(score) {
        return score.toLocaleString();
    }
}
