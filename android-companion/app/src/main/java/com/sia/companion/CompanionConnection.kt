package com.sia.companion

import android.content.Context
import android.content.pm.PackageManager
import okhttp3.*
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * COMPANION CONNECTION
 * ---------------------
 * Mirrors server/deviceControl/mobileBridge.js on the phone side: opens
 * (and keeps alive, with auto-reconnect) a WebSocket to the Sia server,
 * receives one JSON command at a time, executes it via the Accessibility
 * Service, and sends the result back keyed by command id.
 *
 * Reconnects with backoff so this survives the phone locking, WiFi drops,
 * or the server restarting — it's meant to be "always on" the way the
 * server's own wake-word loop is.
 */
class CompanionConnection(private val context: Context, private val serverUrl: String, private val token: String, private val sessionId: String) {

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    private var ws: WebSocket? = null
    private var reconnectAttempt = 0

    fun connect() {
        val url = "$serverUrl/ws/mobile?token=$token&sessionId=$sessionId"
        val request = Request.Builder().url(url).build()
        ws = client.newWebSocket(request, listener)
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            reconnectAttempt = 0
            android.util.Log.i("SiaCompanion", "Connected to Sia server")
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            handleCommand(webSocket, JSONObject(text))
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            android.util.Log.w("SiaCompanion", "Connection lost: ${t.message}, retrying...")
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            scheduleReconnect()
        }
    }

    private fun scheduleReconnect() {
        reconnectAttempt++
        val delayMs = minOf(30_000L, 1000L * reconnectAttempt)
        android.os.Handler(context.mainLooper).postDelayed({ connect() }, delayMs)
    }

    private fun respond(webSocket: WebSocket, id: String, ok: Boolean, result: Any? = null, error: String? = null) {
        val payload = JSONObject().apply {
            put("id", id)
            put("ok", ok)
            if (result != null) put("result", if (result is JSONObject) result else JSONObject().put("value", result))
            if (error != null) put("error", error)
        }
        webSocket.send(payload.toString())
    }

    private fun handleCommand(webSocket: WebSocket, msg: JSONObject) {
        val id = msg.getString("id")
        val type = msg.getString("type")
        val params = msg.optJSONObject("params") ?: JSONObject()
        val svc = SiaAccessibilityService.instance

        if (svc == null) {
            respond(webSocket, id, false, error = "Accessibility permission not granted yet. Open Settings > Accessibility > Sia Companion and turn it on.")
            return
        }

        when (type) {
            "tap" -> svc.tap(params.getDouble("x").toFloat(), params.getDouble("y").toFloat()) { success ->
                if (success) respond(webSocket, id, true, JSONObject().put("tapped", true))
                else respond(webSocket, id, false, error = "Tap gesture was cancelled")
            }
            "swipe" -> svc.swipe(
                params.getDouble("x1").toFloat(), params.getDouble("y1").toFloat(),
                params.getDouble("x2").toFloat(), params.getDouble("y2").toFloat(),
                params.optLong("durationMs", 300)
            ) { success ->
                if (success) respond(webSocket, id, true, JSONObject().put("swiped", true))
                else respond(webSocket, id, false, error = "Swipe gesture was cancelled")
            }
            "type" -> {
                val ok = svc.typeText(params.getString("text"))
                if (ok) respond(webSocket, id, true, JSONObject().put("typed", true))
                else respond(webSocket, id, false, error = "No focused text field found on screen")
            }
            "press_key" -> {
                val ok = svc.pressKey(params.getString("key"))
                if (ok) respond(webSocket, id, true, JSONObject().put("pressed", params.getString("key")))
                else respond(webSocket, id, false, error = "Unknown key: ${params.optString("key")}")
            }
            "read_screen" -> respond(webSocket, id, true, JSONObject().put("screen", svc.readScreen()))
            "open_app" -> {
                val ok = openAppByName(params.getString("app"))
                if (ok) respond(webSocket, id, true, JSONObject().put("opened", params.getString("app")))
                else respond(webSocket, id, false, error = "App \"${params.optString("app")}\" not found on this phone")
            }
            "notify" -> {
                svc.speak(params.getString("text"))
                respond(webSocket, id, true, JSONObject().put("spoken", true))
            }
<<<<<<< HEAD
            "open_url" -> {
                val ok = svc.openUrl(params.getString("url"))
                if (ok) respond(webSocket, id, true, JSONObject().put("opened", params.getString("url")))
                else respond(webSocket, id, false, error = "Couldn't open that URL/deep link")
            }
=======
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
            else -> respond(webSocket, id, false, error = "Unknown command type: $type")
        }
    }

    private fun openAppByName(name: String): Boolean {
        val pm = context.packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
        val match = apps.firstOrNull { pm.getApplicationLabel(it).toString().equals(name, ignoreCase = true) }
            ?: apps.firstOrNull { pm.getApplicationLabel(it).toString().contains(name, ignoreCase = true) }
            ?: return false
        val intent = pm.getLaunchIntentForPackage(match.packageName) ?: return false
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return true
    }

    fun disconnect() {
        ws?.close(1000, "app closing")
    }
}
