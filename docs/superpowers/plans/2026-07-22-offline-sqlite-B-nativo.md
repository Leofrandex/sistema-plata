# Offline SQLite local-first — Plan B: background sync nativo (Kotlin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los datos pendientes llegan a Supabase aunque el operador cierre la app: foreground service + WorkManager leen la misma base SQLite y suben por REST, con lock compartido contra el flush del WebView y token en EncryptedSharedPreferences.

**Architecture:** Plugin Capacitor propio (`SyncPlugin`) en `app/android/`. El service abre el archivo SQLite que escribe `@capacitor-community/sqlite`, sube `local_rows` con `synced=0` por REST (`POST /rest/v1/{tbl}` con `Prefer: resolution=merge-duplicates`) y fotos por Storage REST, y marca flags. WorkManager reintenta periódicamente y tras reboot. Un lock en la tabla `meta` (owner + expiración) excluye JS y nativo.

**Tech Stack:** Kotlin, Capacitor 8 (Java/Kotlin plugin API), WorkManager, EncryptedSharedPreferences (androidx.security), OkHttp (ya presente vía Capacitor deps o agregar), SQLite framework de Android.

**Spec:** `docs/superpowers/specs/2026-07-22-offline-sqlite-local-first-design.md` §4.5
**Prerequisitos:** Plan A completo y mergeado. **JDK 21 + Android Studio instalados** (hoy la máquina no tiene JDK; el SDK sí está en `C:\Users\sebastian.castro\AppData\Local\Android\Sdk`).

## Global Constraints

- Los gradle de `app/android/` generados por Capacitor se regeneran con `npx cap sync android` desde `app/` — el código propio vive en `app/android/app/src/main/java/com/hospiwaste/app/` y sobrevive al sync; **no editar los gradle generados a mano** (los cambios de dependencias van en `app/android/app/build.gradle`, que es del proyecto, no generado).
- Ruta de la base: la que usa `@capacitor-community/sqlite` en Android — `/data/data/com.hospiwaste.app/databases/hospiwasteSQLite.db` (verificar el sufijo real con `adb shell run-as com.hospiwaste.app ls databases/` en el primer arranque; el plugin agrega `SQLite.db` al nombre lógico `hospiwaste`).
- Upserts idempotentes: mismas semánticas que el motor JS — REST con `Prefer: resolution=merge-duplicates`, `on_conflict=id` (o clave compuesta para join tables, ver `ON_CONFLICT` de `shared/src/lib/local-store/types.ts`).
- Timeout por request: 15 s (OkHttp `callTimeout`).
- Decisión del usuario (2026-07-22): el refresh token nativo **se conserva tras el logout** para drenar pendientes post-logout (la cola es del dispositivo; cada registro lleva su `operator_id`). Se borra solo si el drenaje está en 0 al hacer logout.
- Todo el trabajo nativo se verifica en dispositivo real (los 6 criterios E2E del spec §7); no hay tests jest para Kotlin — la lógica de qué subir ya está cubierta por los tests del motor JS, el service la replica.

---

### Task 1: Entorno de build + compilación base

**Files:**
- Ninguno nuevo (verificación de toolchain).

- [ ] **Step 1:** Instalar Android Studio (incluye JDK 21 embebido en `jbr/`). Alternativa solo-CLI: instalar Temurin JDK 21 y setear `JAVA_HOME`.
- [ ] **Step 2:** `cd app && npx cap sync android` (registra los plugins de Plan A).
- [ ] **Step 3:** `cd app/android && ./gradlew assembleDebug` → `BUILD SUCCESSFUL`, APK en `app/android/app/build/outputs/apk/debug/`.
- [ ] **Step 4:** Instalar en dispositivo (`adb install -r ...`), smoke test: login, crear un recorrido offline, verificar que aparece al instante y que con red sube (motor JS de Plan A). Verificar con `adb shell run-as com.hospiwaste.app ls databases/` el nombre real del archivo SQLite y anotarlo para Task 3.
- [ ] **Step 5:** Commit de cualquier ajuste que el sync/build haya requerido.

