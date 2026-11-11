/**
 * Detects Google Play Games on PC (the native `PlatformInfo` plugin reads the
 * HPE_EXPERIENCE system feature — see `templates/game/config/android/overlay`).
 * There the mouse is delivered as touch, so `navigator.maxTouchPoints > 0` and
 * the on-screen joysticks/buttons would show up on a keyboard-and-mouse
 * machine. When the host is a PC we report no touch support; GBEngine's
 * `TouchControls` and the settings scenes all key off that one value — read
 * touch support from `navigator.maxTouchPoints`, not Phaser's `device.input.touch`.
 *
 * Also installs the controller bridge: the WebView's Gamepad API never lists a
 * pad there, so `GamepadBridge.java` forwards Android controller state to
 * `window.__nativePad` and `navigator.getGamepads()` answers with it.
 * @module systems/platform
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

const PlatformInfo = registerPlugin('PlatformInfo');

/** True once `detectPlatform()` found Google Play Games on PC. */
export let isPlayGamesPC = false;

/**
 * Call once at boot (wrap in `guarded()`), before any scene reads
 * `navigator.maxTouchPoints`. No-op on the web and on builds without the
 * native plugin.
 * @returns {Promise<void>}
 */
export async function detectPlatform() {
    if (!Capacitor.isNativePlatform()) return;
    try {
        isPlayGamesPC = !!(await PlatformInfo.isPlayGamesPC()).value;
    } catch (e) {
        console.warn('[platform] PlatformInfo unavailable:', e); // older build without the plugin
        return;
    }
    if (isPlayGamesPC) {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });
        installNativeGamepad();
    }
}

// GamepadBridge.java forwards the Android controller state to window.__nativePad
// ({b: 17 button values, a: 4 axes}, W3C "standard" mapping) and we answer
// navigator.getGamepads() with it. Phaser's gamepad plugin and GBEngine's
// InputController both poll getGamepads(), so they work unchanged.
function installNativeGamepad() {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    let axes = [0, 0, 0, 0];
    let timestamp = 0;
    let connected = false;
    const realGetGamepads = navigator.getGamepads?.bind(navigator);

    const makePad = () => ({
        id: 'Xbox Controller (Play Games on PC)',
        index: 0,
        connected: true,
        mapping: 'standard',
        timestamp,
        axes: axes.slice(),
        buttons: buttons.map(b => ({ ...b })),
        vibrationActuator: null,
        hapticActuators: [],
    });

    navigator.getGamepads = () => {
        const real = realGetGamepads ? Array.from(realGetGamepads()) : [];
        if (real.some(Boolean)) return real; // the WebView found a pad itself
        return connected ? [makePad(), null, null, null] : [null, null, null, null];
    };

    window.__nativePad = ({ b, a }) => {
        b.forEach((v, i) => { buttons[i] = { pressed: v > (i === 6 || i === 7 ? 0.3 : 0.5), touched: v > 0, value: v }; });
        axes = a;
        timestamp = performance.now();
        if (!connected) {
            connected = true;
            const ev = new Event('gamepadconnected'); // GamepadEvent only accepts a real Gamepad
            ev.gamepad = makePad();
            window.dispatchEvent(ev);
        }
    };
}
