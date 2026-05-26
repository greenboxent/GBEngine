/**
 * Centralized sound management system for music and sound effects.
 * Handles volume control, muting, and respects user settings.
 * @module systems/SoundManager
 */

import { Settings } from './SettingsManager.js';
import { Debug } from '../engine/Debug.js';

/**
 * Singleton sound manager.
 *
 * Manages all music tracks and sound effects for the game.  Respects the
 * user's volume and mute settings from {@link SettingsManager}.  Tracks
 * which music is currently playing (keyed by type — `'menu'` or `'level'`)
 * so volume adjustments in the settings panel are applied immediately.
 *
 * Obtain the instance via `SoundManager.init(scene)` on first use, then
 * `SoundManager.getInstance()` everywhere else.
 */
export class SoundManager {
    /**
     * Initialize the sound manager
     * @param {Phaser.Scene} scene - The scene to attach sounds to
     */
    static init(scene) {
        if (SoundManager._instance) {
            Debug.warn('SoundManager', 'Already initialized');
            return SoundManager._instance;
        }

        SoundManager._instance = new SoundManager(scene);
        return SoundManager._instance;
    }

    /**
     * Get the singleton instance
     * @returns {SoundManager}
     */
    static getInstance() {
        if (!SoundManager._instance) {
            Debug.warn('SoundManager', 'Not initialized yet');
        }
        return SoundManager._instance;
    }

    /**
     * @param {Phaser.Scene} scene - The scene to bind audio playback to.
     */
    constructor(scene) {
        this.scene = scene;
        this.music = new Map(); // Currently playing music tracks
        this.musicBaseVolumes = new Map(); // Base volumes for music tracks (before Settings multiplier)
        this.musicTypes = new Map(); // Track music types ('menu' or 'level')
        this.currentMusic = null; // Currently playing music key
        this._sfxActive = new Map(); // concurrent play count per sfx key
        
        Debug.log('SoundManager', 'Sound manager initialized');
    }

    /**
     * Load audio assets from config
     * @param {Phaser.Loader.LoaderPlugin} loader - Phaser loader
     * @param {Object} audioConfig - Audio configuration
     */
    static loadAudio(loader, audioConfig) {
        if (audioConfig.music) {
            audioConfig.music.forEach(track => {
                loader.audio(track.key, track.path);
                Debug.log('SoundManager', `Loading music: ${track.key}`);
            });
        }

        if (audioConfig.sfx) {
            audioConfig.sfx.forEach(sfx => {
                loader.audio(sfx.key, sfx.path);
                Debug.log('SoundManager', `Loading SFX: ${sfx.key}`);
            });
        }
    }

    /**
     * Play music track (stops any currently playing music)
     * @param {string} key - Audio key
     * @param {Object} options - Playback options (loop, volume, musicType, etc.)
     */
    playMusic(key, options = {}) {
        // Stop current music if playing
        if (this.currentMusic) {
            this.stopMusic(this.currentMusic);
        }

        // Check if sound exists
        if (!this.scene.cache.audio.exists(key)) {
            Debug.warn('SoundManager', `Music not found: ${key}`);
            return null;
        }

        const musicType = options.musicType ?? 'menu'; // 'menu' or 'level'
        const musicVolume = musicType === 'level' 
            ? (Settings.levelMusicVolume ?? 0.2)
            : (Settings.musicVolume ?? 1.0);
        const baseVolume = options.volume ?? 1.0;
        const volume = baseVolume * musicVolume;

        const music = this.scene.sound.add(key, {
            loop: options.loop ?? true,
            volume: volume
        });

        music.play();
        this.music.set(key, music);
        this.musicBaseVolumes.set(key, baseVolume); // Store base volume
        this.musicTypes.set(key, musicType); // Store music type
        this.currentMusic = key;

        Debug.log('SoundManager', `Playing music: ${key} (type: ${musicType}, volume: ${volume})`);
        return music;
    }

    /**
     * Stop music track
     * @param {string} key - Audio key
     */
    stopMusic(key) {
        const music = this.music.get(key);
        if (music) {
            music.stop();
            music.destroy();
            this.music.delete(key);
            this.musicBaseVolumes.delete(key);
            this.musicTypes.delete(key);
            
            if (this.currentMusic === key) {
                this.currentMusic = null;
            }
            
            Debug.log('SoundManager', `Stopped music: ${key}`);
        }
    }

    /**
     * Stop all music
     */
    stopAllMusic() {
        this.music.forEach((music, key) => {
            music.stop();
            music.destroy();
        });
        this.music.clear();
        this.musicBaseVolumes.clear();
        this.musicTypes.clear();
        this.currentMusic = null;
        // Also reset SFX concurrency counts — stopped sounds never fire 'complete',
        // leaving stale counts that would silently block sounds in the next scene.
        this._sfxActive.clear();
        Debug.log('SoundManager', 'All music stopped');
    }

    /**
     * Play sound effect
     * @param {string} key - Audio key
     * @param {Object} options - Playback options (volume, etc.)
     */
    playSFX(key, options = {}) {
        // Check if sound exists
        if (!this.scene.cache.audio.exists(key)) {
            Debug.warn('SoundManager', `SFX not found: ${key}`);
            return null;
        }

        // Per-key concurrency cap — prevents audio overload when many enemies fire at once.
        // Default cap is 10; pass maxConcurrent: Infinity to disable for a specific key.
        const maxConcurrent = options.maxConcurrent ?? 10;
        const active = this._sfxActive.get(key) ?? 0;
        if (active >= maxConcurrent) return null;

        const sfxVolume = Settings.sfxVolume ?? 1.0;
        const volume = (options.volume ?? 1.0) * sfxVolume;

        const sfx = this.scene.sound.add(key, {
            volume: volume
        });

        // Track concurrent count; decrement when the sound finishes
        this._sfxActive.set(key, active + 1);
        const decrement = () => {
            const n = (this._sfxActive.get(key) ?? 1) - 1;
            if (n <= 0) this._sfxActive.delete(key);
            else this._sfxActive.set(key, n);
        };

        sfx.play();

        // Auto-destroy after playing
        sfx.once('complete', () => {
            decrement();
            sfx.destroy();
        });

        Debug.log('SoundManager', `Playing SFX: ${key} (volume: ${volume})`, 3);
        return sfx;
    }

    /**
     * Update music volume (e.g., when settings change)
     */
    updateMusicVolume() {
        this.music.forEach((music, key) => {
            const musicType = this.musicTypes.get(key) ?? 'menu';
            const musicVolume = musicType === 'level'
                ? (Settings.levelMusicVolume ?? 0.2)
                : (Settings.musicVolume ?? 1.0);
            const baseVolume = this.musicBaseVolumes.get(key) ?? 1.0;
            music.setVolume(baseVolume * musicVolume);
        });
        
        Debug.log('SoundManager', `Music volumes updated`);
    }

    /**
     * Pause all currently playing music tracks.
     */
    pauseMusic() {
        this.music.forEach(music => {
            music.pause();
        });
    }

    /**
     * Resume all paused music tracks.
     */
    resumeMusic() {
        this.music.forEach(music => {
            music.resume();
        });
    }

    /**
     * Stop all music, clear state maps, and reset the singleton instance.
     * Called automatically by the scene's `shutdown` event.
     */
    destroy() {
        this.stopAllMusic();
        SoundManager._instance = null;
        Debug.log('SoundManager', 'Sound manager destroyed');
    }
}

// Singleton instance
SoundManager._instance = null;