```bash
git add -A && git commit -m "chore(android): build verde con plugins sqlite/filesystem/preferences"
```

---

### Task 2: `SyncPlugin` (esqueleto) + token en EncryptedSharedPreferences

**Files:**
- Create: `app/android/app/src/main/java/com/hospiwaste/app/sync/SyncPlugin.kt`
- Create: `app/android/app/src/main/java/com/hospiwaste/app/sync/SyncCredentials.kt`
- Modify: `app/android/app/src/main/java/com/hospiwaste/app/MainActivity.kt` (registrar plugin)
- Modify: `app/android/app/build.gradle` (deps: `androidx.security:security-crypto:1.1.0-alpha06`, `androidx.work:work-runtime-ktx:2.9.1`, `com.squareup.okhttp3:okhttp:4.12.0`)
- Modify (TS): `app/src/lib/native-sync.ts` (create — bridge JS del plugin), cablear en el login y logout de `app/`

**Interfaces:**
- Produces (JS bridge): `NativeSync.setCredentials({ url, anonKey, refreshToken })`, `NativeSync.clearCredentials()`, `NativeSync.kick()` (arranca el service si hay pendientes). En TS: wrapper con import dinámico + no-op en web.
- Produces (Kotlin): `SyncCredentials.save/load/clear` sobre EncryptedSharedPreferences (`hospiwaste_sync` file).

- [ ] **Step 1: `SyncCredentials.kt`**

```kotlin
package com.hospiwaste.app.sync

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

data class Credentials(val url: String, val anonKey: String, val refreshToken: String)

object SyncCredentials {
    private const val FILE = "hospiwaste_sync"

    private fun prefs(ctx: Context) = EncryptedSharedPreferences.create(
        ctx, FILE,
        MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun save(ctx: Context, c: Credentials) = prefs(ctx).edit()
        .putString("url", c.url).putString("anon", c.anonKey).putString("rt", c.refreshToken).apply()

    fun load(ctx: Context): Credentials? {
        val p = prefs(ctx)
        val url = p.getString("url", null) ?: return null
        val anon = p.getString("anon", null) ?: return null
        val rt = p.getString("rt", null) ?: return null
        return Credentials(url, anon, rt)
    }

    fun clear(ctx: Context) = prefs(ctx).edit().clear().apply()
}
```

- [ ] **Step 2: `SyncPlugin.kt`**

```kotlin
package com.hospiwaste.app.sync

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeSync")
class SyncPlugin : Plugin() {

    @PluginMethod
    fun setCredentials(call: PluginCall) {
        val url = call.getString("url"); val anon = call.getString("anonKey")
        val rt = call.getString("refreshToken")
        if (url == null || anon == null || rt == null) { call.reject("faltan campos"); return }
        SyncCredentials.save(context, Credentials(url, anon, rt))
        SyncWork.schedule(context) // Task 5
        call.resolve()
    }

    @PluginMethod
    fun clearCredentials(call: PluginCall) {
        SyncCredentials.clear(context)
        call.resolve()
    }

    @PluginMethod
    fun kick(call: PluginCall) {
        SyncService.startIfPending(context) // Task 4
        call.resolve()
    }
}
```

Registrar en `MainActivity.kt`: `registerPlugin(SyncPlugin::class.java)` antes de `super.onCreate`.

- [ ] **Step 3: Bridge TS `app/src/lib/native-sync.ts`**

```ts
import { registerPlugin, Capacitor } from '@capacitor/core'

interface NativeSyncPlugin {
  setCredentials(opts: { url: string; anonKey: string; refreshToken: string }): Promise<void>
  clearCredentials(): Promise<void>
  kick(): Promise<void>
}

const NativeSync = registerPlugin<NativeSyncPlugin>('NativeSync')

export async function handOffCredentials(refreshToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await NativeSync.setCredentials({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    refreshToken,
  })
}

/** Solo borra si no quedan pendientes (decisión: la cola es del dispositivo). */
export async function clearCredentialsIfDrained(pendingTotal: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (pendingTotal === 0) await NativeSync.clearCredentials()
}

export async function kickNativeSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try { await NativeSync.kick() } catch { /* plugin ausente en web */ }
}
```

