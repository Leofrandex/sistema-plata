package com.hospiwaste.app.diag

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.hospiwaste.app.HospiwasteApp
import java.io.File

/**
 * Expone al WebView el último crash nativo guardado por [HospiwasteApp].
 *
 * Regla de la casa: **ningún método de plugin puede lanzar**. Capacitor 8
 * envuelve cualquier excepción de un `@PluginMethod` en `RuntimeException`
 * y la relanza en el hilo del bridge (`Bridge.callPluginMethod`), lo que
 * tumba el proceso entero. Todo va en try/catch → `call.reject`.
 */
@CapacitorPlugin(name = "Diag")
class DiagPlugin : Plugin() {

    @PluginMethod
    fun getLastCrash(call: PluginCall) {
        try {
            val f = File(context.filesDir, HospiwasteApp.CRASH_FILE)
            val ret = JSObject()
            if (f.exists()) {
                ret.put("crash", f.readText())
                ret.put("at", f.lastModified())
            } else {
                ret.put("crash", JSObject.NULL)
                ret.put("at", 0L)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("getLastCrash falló: ${e.message}")
        }
    }

    @PluginMethod
    fun clearLastCrash(call: PluginCall) {
        try {
            File(context.filesDir, HospiwasteApp.CRASH_FILE).delete()
            call.resolve()
        } catch (e: Exception) {
            call.reject("clearLastCrash falló: ${e.message}")
        }
    }

    /**
     * Por qué murieron los últimos procesos de la app, según Android (API 30+).
     * Distingue "Android la cerró por falta de memoria mientras la cámara estaba
     * abierta" (LOW_MEMORY) de un crash nuestro (CRASH / CRASH_NATIVE) o de un
     * cierre del usuario. En API < 30 devuelve la lista vacía.
     */
    @PluginMethod
    fun getExitReasons(call: PluginCall) {
        try {
            val list = JSArray()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                for (info in am.getHistoricalProcessExitReasons(context.packageName, 0, 5)) {
                    val o = JSObject()
                    o.put("at", info.timestamp)
                    o.put("reason", reasonName(info.reason))
                    o.put("importance", info.importance)
                    o.put("description", info.description ?: "")
                    list.put(o)
                }
            }
            val ret = JSObject()
            ret.put("exits", list)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("getExitReasons falló: ${e.message}")
        }
    }

    private fun reasonName(reason: Int): String = when (reason) {
        ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
        ApplicationExitInfo.REASON_CRASH -> "CRASH"
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE"
        ApplicationExitInfo.REASON_ANR -> "ANR"
        ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED"
        ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_REQUESTED"
        ApplicationExitInfo.REASON_USER_STOPPED -> "USER_STOPPED"
        ApplicationExitInfo.REASON_EXIT_SELF -> "EXIT_SELF"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
        ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
        ApplicationExitInfo.REASON_OTHER -> "OTHER"
        ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "PERMISSION_CHANGE"
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
        else -> "UNKNOWN($reason)"
    }
}
