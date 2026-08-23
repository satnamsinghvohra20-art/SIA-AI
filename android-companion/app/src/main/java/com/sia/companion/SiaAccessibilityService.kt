package com.sia.companion

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.speech.tts.TextToSpeech
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.os.Bundle
import java.util.Locale

/**
 * SIA ACCESSIBILITY SERVICE
 * --------------------------
 * This is the Android equivalent of server/deviceControl/handlers/uiControl.js.
 * Once the user grants this service Accessibility permission (Settings >
 * Accessibility > Sia Companion > On), it can read and act on the screen
 * content of ANY app — not just ones with an API — the same way TalkBack
 * or other assistive apps do. This is the standard, Play-Store-legal way
 * to do general on-device automation on Android; there is no equivalent
 * of "unofficial WhatsApp automation" risk here because nothing is
 * simulating a fake client — it's driving the real UI, like a user would.
 *
 * Commands arrive over the WebSocket connection managed by
 * CompanionConnection.kt and are dispatched here.
 */
class SiaAccessibilityService : AccessibilityService() {

    private lateinit var tts: TextToSpeech

    companion object {
        // Set by CompanionConnection so it can call back into a live
        // service instance once the OS has actually bound it.
        var instance: SiaAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        tts = TextToSpeech(applicationContext) { }
    }

    override fun onDestroy() {
        instance = null
        tts.shutdown()
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    // --- Command handlers, called from CompanionConnection ---

    fun tap(x: Float, y: Float, callback: (Boolean) -> Unit) {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            .build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) = callback(true)
            override fun onCancelled(gestureDescription: GestureDescription?) = callback(false)
        }, null)
    }

    fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long, callback: (Boolean) -> Unit) {
        val path = Path().apply { moveTo(x1, y1); lineTo(x2, y2) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
            .build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) = callback(true)
            override fun onCancelled(gestureDescription: GestureDescription?) = callback(false)
        }, null)
    }

    // Types into whichever node is currently focused. Falls back to
    // "no focused editable field" error the server surfaces back to the
    // user/voice loop rather than silently doing nothing.
    fun typeText(text: String): Boolean {
        val node = findFocusedEditable(rootInActiveWindow) ?: return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    private fun findFocusedEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isFocused && node.isEditable) return node
        for (i in 0 until node.childCount) {
            val found = findFocusedEditable(node.getChild(i))
            if (found != null) return found
        }
        return null
    }

    fun pressKey(key: String): Boolean {
        val action = when (key.lowercase()) {
            "back" -> GLOBAL_ACTION_BACK
            "home" -> GLOBAL_ACTION_HOME
            "recents" -> GLOBAL_ACTION_RECENTS
            else -> return false
        }
        return performGlobalAction(action)
    }

    // Dumps a compact text tree of clickable/text elements currently on
    // screen — this is what lets the model decide "tap the send button"
    // without needing a screenshot + vision round trip.
    fun readScreen(): String {
        val root = rootInActiveWindow ?: return "(no active window)"
        val sb = StringBuilder()
        collectText(root, sb)
        return sb.toString().ifBlank { "(no visible text/labels found)" }
    }

    private fun collectText(node: AccessibilityNodeInfo?, sb: StringBuilder) {
        if (node == null) return
        val label = node.text?.toString() ?: node.contentDescription?.toString()
        if (!label.isNullOrBlank()) {
            val bounds = android.graphics.Rect()
            node.getBoundsInScreen(bounds)
            sb.append("[${bounds.centerX()},${bounds.centerY()}] ")
            if (node.isClickable) sb.append("(tappable) ")
            sb.append(label).append("\n")
        }
        for (i in 0 until node.childCount) collectText(node.getChild(i), sb)
    }

    fun speak(text: String) {
        tts.speak(text, TextToSpeech.QUEUE_ADD, null, "sia-notify")
    }
<<<<<<< HEAD

    // Opens any URL/deep link via ACTION_VIEW — this is what lets the server
    // jump straight into WhatsApp's chat screen (wa.me/<number>?text=...),
    // the dialer (tel:<number>), or any other app's own deep link, instead
    // of tapping through several screens by coordinate. Free, uses each
    // app's own supported link scheme, nothing unofficial.
    fun openUrl(url: String): Boolean {
        return try {
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            applicationContext.startActivity(intent)
            true
        } catch (e: Exception) {
            false
        }
    }
=======
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
}
