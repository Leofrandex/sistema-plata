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

/**
 * Motor de sync nativo. Espejo de `shared/src/lib/local-store/sync-engine.ts` (`flush`):
 * misma semántica de orden, bloqueo padre/hijo, anti-clobber por `rev` y gating de fotos.
 */
object SyncEngine {
    // Debe coincidir con SYNC_ORDER de shared/src/lib/local-store/types.ts
    private val SYNC_ORDER = listOf(
        "route_events", "route_event_containers_dirty", "route_event_containers_clean",
        "weighing_sessions", "container_receptions", "treatment_runs",
        "container_locations", "storage_events",
    )

    // Debe coincidir con ON_CONFLICT de shared/src/lib/local-store/types.ts
    private val ON_CONFLICT = mapOf(
        "route_events" to "id",
        "route_event_containers_dirty" to "route_event_id,container_id",
        "route_event_containers_clean" to "route_event_id,container_id",
        "weighing_sessions" to "id",
        "container_receptions" to "id",
        "treatment_runs" to "id",
        "container_locations" to "id",
        "storage_events" to "id",
    ).withDefault { "id" }

    // Debe coincidir con PARENT_OF de shared/src/lib/local-store/types.ts
    private val PARENT_OF = mapOf(
        "route_event_containers_dirty" to "route_events",
        "route_event_containers_clean" to "route_events",
        "container_receptions" to "weighing_sessions",
    )

    // Nombre real verificado en Task 1 (Global Constraints).
    private const val DB_FILE = "hospiwasteSQLite.db"
    private const val MAX_ERROR_LEN = 500

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
                var pushed = 0
                var failed = 0
                // `tbl:id` de filas que fallaron en esta pasada — bloquea a sus hijas (espejo de failedParents en flush()).
                val failedNow = mutableSetOf<String>()

                for (tbl in SYNC_ORDER) {
                    it.rawQuery(
                        "SELECT id, payload, rev FROM local_rows WHERE tbl=? AND synced=0 ORDER BY created_at",
                        arrayOf(tbl),
                    ).use { c ->
                        while (c.moveToNext()) {
                            val id = c.getString(0)
                            val payload = c.getString(1)
                            val rev = c.getInt(2)

                            if (parentBlocked(it, tbl, payload, failedNow)) continue

                            if (upsertRow(creds, token, tbl, payload)) {
                                it.execSQL(
                                    "UPDATE local_rows SET synced=1, sync_error=NULL WHERE tbl=? AND id=? AND rev=?",
                                    arrayOf(tbl, id, rev),
                                )
                                pushed++
                            } else {
                                it.execSQL(
                                    "UPDATE local_rows SET attempts=attempts+1, synced=0, sync_error=? WHERE tbl=? AND id=?",
                                    arrayOf(truncate("upsert falló: $tbl"), tbl, id),
                                )
                                failedNow.add("$tbl:$id")
                                failed++
                            }
                        }
                    }
                }

                val photoResult = drainPhotos(ctx, it, creds, token)
                pushed += photoResult.first
                failed += photoResult.second

