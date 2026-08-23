# iOS — voice remote via Shortcuts

**Read this first:** Apple does not allow any third-party app — including
one built specifically for this — to tap, type, or read the screen of
*other* apps on iOS. That's not a gap in this project, it's a hard
platform restriction (no Accessibility Service equivalent is exposed to
third-party apps). So there is no iOS version of the Android companion
app that "controls any app on the phone."

What iOS **can** do well: be a voice remote for your PC and your Android
phone. You talk to Siri, it sends the text to Sia's `/api/voice-command`
endpoint, Sia runs the instruction (opening apps/clicking/typing on your
PC, or tapping/typing on your paired Android phone), and Siri speaks the
result back. Full loop, just with the "brain" and "hands" living on
devices that allow it.

## Set up the Shortcut

1. Open the **Shortcuts** app → **+** → name it "Sia".
2. Add action: **Dictate Text**.
3. Add action: **Get Contents of URL**
   - URL: `http://<your-server-ip>:3000/api/voice-command`
   - Method: `POST`
   - Headers: `X-Sia-Password: <your SIA_PASSWORD>`, `Content-Type: application/json`
   - Request Body (JSON): `{ "text": [Dictated Text], "sessionId": "voice-loop" }`
4. Add action: **Get Dictionary from Input** (parses the JSON response).
5. Add action: **Get Value for Key** → `reply`.
6. Add action: **Speak Text** → the value from step 5.
7. Save. Add it to Siri with a phrase like *"Hey Sia"* (Settings > Shortcut
   name > Add to Siri), or add it to your Home Screen / Action Button for
   one tap instead of a wake word.

That's the whole thing — no app to build, no App Store review, and it
reuses the exact same `/api/voice-command` route the Android app and the
desktop voice loop hit. Same server, three front doors.

## Why not a native iOS app instead?

A native app gets you a nicer mic/UI experience but not more control —
the sandboxing that blocks cross-app automation applies to any app you'd
build, not just this one. If you want the phone in your pocket to *be*
the always-listening device with its own wake word, put that app on
Android instead (see `/android-companion`) and let this Shortcut be your
iPhone's way in.
