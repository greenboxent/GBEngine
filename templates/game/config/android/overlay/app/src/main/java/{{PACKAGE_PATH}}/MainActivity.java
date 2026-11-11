package {{PACKAGE}};

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PLAY_GAMES_PC_FEATURE = "com.google.android.play.feature.HPE_EXPERIENCE";

    // Non-null only on Google Play Games on PC; see GamepadBridge.
    private GamepadBridge gamepadBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlatformInfoPlugin.class); // must precede super.onCreate, which builds the bridge
        super.onCreate(savedInstanceState);
        if (getPackageManager().hasSystemFeature(PLAY_GAMES_PC_FEATURE)) {
            gamepadBridge = new GamepadBridge(getBridge().getWebView());
        }
        setImmersiveMode();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (gamepadBridge != null && gamepadBridge.onKey(event)) return true;
        return super.dispatchKeyEvent(event);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        if (gamepadBridge != null && gamepadBridge.onMotion(event)) return true;
        return super.dispatchGenericMotionEvent(event);
    }

    // System UI (status bar / nav bar) can reappear on focus changes (returning from
    // background, a transient swipe-in) — reapply immersive mode each time focus is regained.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setImmersiveMode();
        }
    }

    private void setImmersiveMode() {
        View decorView = getWindow().getDecorView();

        // Legacy flags — a safety net on very old API levels, ignored once edge-to-edge
        // is enforced (API 35+).
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        // Modern API — the actual fix. Edge-to-edge means the app can't opt out of drawing
        // behind the bars, but it can ask the system to hide them.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), decorView);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
