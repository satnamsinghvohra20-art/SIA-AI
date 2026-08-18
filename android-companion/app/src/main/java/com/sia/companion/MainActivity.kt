package com.sia.companion

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * One-time pairing screen: enter the server's URL and the
 * ANDROID_PAIR_TOKEN from .env, then start the background service.
 * Accessibility permission is a separate OS-level grant — this screen
 * links straight to that settings page since it can't be requested
 * programmatically (Android requires an explicit user visit there).
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val prefs = getSharedPreferences("sia_companion", MODE_PRIVATE)
        val urlField = findViewById<EditText>(R.id.serverUrlField)
        val tokenField = findViewById<EditText>(R.id.tokenField)
        val sessionField = findViewById<EditText>(R.id.sessionField)
        val statusText = findViewById<TextView>(R.id.statusText)

        urlField.setText(prefs.getString("server_url", "ws://192.168.1.100:3000"))
        tokenField.setText(prefs.getString("pair_token", ""))
        sessionField.setText(prefs.getString("session_id", "voice-loop"))

        findViewById<Button>(R.id.accessibilityButton).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        findViewById<Button>(R.id.connectButton).setOnClickListener {
            prefs.edit()
                .putString("server_url", urlField.text.toString().trim())
                .putString("pair_token", tokenField.text.toString().trim())
                .putString("session_id", sessionField.text.toString().trim())
                .apply()

            startForegroundService(Intent(this, CompanionService::class.java))
            statusText.text = "Connecting… check Settings > Accessibility to confirm the service is on."
        }
    }
}
