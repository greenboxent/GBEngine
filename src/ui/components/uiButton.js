/**
 * @module ui/components/uiButton
 */
// ui/uiButton.js
import * as Phaser from 'phaser';
import { SoundManager } from '../../systems/SoundManager.js';
import { ButtonTheme } from '../styles/buttonTheme.js';

// Per-scene registry: tracks which button is currently keyboard/gamepad "selected"
// so pointerover on any button can reset the prior selected button to normal.
const _sceneSelectedButton = new WeakMap();

/**
 * Creates an interactive button with optional image or graphic background and hover/scale effects.
 *
 * @param {Phaser.Scene} scene - The owning Phaser scene.
 * @param {number} x - Center X position.
 * @param {number} y - Center Y position.
 * @param {string} text - Button label text.
 * @param {Function} onClick - Callback invoked when the button is clicked.
 * @param {object} [options={}] - Style and behaviour options.
 * @param {string} [options.fontSize] - CSS font-size string (defaults to ButtonTheme.fontSize).
 * @param {string} [options.color] - Normal text colour.
 * @param {string} [options.hoverColor] - Text colour on hover.
 * @param {number} [options.scale] - Normal scale multiplier.
 * @param {number} [options.hoverScale] - Scale multiplier on hover.
 * @param {boolean} [options.showBackground=false] - Whether to render a background panel.
 * @param {number} [options.backgroundColor] - Background fill colour (graphic fallback).
 * @param {number} [options.backgroundAlpha] - Background fill alpha.
 * @param {number} [options.borderColor] - Border / glow colour.
 * @param {boolean} [options.borderGlow] - Whether to render the animated glow layers.
 * @param {number} [options.padding] - Horizontal padding around the label (pixels).
 * @returns {Phaser.GameObjects.Container} Container with `.textObject`, `.background`, and `.glowLayers`.
 */