                val pending = it.rawQuery(
                    "SELECT (SELECT COUNT(*) FROM local_rows WHERE synced=0) + (SELECT COUNT(*) FROM local_photos WHERE synced=0)",
                    null,
                ).use { c -> c.moveToFirst(); c.getInt(0) }
                return DrainOutcome(pushed, failed, pending)
            } finally {
                SyncLock.release(it, "service")
            }
        }
    }

    /** Espejo de parentBlocked() en sync-engine.ts. */
    private fun parentBlocked(
        db: SQLiteDatabase,
        tbl: String,
        payloadJson: String,
        failedNow: Set<String>,
    ): Boolean {
        val parent = PARENT_OF[tbl] ?: return false
        val fk = if (tbl == "container_receptions") "weighing_session_id" else "route_event_id"
        val parentId = try { JSONObject(payloadJson).optString(fk, "") } catch (_: Exception) { "" }
        if ("$parent:$parentId" in failedNow) return true
        // Sin fila padre local (histórico ya en server) no bloquea.
        return db.rawQuery(
            "SELECT synced FROM local_rows WHERE tbl=? AND id=?",
            arrayOf(parent, parentId),
        ).use { c -> if (c.moveToFirst()) c.getInt(0) != 1 else false }
    }

    private fun refreshAccessToken(ctx: Context, creds: Credentials): String? {
        val body = JSONObject().put("refresh_token", creds.refreshToken).toString().toRequestBody(JSON)
        val req = Request.Builder()
            .url("${creds.url}/auth/v1/token?grant_type=refresh_token")
            .header("apikey", creds.anonKey).post(body).build()
        return try {
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return null
                val json = JSONObject(res.body!!.string())
                // Supabase rota el refresh token: persistir el nuevo o el próximo drain falla.
                SyncCredentials.save(ctx, creds.copy(refreshToken = json.getString("refresh_token")))
                json.getString("access_token")
            }
        } catch (_: Exception) {
            null
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

    /** Tabla padre lógica de cada tipo de foto. `null` = sin gate: no bloquea nunca. */
    private fun photoParentTable(eventType: String): String? = when (eventType) {
        "route" -> "route_events"
        "weighing" -> "container_receptions"
        else -> null
    }

    /** Espejo de photoParentBlocked() en sync-engine.ts: bloqueada solo si hay fila padre local Y no está synced. */
    private fun photoBlocked(db: SQLiteDatabase, eventType: String, eventId: String): Boolean {
        val parentTbl = photoParentTable(eventType) ?: return false
        return db.rawQuery(
            "SELECT synced FROM local_rows WHERE tbl=? AND id=?",
            arrayOf(parentTbl, eventId),
        ).use { c -> if (c.moveToFirst()) c.getInt(0) != 1 else false }
    }

    /** Fotos de padres ya subidos: archivo -> Storage REST -> upsert en photos. */
    private fun drainPhotos(ctx: Context, db: SQLiteDatabase, creds: Credentials, token: String): Pair<Int, Int> {
        var ok = 0
        var fail = 0
        db.rawQuery(
            "SELECT photo_id, event_type, event_id, label, uploaded_by, taken_at, role, ext, content_type, file_uri FROM local_photos WHERE synced=0",
            null,
        ).use { c ->
            while (c.moveToNext()) {
                val photoId = c.getString(0)
                val eventType = c.getString(1)
                val eventId = c.getString(2)

                if (photoBlocked(db, eventType, eventId)) continue

                val fileUri = c.getString(9)
                val file = File(ctx.filesDir, fileUri)
                if (!file.exists()) {
                    markPhotoFailed(db, photoId, "binario ausente: $fileUri")
                    fail++
                    continue
                }
                val path = "$eventType/$eventId/$photoId.${c.getString(7)}"
                val upload = Request.Builder()
                    .url("${creds.url}/storage/v1/object/photos/$path")
                    .header("apikey", creds.anonKey).header("Authorization", "Bearer $token")
                    .header("x-upsert", "true")
                    .post(file.readBytes().toRequestBody(c.getString(8).toMediaType()))
                    .build()
                val uploadOk = try { http.newCall(upload).execute().use { it.isSuccessful } } catch (_: Exception) { false }
                if (!uploadOk) {
                    markPhotoFailed(db, photoId, "storage upload falló: $path")
                    fail++
                    continue
                }
                val row = JSONObject()
                    .put("id", photoId).put("storage_path", path)
                    .put("event_type", eventType).put("event_id", eventId)
                    .put("label", c.getString(3)).put("uploaded_by", c.getString(4) ?: JSONObject.NULL)
                    .put("taken_at", c.getString(5)).put("role", c.getString(6) ?: JSONObject.NULL)
                if (upsertRow(creds, token, "photos", row.toString())) {
                    db.execSQL("UPDATE local_photos SET synced=1, sync_error=NULL WHERE photo_id=?", arrayOf(photoId))
                    file.delete()
                    ok++
                } else {
                    markPhotoFailed(db, photoId, "photos upsert falló")
                    fail++
                }
            }
        }
        return ok to fail
    }

    private fun markPhotoFailed(db: SQLiteDatabase, photoId: String, error: String) {
        db.execSQL(
            "UPDATE local_photos SET attempts=attempts+1, synced=0, sync_error=? WHERE photo_id=?",
            arrayOf(truncate(error), photoId),
        )
    }

    private fun truncate(s: String): String = if (s.length > MAX_ERROR_LEN) s.substring(0, MAX_ERROR_LEN) else s
}
