// src/index.js — @gamebase/shared barrel
// Re-exports everything needed by game repos.

// ─── Engine ──────────────────────────────────────────────────────────────────
export { Debug }             from './engine/Debug.js';
export { DebugCore }         from './engine/debug/DebugCore.js';
export { DebugInspector }    from './engine/debug/DebugInspector.js';
export { DebugOverlay }      from './engine/debug/DebugOverlay.js';
export { DebugPerf }         from './engine/debug/DebugPerf.js';

// ─── Systems — adapted ───────────────────────────────────────────────────────
export { firebaseService }   from './systems/FirebaseService.js';
export { LeaderboardService } from './systems/LeaderboardService.js';
export { PersonalScores }    from './systems/PersonalScores.js';
export { ScoreManager }      from './systems/ScoreManager.js';
export { BaseSettingsManager } from './systems/BaseSettingsManager.js';
export { Settings, registerSettings } from './systems/SettingsManager.js';

// ─── Systems — verbatim ──────────────────────────────────────────────────────
export { AdService }         from './systems/AdService.js';
export { IAPService }        from './systems/IAPService.js';
export { InputController }   from './systems/InputController.js';
export { KeybindingManager, Keybindings } from './systems/KeybindingManager.js';
export { SoundManager }      from './systems/SoundManager.js';
export { TouchControls }     from './systems/TouchControls.js';
export { default as WaveManager } from './systems/WaveManager.js';
export { spawnDamageText }   from './systems/DamageText.js';
export * from './systems/Pathfinding.js';           // findPath, worldToGrid, gridToWorld
export { createAnimations, debugAnimations } from './systems/animations.js';

// ─── Scene management ────────────────────────────────────────────────────────
export { default as ModalBase }         from './systems/scene/ModalBase.js';
export { default as ModalManager }      from './systems/scene/ModalManager.js';
export { default as SceneStateManager } from './systems/scene/SceneStateManager.js';
export { default as TransitionManager } from './systems/scene/TransitionManager.js';
export { default as GameFlowManager }   from './systems/scene/GameFlowManager.js';

// ─── Base scenes ─────────────────────────────────────────────────────────────
export { default as BaseBootScene }          from './scenes/BaseBootScene.js';
export { default as BaseSceneController }    from './scenes/BaseSceneController.js';
export { default as BaseMainMenuScene }      from './scenes/BaseMainMenuScene.js';
export { default as BaseGameOverScene }      from './scenes/BaseGameOverScene.js';
export { default as BasePauseScene }         from './scenes/BasePauseScene.js';
export { default as BaseLevelCompleteScene } from './scenes/BaseLevelCompleteScene.js';
export { default as BaseSettingsScene }      from './scenes/BaseSettingsScene.js';
export { default as BaseLeaderboardScene }   from './scenes/BaseLeaderboardScene.js';
export { default as BaseNarrativeScene }     from './scenes/BaseNarrativeScene.js';
export { default as BaseLoginScene }         from './scenes/BaseLoginScene.js';
export { default as BaseStoreScene }         from './scenes/BaseStoreScene.js';
export { default as BaseKeybindingsScene }   from './scenes/BaseKeybindingsScene.js';
export { default as BaseLevelSelectScene }   from './scenes/BaseLevelSelectScene.js';

// ─── UI ──────────────────────────────────────────────────────────────────────
// ui.js already re-exports everything from all components via export *
export * from './ui/ui.js';
export * from './ui/styles/buttonTheme.js';
export * from './ui/styles/titleTheme.js';
export { default as GamepadTestPanel } from './ui/GamepadTestPanel.js';