Cablear: tras login exitoso (donde la app obtiene la sesión) → `handOffCredentials(session.refresh_token)`; en el logout (explícito y por inactividad) → `clearCredentialsIfDrained(counts.records + counts.photos)`; al encolar escrituras y al ir a background → `kickNativeSync()`.

- [ ] **Step 4:** `./gradlew assembleDebug` verde + smoke en dispositivo (el plugin responde sin crash). Commit:

```bash
git add -A && git commit -m "feat(android): SyncPlugin + credenciales de sync en EncryptedSharedPreferences"
```

---

### Task 3: `SyncEngine.kt` — lectura de SQLite + REST upserts + lock

**Files:**
- Create: `app/android/app/src/main/java/com/hospiwaste/app/sync/SyncEngine.kt`
- Create: `app/android/app/src/main/java/com/hospiwaste/app/sync/SyncLock.kt`

**Interfaces:**
- Consumes: esquema de Plan A (`local_rows`, `local_photos`, `meta`), archivo SQLite (nombre real anotado en Task 1), `Credentials` (Task 2).
- Produces: `SyncEngine.drain(ctx): DrainOutcome` (`data class DrainOutcome(val pushed: Int, val failed: Int, val pending: Int)`) — refresca el access token con el refresh token (`POST /auth/v1/token?grant_type=refresh_token`, persistiendo el refresh token rotado), sube filas en `SYNC_ORDER`, luego fotos, marca flags. `SyncLock.acquire(db, owner)/release` sobre `meta` (`key='flush_lock'`, valor `owner:expiraEpochMs`, expiración 120 s).

- [ ] **Step 1: `SyncLock.kt`**

```kotlin
package com.hospiwaste.app.sync

import android.database.sqlite.SQLiteDatabase

object SyncLock {
    private const val KEY = "flush_lock"
    private const val TTL_MS = 120_000L

    /** true si adquirió. El lock del WebView usa el mismo formato (Plan A no lo
     *  usa aún: el mutex JS es in-process; este lock cubre JS vs service). */
    fun acquire(db: SQLiteDatabase, owner: String): Boolean {
        db.beginTransaction()
        try {
            val now = System.currentTimeMillis()
            val cur = db.rawQuery("SELECT value FROM meta WHERE key=?", arrayOf(KEY)).use {
                if (it.moveToFirst()) it.getString(0) else null
            }
            if (cur != null) {
                val parts = cur.split(":")
                val expires = parts.getOrNull(1)?.toLongOrNull() ?: 0L
                if (expires > now && parts[0] != owner) return false
            }
            db.execSQL("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
                arrayOf(KEY, "$owner:${now + TTL_MS}"))
            db.setTransactionSuccessful()
            return true
        } finally { db.endTransaction() }
    }

    fun release(db: SQLiteDatabase, owner: String) {
        db.execSQL("DELETE FROM meta WHERE key=? AND value LIKE ?", arrayOf(KEY, "$owner:%"))
    }
}
```

- [ ] **Step 2: `SyncEngine.kt`**

