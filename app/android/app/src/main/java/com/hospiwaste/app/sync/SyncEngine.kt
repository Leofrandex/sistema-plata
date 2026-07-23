package com.hospiwaste.app.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.File
import java.io.IOException
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
    private const val ERROR_BODY_SNIPPET_LEN = 300

    private val http = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build()
    private val JSON = "application/json".toMediaType()

    /**
     * Falla de transporte (timeout/DNS/host inalcanzable). Espejo de `isNetworkError` en
     * sync-engine.ts: aborta toda la pasada en lugar de marcar rechazo (I1).
     */
    private class NetworkDown(cause: Throwable) : Exception(cause)

    fun drain(ctx: Context, owner: String = "native-" + java.util.UUID.randomUUID().toString().take(8)): DrainOutcome {
        val creds = SyncCredentials.load(ctx) ?: return DrainOutcome(0, 0, -1)
        val dbPath = File(ctx.getDatabasePath(DB_FILE).absolutePath)
        if (!dbPath.exists()) return DrainOutcome(0, 0, 0)
        // WAL evita el journal-mode flapping con la conexión SQLite del WebView (I2).
        val db = SQLiteDatabase.openDatabase(
            dbPath.path,
            null,
            SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING,
        )
        db.use {
            if (!SyncLock.acquire(it, owner)) return DrainOutcome(0, 0, -1)
            var pushed = 0
            var failed = 0
            try {
                val token = refreshAccessToken(ctx, creds) ?: return DrainOutcome(0, 0, -1)
                // `tbl:id` de filas que fallaron en esta pasada — bloquea a sus hijas (espejo de failedParents en flush()).
                val failedNow = mutableSetOf<String>()

                for (tbl in SYNC_ORDER) {
                    // Materializar antes de mutar: no tocar la tabla bajo un cursor abierto (M1).
                    val rows = it.rawQuery(
                        "SELECT id, payload, rev FROM local_rows WHERE tbl=? AND synced=0 ORDER BY created_at",
                        arrayOf(tbl),
                    ).use { c ->
                        val list = mutableListOf<Triple<String, String, Int>>()
                        while (c.moveToNext()) list.add(Triple(c.getString(0), c.getString(1), c.getInt(2)))
                        list
                    }

                    for ((id, payload, rev) in rows) {
                        if (parentBlocked(it, tbl, payload, failedNow)) continue

                        val error = try {
                            upsertRow(creds, token, tbl, payload)
                        } catch (_: NetworkDown) {
                            // Red caída: abortar toda la pasada y dejar el resto intacto (espejo de isNetworkError en flush(), I1).
                            return DrainOutcome(pushed, failed, pendingCount(it))
                        }

                        if (error == null) {
                            it.execSQL(
                                "UPDATE local_rows SET synced=1, sync_error=NULL WHERE tbl=? AND id=? AND rev=?",
                                arrayOf(tbl, id, rev),
                            )
                            pushed++
                        } else {
                            it.execSQL(
                                "UPDATE local_rows SET attempts=attempts+1, synced=0, sync_error=? WHERE tbl=? AND id=?",
                                arrayOf(truncate(error), tbl, id),
                            )
                            failedNow.add("$tbl:$id")
                            failed++
                        }
                    }
                }

                val photoResult = drainPhotos(ctx, it, creds, token)
                pushed += photoResult.ok
                failed += photoResult.fail
                return DrainOutcome(pushed, failed, pendingCount(it))
            } catch (_: SQLiteException) {
                // Contención con la conexión SQLite del WebView (I2): pasada parcial, no crashear al caller.
                return DrainOutcome(pushed, failed, -1)
            } finally {
                SyncLock.release(it, owner)
            }
        }
    }

    private fun pendingCount(db: SQLiteDatabase): Int = db.rawQuery(
        "SELECT (SELECT COUNT(*) FROM local_rows WHERE synced=0) + (SELECT COUNT(*) FROM local_photos WHERE synced=0)",
        null,
    ).use { c -> c.moveToFirst(); c.getInt(0) }

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

    /**
     * Sube una fila. `null` = éxito. Detalle de rechazo HTTP no-null (M3). Falla de transporte
     * lanza [NetworkDown], capturada por el caller para abortar la pasada (I1).
     */
    private fun upsertRow(creds: Credentials, token: String, tbl: String, payloadJson: String): String? {
        val conflict = ON_CONFLICT.getValue(tbl)
        val req = Request.Builder()
            .url("${creds.url}/rest/v1/$tbl?on_conflict=$conflict")
            .header("apikey", creds.anonKey)
            .header("Authorization", "Bearer $token")
            .header("Prefer", "resolution=merge-duplicates")
            .post(payloadJson.toRequestBody(JSON))
            .build()
        val res = try {
            http.newCall(req).execute()
        } catch (e: IOException) {
            throw NetworkDown(e)
        }
        return res.use { r -> if (r.isSuccessful) null else "HTTP ${r.code}: ${bodySnippet(r)}" }
    }

    /** Hasta ~300 chars del body de una respuesta de error; no fatal si no se puede leer (M3). */
    private fun bodySnippet(res: Response): String = try {
        res.body?.string()?.take(ERROR_BODY_SNIPPET_LEN) ?: "<sin cuerpo>"
    } catch (_: Exception) {
        "<cuerpo no legible>"
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

    private data class PhotoRow(
        val photoId: String,
        val eventType: String,
        val eventId: String,
        val label: String,
        val uploadedBy: String?,
        val takenAt: String,
        val role: String?,
        val ext: String,
        val contentType: String,
        val fileUri: String,
    )

    private data class PhotoDrainResult(val ok: Int, val fail: Int)

    /** Fotos de padres ya subidos: archivo -> Storage REST -> upsert en photos. */
    private fun drainPhotos(ctx: Context, db: SQLiteDatabase, creds: Credentials, token: String): PhotoDrainResult {
        var ok = 0
        var fail = 0
        // Materializar antes de mutar: no tocar la tabla bajo un cursor abierto (M1).
        val photos = db.rawQuery(
            "SELECT photo_id, event_type, event_id, label, uploaded_by, taken_at, role, ext, content_type, file_uri FROM local_photos WHERE synced=0",
            null,
        ).use { c ->
            val list = mutableListOf<PhotoRow>()
            while (c.moveToNext()) {
                list.add(
                    PhotoRow(
                        photoId = c.getString(0),
                        eventType = c.getString(1),
                        eventId = c.getString(2),
                        label = c.getString(3),
                        uploadedBy = c.getString(4),
                        takenAt = c.getString(5),
                        role = c.getString(6),
                        ext = c.getString(7),
                        contentType = c.getString(8),
                        fileUri = c.getString(9),
                    ),
                )
            }
            list
        }

        for (p in photos) {
            if (photoBlocked(db, p.eventType, p.eventId)) continue

            try {
                val file = File(ctx.filesDir, p.fileUri)
                if (!file.exists()) {
                    markPhotoFailed(db, p.photoId, "binario ausente: ${p.fileUri}")
                    fail++
                    continue
                }
                val path = "${p.eventType}/${p.eventId}/${p.photoId}.${p.ext}"
                val mediaType = p.contentType.toMediaType() // IllegalArgumentException si content_type es inválido (M2)
                val upload = Request.Builder()
                    .url("${creds.url}/storage/v1/object/photos/$path")
                    .header("apikey", creds.anonKey).header("Authorization", "Bearer $token")
                    .header("x-upsert", "true")
                    .post(file.readBytes().toRequestBody(mediaType))
                    .build()
                val uploadRes = try {
                    http.newCall(upload).execute()
                } catch (e: IOException) {
                    throw NetworkDown(e)
                }
                val uploadError = uploadRes.use { r -> if (r.isSuccessful) null else "HTTP ${r.code}: ${bodySnippet(r)}" }
                if (uploadError != null) {
                    markPhotoFailed(db, p.photoId, "storage upload falló: $uploadError")
                    fail++
                    continue
                }
                val row = JSONObject()
                    .put("id", p.photoId).put("storage_path", path)
                    .put("event_type", p.eventType).put("event_id", p.eventId)
                    .put("label", p.label).put("uploaded_by", p.uploadedBy ?: JSONObject.NULL)
                    .put("taken_at", p.takenAt).put("role", p.role ?: JSONObject.NULL)
                val error = upsertRow(creds, token, "photos", row.toString())
                if (error == null) {
                    db.execSQL("UPDATE local_photos SET synced=1, sync_error=NULL WHERE photo_id=?", arrayOf(p.photoId))
                    file.delete()
                    ok++
                } else {
                    markPhotoFailed(db, p.photoId, error)
                    fail++
                }
            } catch (_: NetworkDown) {
                // Red caída: abortar toda la pasada de fotos, espejo del comportamiento de filas (I1).
                return PhotoDrainResult(ok, fail)
            } catch (e: IllegalArgumentException) {
                // content_type inválido para toMediaType() (M2).
                markPhotoFailed(db, p.photoId, "content_type inválido: ${e.message}")
                fail++
            } catch (e: Exception) {
                // Lectura de archivo u otro fallo no-red: marcar esta foto y seguir con la próxima (M2).
                markPhotoFailed(db, p.photoId, "foto falló: ${e.message}")
                fail++
            }
        }
        return PhotoDrainResult(ok, fail)
    }

    private fun markPhotoFailed(db: SQLiteDatabase, photoId: String, error: String) {
        db.execSQL(
            "UPDATE local_photos SET attempts=attempts+1, synced=0, sync_error=? WHERE photo_id=?",
            arrayOf(truncate(error), photoId),
        )
    }

    private fun truncate(s: String): String = if (s.length > MAX_ERROR_LEN) s.substring(0, MAX_ERROR_LEN) else s
}
