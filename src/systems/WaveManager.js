/**
 * Controls wave progression within a level: initializing waves, tracking state,
 * detecting when all enemies are defeated, and signaling GameScene when the
 * level is complete. Does not spawn enemies directly.
 * @module systems/WaveManager
 */

/**
 * Controls wave progression within a level.
 *
 * Tracks the wave state (`'in-wave'`, `'wave-cleared'`, `'level-complete'`),
 * detects when all enemies are defeated, and fires the `levelComplete` event
 * on the owning scene when the exit is reached.
 *
 * Does **not** spawn enemies directly — delegates to `EnemySpawner`.
 */
export default class WaveManager {
    /**
     * @param {Phaser.Scene} scene - The GameScene that owns this manager.
     * @param {object} enemySpawner - The EnemySpawner instance responsible for spawning enemies.
     */
    constructor(scene, enemySpawner) {
        this.scene = scene;
        this.enemySpawner = enemySpawner;

        // Level and wave tracking
        this.currentLevel = 1;
        this.currentWave = 1;

        // Possible states:
        // "in-wave"       → enemies alive
        // "wave-cleared"  → all enemies defeated
        // "level-complete"→ exit reached
        this.state = 'in-wave';
    }

    // -------------------------------------------------------------------------
    // INITIALIZE LEVEL
    // -------------------------------------------------------------------------

    /**
     * Initializes the manager for the given level and spawns the first wave.
     * @param {number} [level=1] - The level number to initialize.
     */
    initForLevel(level = 1) {
        this.currentLevel = level;

        // Simple mapping: level N → wave N
        this.currentWave = level;

        this.state = 'in-wave';

        // Spawn the wave
        this.enemySpawner.spawnWave(this.currentWave);
    }

    // -------------------------------------------------------------------------
    // UPDATE LOOP
    // -------------------------------------------------------------------------

    /**
     * Per-frame update. Checks whether all enemies are defeated
     * and transitions the state to `wave-cleared` when they are.
     * Call this once per frame from GameScene.update().
     */
    update() {
        // Only check for completion during active waves
        if (this.state !== 'in-wave') return;

        // If all enemies are defeated, mark wave as cleared
        if (this.enemySpawner.allEnemiesDefeated()) {
            this.state = 'wave-cleared';

            // IMPORTANT:
            // We do NOT spawn the next wave here.
            // GameScene handles level completion when the player reaches the exit.
        }
    }

    // -------------------------------------------------------------------------
    // STATE HELPERS
    // -------------------------------------------------------------------------

    /**
     * Returns whether the current wave has been cleared (all enemies defeated).
     * @returns {boolean}
     */
    isWaveCleared() {
        return this.state === 'wave-cleared';
    }

    /**
     * Marks the level as complete (e.g., player reached the exit).
     * Transitions state to `level-complete`.
     */
    markLevelComplete() {
        this.state = 'level-complete';
    }
}
