package com.hospiwaste.app;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.hospiwaste.app.diag.DiagPlugin;
import com.hospiwaste.app.sync.SyncPlugin;
import java.io.File;
import java.io.FileWriter;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SyncPlugin.class);
        registerPlugin(DiagPlugin.class);
        super.onCreate(savedInstanceState);

        // Si el renderer del WebView muere (p. ej. sin memoria al procesar una
        // foto), Capacitor no lo maneja y Android cierra la app entera: el
        // operador la ve "cerrarse sola". Acá se registra en last_crash.txt
        // (visible en /diagnostico) y se recrea la actividad; la app arranca en
        // "/" y AppLifecycle la devuelve a Pesaje con el borrador (2026-09-26).
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                recordRendererGone(detail);
                recreate();
                return true;
            }
        });
    }

    private void recordRendererGone(RenderProcessGoneDetail detail) {
        try {
            String info = "RENDERER_GONE";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null) {
                info += " didCrash=" + detail.didCrash()
                    + " priorityAtExit=" + detail.rendererPriorityAtExit();
            }
            try (FileWriter w = new FileWriter(new File(getFilesDir(), HospiwasteApp.CRASH_FILE))) {
                w.write(info + " (la app se recuperó sola)");
            }
            Log.e(HospiwasteApp.TAG, info);
        } catch (Throwable ignored) {
            // Registrar es secundario: lo importante es recuperar la app.
        }
    }
}
