package com.hospiwaste.app

import android.app.Application
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Application con captura del último crash nativo.
 *
 * Un `RuntimeException` sin capturar (por ejemplo, el que Capacitor relanza
 * cuando un método de plugin lanza — `Bridge.callPluginMethod`) mata el
 * proceso sin dejar rastro accesible desde el teléfono: el build release no
 * manda nada a logcat legible y en planta no hay cable. Acá se guarda el stack
 * en `filesDir/last_crash.txt` ANTES de dejar que Android mate el proceso, y
 * el plugin `Diag` lo expone a la pantalla /diagnostico de la app.
 */
class HospiwasteApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, err ->
            try {
                val sw = StringWriter()
                err.printStackTrace(PrintWriter(sw))
                val text = "thread=${thread.name}\n$sw"
                File(filesDir, CRASH_FILE).writeText(text.take(MAX_LEN))
                Log.e(TAG, "crash capturado", err)
            } catch (_: Throwable) {
                // No agregar un segundo fallo encima del primero.
            }
            previous?.uncaughtException(thread, err)
        }
    }

    companion object {
        const val TAG = "HospiwasteApp"
        const val CRASH_FILE = "last_crash.txt"
        private const val MAX_LEN = 16_000
    }
}
