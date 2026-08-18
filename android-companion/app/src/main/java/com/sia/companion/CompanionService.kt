package com.sia.companion

import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Runs as a foreground service so Android doesn't kill the WebSocket
 * connection when the app isn't on screen — this is what makes "always
 * listening / always controllable" actually true rather than only
 * working while the app is open.
 */
class CompanionService : Service() {

    private var connection: CompanionConnection? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences("sia_companion", MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null)
        val token = prefs.getString("pair_token", null)
        val sessionId = prefs.getString("session_id", "voice-loop")

        startForeground(1, buildNotification())

        if (serverUrl != null && token != null) {
            connection = CompanionConnection(this, serverUrl, token, sessionId ?: "voice-loop")
            connection?.connect()
        }
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        val channelId = "sia_companion_channel"
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(channelId, "Sia Companion", NotificationManager.IMPORTANCE_LOW)
        )
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("Sia Companion active")
            .setContentText("Connected — this phone can be controlled by voice command.")
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        connection?.disconnect()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