export function createButton(scene, x, y, text, onClick, options = {}) {
    const {
        fontSize = ButtonTheme.fontSize,
        color = ButtonTheme.color.normal,
        hoverColor = ButtonTheme.color.hover,
        scale = ButtonTheme.scale.normal,
        hoverScale = ButtonTheme.scale.hover,
        showBackground = false,
        backgroundColor = ButtonTheme.backgroundColor,
        backgroundAlpha = ButtonTheme.backgroundAlpha,
        borderColor = ButtonTheme.borderColor,
        borderGlow = ButtonTheme.borderGlow,
        padding = ButtonTheme.padding
    } = options;

    // Create container for button components
    const container = scene.add.container(x, y).setDepth(99999);

    const btn = scene.add.text(0, 0, text, {
        fontFamily: "Arial",
        fontSize,
        color
    })
    .setOrigin(0.5)
    .setScrollFactor(0);

    // Get text bounds for background sizing
    const bounds = btn.getBounds();
    const bgWidth = bounds.width + padding * 2;
    const bgHeight = bounds.height + padding * 1.5;

    let background = null;
    let glowLayers = [];

    if (showBackground) {
        const radius = 12;
        
        // Use menus image for border (first 408px as test)
        if (scene.textures.exists('menus')) {
            // Create image background using first 408px of menus texture
            const menusTexture = scene.textures.get('menus');
            const textureHeight = menusTexture.source[0].height;
            const cropWidth = 408;
            
            background = scene.add.image(0, 0, 'menus');
            background.setOrigin(0, 0); // Top-left origin for easier positioning
            // Crop to first 408px width
            background.setCrop(0, 0, cropWidth, textureHeight);
            
            // Calculate scale to stretch 408px to bgWidth, then increase width by 20%, height by 30%
            const scaleX = (bgWidth / cropWidth) * 1.2;
            const scaleY = (bgHeight / textureHeight) * 1.3;
            background.setScale(scaleX, scaleY);
            
            // Position to center (account for scaled dimensions)
            const scaledWidth = bgWidth * 1.2;
            const scaledHeight = bgHeight * 1.3;
            background.setPosition(-scaledWidth / 2, -scaledHeight / 2);
            // Don't apply alpha to image background - keep it bright like arrows
            background.setTint(ButtonTheme.backgroundTint.normal); // Bright cyan like the arrows
            container.add(background);
        } else {
            // Fallback to original graphics-based border
            // Create glow effect with graphics objects for rounded corners
            if (borderGlow) {
                for (let i = 3; i > 0; i--) {
                    const glowGraphics = scene.add.graphics();
                    glowGraphics.lineStyle(3, borderColor, 0.3 / i);
                    glowGraphics.fillStyle(borderColor, 0.05 / i);
                    glowGraphics.fillRoundedRect(
                        -(bgWidth + i * 4) / 2,
                        -(bgHeight + i * 4) / 2,
                        bgWidth + i * 4,
                        bgHeight + i * 4,
                        radius + i * 2
                    );
                    glowGraphics.strokeRoundedRect(
                        -(bgWidth + i * 4) / 2,
                        -(bgHeight + i * 4) / 2,
                        bgWidth + i * 4,
                        bgHeight + i * 4,
                        radius + i * 2
                    );
                    
                    scene.add.tween({
                        targets: glowGraphics,
                        alpha: 0.3 / i,
                        duration: 1000 + i * 200,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    
                    glowLayers.push(glowGraphics);
                    container.add(glowGraphics);
                }
            }

            // Create main background using graphics for rounded corners
            background = scene.add.graphics();
            background.fillStyle(backgroundColor, backgroundAlpha);
            background.fillRoundedRect(
                -bgWidth / 2,
                -bgHeight / 2,
                bgWidth,
                bgHeight,
                radius
            );
            background.lineStyle(2, borderColor, 0.8);
            background.strokeRoundedRect(
                -bgWidth / 2,
                -bgHeight / 2,
                bgWidth,
                bgHeight,
                radius
            );

            container.add(background);
        }
    }

    container.add(btn);
    container.setScale(scale);
    container.setInteractive(
        new Phaser.Geom.Rectangle(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight),
        Phaser.Geom.Rectangle.Contains
    );
    container.setData('useHandCursor', true);

    // Store references
    container.textObject = btn;
    container.background = background;
    container.glowLayers = glowLayers;

    container.on("pointerover", () => {
        // If a different button is keyboard-selected, reset it to normal first
        const prevSelected = _sceneSelectedButton.get(scene);
        if (prevSelected && prevSelected !== container) {
            prevSelected._baseColor = color;
            prevSelected.textObject?.setColor(color);
        }
        scene.tweens.add({
            targets: container,
            scale: hoverScale,
            duration: 120,
            ease: 'Sine.easeOut'
        });
        btn.setColor(hoverColor);
    });

    container.on("pointerout", () => {
        scene.tweens.add({
            targets: container,
            scale: scale,
            duration: 120,
            ease: 'Sine.easeIn'
        });
        // Restore to the last color set by updateSelection (or normal if never selected)
        btn.setColor(container._baseColor);
    });

    container.on("pointerdown", () => {
        // Play menu tap sound
        const soundManager = SoundManager.getInstance();
        if (soundManager) {
            const audioConfig = scene.cache.json.get('audio-config');
            const tapSfx = audioConfig?.sfx?.find(s => s.key === 'menu-tap');
            if (tapSfx) {
                soundManager.playSFX('menu-tap', { volume: tapSfx.volume });
            }
        }
        
        if (onClick) onClick();
    });

    // Base color tracks the most recent color set by updateSelection().
    container._baseColor = color;

    // When this container is destroyed (e.g. tabContent.removeAll(true) during a
    // settings tab refresh), remove it from the scene-wide selected-button registry.
    // Without this, the next pointerover on any surviving button tries to call
    // setColor() on the destroyed text object → null GL texture → crash.
    container.on('destroy', () => {
        if (_sceneSelectedButton.get(scene) === container) {
            _sceneSelectedButton.delete(scene);
        }
    });

    // Add compatibility methods for existing code
    container.setColor = (newColor) => {
        container._baseColor = newColor;
        btn.setColor(newColor);
        // Register this container as the scene's keyboard-selected button
        // when its color differs from the default normal color.
        if (newColor !== color) {
            _sceneSelectedButton.set(scene, container);
        } else if (_sceneSelectedButton.get(scene) === container) {
            _sceneSelectedButton.delete(scene);
        }
    };
    container.setScale = (newScale) => {
        container.scale = newScale;
    };

    return container;
}
