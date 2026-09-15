package com.hospiwaste.app.diag

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
}