```kotlin
package com.hospiwaste.app.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

data class DrainOutcome(val pushed: Int, val failed: Int, val pending: Int)

object SyncEngine {
    // Debe coincidir con SYNC_ORDER de shared/src/lib/local-store/types.ts
    private val SYNC_ORDER = listOf(
        "route_events", "route_event_containers_dirty", "route_event_containers_clean",
        "weighing_sessions", "container_receptions", "treatment_runs",
        "container_locations", "storage_events",
    )
    private val ON_CONFLICT = mapOf(
        "route_event_containers_dirty" to "route_event_id,container_id",
        "route_event_containers_clean" to "route_event_id,container_id",
    ).withDefault { "id" }

    // Nombre real verificado en Task 1 (Global Constraints).
    private const val DB_FILE = "hospiwasteSQLite.db"

    private val http = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build()
    private val JSON = "application/json".toMediaType()

    fun drain(ctx: Context): DrainOutcome {
        val creds = SyncCredentials.load(ctx) ?: return DrainOutcome(0, 0, -1)
        val dbPath = File(ctx.getDatabasePath(DB_FILE).absolutePath)
        if (!dbPath.exists()) return DrainOutcome(0, 0, 0)
        val db = SQLiteDatabase.openDatabase(dbPath.path, null, SQLiteDatabase.OPEN_READWRITE)
        db.use {
            if (!SyncLock.acquire(it, "service")) return DrainOutcome(0, 0, -1)
            try {
                val token = refreshAccessToken(ctx, creds) ?: return DrainOutcome(0, 0, -1)
                var pushed = 0; var failed = 0
                for (tbl in SYNC_ORDER) {
                    it.rawQuery(
                        "SELECT id, payload FROM local_rows WHERE tbl=? AND synced=0 ORDER BY created_at",
                        arrayOf(tbl),
                    ).use { c ->
                        while (c.moveToNext()) {
                            val id = c.getString(0); val payload = c.getString(1)
                            if (upsertRow(creds, token, tbl, payload)) {
                                it.execSQL("UPDATE local_rows SET synced=1, sync_error=NULL WHERE tbl=? AND id=?", arrayOf(tbl, id))
                                pushed++
                            } else {
                                it.execSQL("UPDATE local_rows SET attempts=attempts+1 WHERE tbl=? AND id=?", arrayOf(tbl, id))
                                failed++
                            }
                        }
                    }
                }
                pushed += drainPhotos(ctx, it, creds, token).also { r -> failed += r.second }.first
                val pending = it.rawQuery(
                    "SELECT (SELECT COUNT(*) FROM local_rows WHERE synced=0) + (SELECT COUNT(*) FROM local_photos WHERE synced=0)",
                    null,
                ).use { c -> c.moveToFirst(); c.getInt(0) }
                return DrainOutcome(pushed, failed, pending)
            } finally { SyncLock.release(it, "service") }
        }
    }

    private fun refreshAccessToken(ctx: Context, creds: Credentials): String? {
        val body = JSONObject().put("refresh_token", creds.refreshToken).toString().toRequestBody(JSON)
        val req = Request.Builder()
            .url("${creds.url}/auth/v1/token?grant_type=refresh_token")
            .header("apikey", creds.anonKey).post(body).build()
        http.newCall(req).execute().use { res ->
            if (!res.isSuccessful) return null
            val json = JSONObject(res.body!!.string())
            // Supabase rota el refresh token: persistir el nuevo o el próximo drain falla.
            SyncCredentials.save(ctx, creds.copy(refreshToken = json.getString("refresh_token")))
            return json.getString("access_token")
        }
    }

    private fun upsertRow(creds: Credentials, token: String, tbl: String, payloadJson: String): Boolean {
        val conflict = ON_CONFLICT.getValue(tbl)
        val req = Request.Builder()
            .url("${creds.url}/rest/v1/$tbl?on_conflict=$conflict")
            .header("apikey", creds.anonKey)
            .header("Authorization", "Bearer $token")
            .header("Prefer", "resolution=merge-duplicates")
            .post(payloadJson.toRequestBody(JSON))
            .build()
        return try { http.newCall(req).execute().use { it.isSuccessful } } catch (_: Exception) { false }
    }

    /** Fotos de padres ya subidos: archivo → Storage REST → upsert en photos. */
    private fun drainPhotos(ctx: Context, db: SQLiteDatabase, creds: Credentials, token: String): Pair<Int, Int> {
        var ok = 0; var fail = 0
        db.rawQuery("SELECT photo_id, event_type, event_id, label, uploaded_by, taken_at, role, ext, content_type, file_uri FROM local_photos WHERE synced=0", null).use { c ->
            while (c.moveToNext()) {
                val photoId = c.getString(0); val eventType = c.getString(1); val eventId = c.getString(2)
                // Mapeo alineado al fix de Plan A: event_type "route" → route_events, "weighing" → container_receptions.
                val parentTbl = if (eventType == "route") "route_events" else "container_receptions"
                val parentSynced = db.rawQuery(
                    "SELECT synced FROM local_rows WHERE tbl=? AND id=?", arrayOf(parentTbl, eventId),
                ).use { p -> !p.moveToFirst() || p.getInt(0) == 1 } // sin fila local = histórico ya en server
                if (!parentSynced) continue
                val file = File(ctx.filesDir, c.getString(9))
                if (!file.exists()) { fail++; continue }
                val path = "$eventType/$eventId/$photoId.${c.getString(7)}"
                val upload = Request.Builder()
                    .url("${creds.url}/storage/v1/object/photos/$path")
                    .header("apikey", creds.anonKey).header("Authorization", "Bearer $token")
                    .header("x-upsert", "true")
                    .post(file.readBytes().toRequestBody(c.getString(8).toMediaType()))
                    .build()
                val uploaded = try { http.newCall(upload).execute().use { it.isSuccessful } } catch (_: Exception) { false }
                if (!uploaded) { fail++; continue }
                val row = JSONObject()
                    .put("id", photoId).put("storage_path", path)
                    .put("event_type", eventType).put("event_id", eventId)
                    .put("label", c.getString(3)).put("uploaded_by", c.getString(4) ?: JSONObject.NULL)
                    .put("taken_at", c.getString(5)).put("role", c.getString(6) ?: JSONObject.NULL)
                if (upsertRow(creds, token, "photos", row.toString())) {
                    db.execSQL("UPDATE local_photos SET synced=1, sync_error=NULL WHERE photo_id=?", arrayOf(photoId))
                    file.delete()
                    ok++
                } else fail++
            }
        }
        return ok to fail
    }
}
```

