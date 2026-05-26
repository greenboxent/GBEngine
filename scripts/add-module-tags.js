// scripts/add-module-tags.js
// One-shot script: prepends /** @module <name> */ to every source file.
// Safe to re-run — skips files that already have a @module tag.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const FILES = {
  // engine
  'src/engine/Debug.js':                         'engine/Debug',
  'src/engine/debug/DebugCore.js':               'engine/DebugCore',
  'src/engine/debug/DebugInspector.js':          'engine/DebugInspector',
  'src/engine/debug/DebugOverlay.js':            'engine/DebugOverlay',
  'src/engine/debug/DebugPerf.js':               'engine/DebugPerf',

  // scenes
  'src/scenes/BaseBootScene.js':                 'scenes/BaseBootScene',
  'src/scenes/BaseGameOverScene.js':             'scenes/BaseGameOverScene',
  'src/scenes/BaseKeybindingsScene.js':          'scenes/BaseKeybindingsScene',
  'src/scenes/BaseLeaderboardScene.js':          'scenes/BaseLeaderboardScene',
  'src/scenes/BaseLevelCompleteScene.js':        'scenes/BaseLevelCompleteScene',
  'src/scenes/BaseLevelSelectScene.js':          'scenes/BaseLevelSelectScene',
  'src/scenes/BaseLoginScene.js':                'scenes/BaseLoginScene',
  'src/scenes/BaseMainMenuScene.js':             'scenes/BaseMainMenuScene',
  'src/scenes/BaseNarrativeScene.js':            'scenes/BaseNarrativeScene',
  'src/scenes/BasePauseScene.js':                'scenes/BasePauseScene',
  'src/scenes/BaseSceneController.js':           'scenes/BaseSceneController',
  'src/scenes/BaseSettingsScene.js':             'scenes/BaseSettingsScene',
  'src/scenes/BaseStoreScene.js':                'scenes/BaseStoreScene',

  // systems
  'src/systems/AdService.js':                    'systems/AdService',
  'src/systems/animations.js':                   'systems/animations',
  'src/systems/BaseSettingsManager.js':          'systems/BaseSettingsManager',
  'src/systems/DamageText.js':                   'systems/DamageText',
  'src/systems/FirebaseService.js':              'systems/FirebaseService',
  'src/systems/IAPService.js':                   'systems/IAPService',
  'src/systems/InputController.js':              'systems/InputController',
  'src/systems/KeybindingManager.js':            'systems/KeybindingManager',
  'src/systems/LeaderboardService.js':           'systems/LeaderboardService',
  'src/systems/Pathfinding.js':                  'systems/Pathfinding',
  'src/systems/PersonalScores.js':               'systems/PersonalScores',
  'src/systems/ScoreManager.js':                 'systems/ScoreManager',
  'src/systems/SettingsManager.js':              'systems/SettingsManager',
  'src/systems/SoundManager.js':                 'systems/SoundManager',
  'src/systems/TouchControls.js':                'systems/TouchControls',
  'src/systems/WaveManager.js':                  'systems/WaveManager',
  'src/systems/scene/GameFlowManager.js':        'systems/scene/GameFlowManager',
  'src/systems/scene/ModalBase.js':              'systems/scene/ModalBase',
  'src/systems/scene/ModalManager.js':           'systems/scene/ModalManager',
  'src/systems/scene/SceneStateManager.js':      'systems/scene/SceneStateManager',
  'src/systems/scene/TransitionManager.js':      'systems/scene/TransitionManager',

  // ui
  'src/ui/GamepadTestPanel.js':                  'ui/GamepadTestPanel',
  'src/ui/ui.js':                                'ui/ui',

  // ui/components
  'src/ui/components/uiButton.js':               'ui/components/uiButton',
  'src/ui/components/uiLayout.js':               'ui/components/uiLayout',
  'src/ui/components/uiMenuButton.js':           'ui/components/uiMenuButton',
  'src/ui/components/uiPanel.js':                'ui/components/uiPanel',
  'src/ui/components/uiScrollablePanel.js':      'ui/components/uiScrollablePanel',
  'src/ui/components/uiSelector.js':             'ui/components/uiSelector',
  'src/ui/components/uiSlider.js':               'ui/components/uiSlider',
  'src/ui/components/uiTabs.js':                 'ui/components/uiTabs',
  'src/ui/components/uiText.js':                 'ui/components/uiText',
  'src/ui/components/uiToggle.js':               'ui/components/uiToggle',
  'src/ui/components/uiTransitions.js':          'ui/components/uiTransitions',

  // ui/styles
  'src/ui/styles/buttonTheme.js':                'ui/styles/buttonTheme',
  'src/ui/styles/titleTheme.js':                 'ui/styles/titleTheme',
};

let added = 0, skipped = 0;

for (const [rel, moduleName] of Object.entries(FILES)) {
  const full = resolve(BASE, rel);
  const content = readFileSync(full, 'utf8');

  if (content.includes('@module ')) {
    console.log(`  skip  ${rel}`);
    skipped++;
    continue;
  }

  const tag = `/**\n * @module ${moduleName}\n */\n`;
  writeFileSync(full, tag + content);
  console.log(`  added ${rel}  →  ${moduleName}`);
  added++;
}

console.log(`\nDone. ${added} tagged, ${skipped} skipped.`);
