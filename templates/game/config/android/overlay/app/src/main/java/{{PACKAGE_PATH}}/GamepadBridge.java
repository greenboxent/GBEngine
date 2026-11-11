package {{PACKAGE}};

import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;

// Google Play Games on PC delivers a connected controller to Android as normal
// gamepad key/motion events, but the WebView's Gamepad API never lists it. This
// turns those events into a W3C "standard"-mapped gamepad state and pushes it
// to the page, where GBEngine's src/systems/platform.js presents it through
// navigator.getGamepads(). Only used when running on Play Games on PC.
class GamepadBridge {
    private static final int BUTTONS = 17;

    private final WebView webView;
    private final float[] keyButtons  = new float[BUTTONS]; // from KeyEvents
    private final float[] axisButtons = new float[BUTTONS]; // from triggers / hat axes
    private final float[] axes = new float[4];
    private String lastSent = "";

    GamepadBridge(WebView webView) {
        this.webView = webView;
    }

    private static boolean isGamepadSource(int source) {
        return (source & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            || (source & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    }

    // Standard gamepad button index for an Android key code, or -1.
    private static int buttonIndex(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_BUTTON_A:      return 0;
            case KeyEvent.KEYCODE_BUTTON_B:      return 1;
            case KeyEvent.KEYCODE_BUTTON_X:      return 2;
            case KeyEvent.KEYCODE_BUTTON_Y:      return 3;
            case KeyEvent.KEYCODE_BUTTON_L1:     return 4;
            case KeyEvent.KEYCODE_BUTTON_R1:     return 5;
            case KeyEvent.KEYCODE_BUTTON_L2:     return 6;
            case KeyEvent.KEYCODE_BUTTON_R2:     return 7;
            case KeyEvent.KEYCODE_BUTTON_SELECT: return 8;
            case KeyEvent.KEYCODE_BUTTON_START:  return 9;
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return 10;
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return 11;
            case KeyEvent.KEYCODE_DPAD_UP:       return 12;
            case KeyEvent.KEYCODE_DPAD_DOWN:     return 13;
            case KeyEvent.KEYCODE_DPAD_LEFT:     return 14;
            case KeyEvent.KEYCODE_DPAD_RIGHT:    return 15;
            case KeyEvent.KEYCODE_BUTTON_MODE:   return 16;
            default:                             return -1;
        }
    }

    /** Returns true if the event was a controller button and has been consumed. */
    boolean onKey(KeyEvent e) {
        int idx = buttonIndex(e.getKeyCode());
        if (!isGamepadSource(e.getSource()) || idx < 0) return false; // keyboard arrows etc. fall through untouched
        int action = e.getAction();
        if (action != KeyEvent.ACTION_DOWN && action != KeyEvent.ACTION_UP) return true;
        keyButtons[idx] = action == KeyEvent.ACTION_DOWN ? 1f : 0f;
        push();
        return true;
    }

    /** Returns true if the event was controller axis motion and has been consumed. */
    boolean onMotion(MotionEvent e) {
        if (!isGamepadSource(e.getSource()) || e.getAction() != MotionEvent.ACTION_MOVE) return false;
        axes[0] = e.getAxisValue(MotionEvent.AXIS_X);
        axes[1] = e.getAxisValue(MotionEvent.AXIS_Y);
        axes[2] = e.getAxisValue(MotionEvent.AXIS_Z);
        axes[3] = e.getAxisValue(MotionEvent.AXIS_RZ);
        axisButtons[6] = Math.max(e.getAxisValue(MotionEvent.AXIS_LTRIGGER), e.getAxisValue(MotionEvent.AXIS_BRAKE));
        axisButtons[7] = Math.max(e.getAxisValue(MotionEvent.AXIS_RTRIGGER), e.getAxisValue(MotionEvent.AXIS_GAS));
        float hx = e.getAxisValue(MotionEvent.AXIS_HAT_X);
        float hy = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
        axisButtons[12] = hy < -0.5f ? 1f : 0f;
        axisButtons[13] = hy >  0.5f ? 1f : 0f;
        axisButtons[14] = hx < -0.5f ? 1f : 0f;
        axisButtons[15] = hx >  0.5f ? 1f : 0f;
        push();
        return true;
    }

    private void push() {
        StringBuilder sb = new StringBuilder("{\"b\":[");
        for (int i = 0; i < BUTTONS; i++) {
            if (i > 0) sb.append(',');
            sb.append(String.format(java.util.Locale.US, "%.2f", Math.max(keyButtons[i], axisButtons[i])));
        }
        sb.append("],\"a\":[");
        for (int i = 0; i < axes.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(String.format(java.util.Locale.US, "%.2f", axes[i]));
        }
        sb.append("]}");
        final String json = sb.toString();
        if (json.equals(lastSent)) return;
        lastSent = json;
        webView.post(() -> webView.evaluateJavascript("window.__nativePad&&window.__nativePad(" + json + ")", null));
    }
}