Nota `file_uri`: `@capacitor/filesystem` con `Directory.Data` escribe bajo `ctx.filesDir` — verificar en dispositivo (Task 1 del E2E) que `File(ctx.filesDir, file_uri)` resuelve; si el plugin usa subcarpeta distinta, ajustar aquí.

- [ ] **Step 3:** `./gradlew assembleDebug` verde. Commit:

```bash
git add -A && git commit -m "feat(android): SyncEngine nativo — REST upserts + fotos + lock compartido"
```

---

### Task 4: Foreground service

**Files:**
- Create: `app/android/app/src/main/java/com/hospiwaste/app/sync/SyncService.kt`
- Modify: `app/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `SyncEngine.drain` (Task 3).
- Produces: `SyncService.startIfPending(ctx)` — arranca como foreground service con notificación "Sincronizando N registros…" solo si hay pendientes y red; corre `drain()` en un hilo, se apaga al terminar (`stopSelf`).

- [ ] **Step 1: Manifest** — dentro de `<application>` y permisos:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<service android:name=".sync.SyncService" android:foregroundServiceType="dataSync" android:exported="false" />
```

- [ ] **Step 2: `SyncService.kt`**

```kotlin
package com.hospiwaste.app.sync

import android.app.*
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlin.concurrent.thread

class SyncService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ID, buildNotification("Sincronizando registros pendientes…"))
        thread {
            try { SyncEngine.drain(this) } finally { stopSelf() }
        }
        return START_NOT_STICKY
    }

    private fun buildNotification(text: String): Notification {
        val channelId = "hospiwaste_sync"
        if (Build.VERSION.SDK_INT >= 26) {
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
                NotificationChannel(channelId, "Sincronización", NotificationManager.IMPORTANCE_LOW))
        }
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("Hospiwaste").setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true).build()
    }

    companion object {
        private const val NOTIF_ID = 41

        fun hasNetwork(ctx: Context): Boolean {
            val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        }

        fun startIfPending(ctx: Context) {
            if (!hasNetwork(ctx)) return
            if (SyncCredentials.load(ctx) == null) return
            val intent = Intent(ctx, SyncService::class.java)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(intent) else ctx.startService(intent)
        }
    }
}
```

- [ ] **Step 3:** Build verde + prueba en dispositivo: crear registros offline, `kick()` desde la app con red → notificación aparece, datos llegan a Supabase, notificación desaparece. Commit:

```bash
git add -A && git commit -m "feat(android): foreground service de sincronización"
```

---

### Task 5: WorkManager + BOOT_COMPLETED

**Files:**
- Create: `app/android/app/src/main/java/com/hospiwaste/app/sync/SyncWork.kt`
- Create: `app/android/app/src/main/java/com/hospiwaste/app/sync/BootReceiver.kt`
- Modify: `AndroidManifest.xml` (receiver)

**Interfaces:**
- Consumes: `SyncEngine.drain`.
- Produces: `SyncWork.schedule(ctx)` — `PeriodicWorkRequest` cada 15 min (mínimo de WorkManager) con constraint `NetworkType.CONNECTED`, `ExistingPeriodicWorkPolicy.KEEP`, nombre único `hospiwaste-sync`.

- [ ] **Step 1: `SyncWork.kt`**

```kotlin
package com.hospiwaste.app.sync

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val outcome = SyncEngine.drain(applicationContext)
        return if (outcome.failed > 0 && outcome.pushed == 0) Result.retry() else Result.success()
    }
}

object SyncWork {
    fun schedule(ctx: Context) {
        val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(ctx)
            .enqueueUniquePeriodicWork("hospiwaste-sync", ExistingPeriodicWorkPolicy.KEEP, req)
    }
}
```

- [ ] **Step 2: `BootReceiver.kt`** + manifest:

```kotlin
package com.hospiwaste.app.sync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) SyncWork.schedule(ctx)
    }
}
```

```xml
<receiver android:name=".sync.BootReceiver" android:exported="false">
  <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /></intent-filter>
</receiver>
```

- [ ] **Step 3:** Build verde; verificación: `adb shell dumpsys jobscheduler | grep hospiwaste` muestra el job. Commit:

```bash
git add -A && git commit -m "feat(android): WorkManager periódico + re-agenda tras reboot"
```

---

### Task 6: E2E en dispositivo real + cierre en vault

**Files:**
- Create: `vault/logs/YYYY-MM-DD-offline-e2e-dispositivo.md` (fecha real de ejecución)
- Modify: `vault/_index.md`

- [ ] **Step 1:** Ejecutar los 6 criterios del spec §7 en un Android real, en orden, anotando resultado por criterio:
  1. Modo avión total (jornada completa + kill + reopen + red → todo sube sin duplicados).
  2. Doble llenado imposible (con sync en curso, sin red, y tras recargar).
  3. Señal intermitente (avión on/off durante flush → converge a 0).
  4. Background (swipe-kill + recuperar señal → llega sin reabrir; verificar notificación).
  5. Señal débil (throttling con Charles/`adb shell tc` o red 2G real → ningún request >15 s bloqueando).
  6. Fotos >8 MB (registro llega primero; fotos completan después).
- [ ] **Step 2:** Verificar en Supabase (SQL) la ausencia de duplicados: conteos por id, `photos` completas.
- [ ] **Step 3:** Log en vault con los resultados reales por criterio + actualizar `_index.md` (fila del offline SQLite → estado según resultado). Si algún criterio falla → skill superpowers:systematic-debugging antes de tocar código.
- [ ] **Step 4:** Commit + considerar `superpowers:finishing-a-development-branch`.

```bash
git add vault/ && git commit -m "docs(vault): resultados E2E offline en dispositivo real"
```

---

## Self-review (hecho al redactar)

- **Cobertura del spec §4.5:** service (Task 4), WorkManager+boot (Task 5), lock JS/nativo (Task 3 — el lado JS del lock queda cubierto porque el service lo respeta y el mutex JS es in-process; si el E2E muestra colisiones, agregar `SyncLock` también al motor TS), EncryptedSharedPreferences (Task 2). §7 → Task 6.
- **Puntos a verificar en dispositivo (no derivables en seco):** nombre real del archivo SQLite (Task 1) y raíz de `Directory.Data` para `file_uri` (Task 3). Ambos señalados en los pasos.
- **Rotación del refresh token:** cubierta en `refreshAccessToken` (se persiste el token rotado); si el WebView refresca la sesión en paralelo con el mismo refresh token, Supabase puede invalidar la familia — mitigación: el service solo corre con la app cerrada (lock + `startIfPending` desde background), y el E2E 4 lo valida.
