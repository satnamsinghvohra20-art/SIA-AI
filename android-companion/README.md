# Sia Companion (Android)

Lets Sia control this phone by voice — tap, swipe, type, open apps, read
the screen, in ANY app — via Android's Accessibility Service (the same
mechanism TalkBack uses), not per-app APIs. Runs as a background service
so it stays connected while you're not looking at it.

## Build it

1. Open the `android-companion/` folder in **Android Studio** (Koala or
   newer). It'll prompt to sync Gradle — let it.
2. Plug in your phone (USB debugging on) or use an emulator, hit **Run**.

There's no server-side build step needed for this — it's a normal Android
app project, just handed to you pre-wired for Sia instead of starting from
a blank template.

## Pair it with your Sia server

1. On the server machine, set `ANDROID_PAIR_TOKEN` in `.env` to any long
   random string, then restart `npm start`.
2. Find that machine's local IP (`ipconfig` on Windows, `ifconfig`/`ip a`
   on Mac/Linux) — phone and server need to be on the same WiFi network.
3. Open the Sia Companion app → enter `ws://<that-ip>:3000` as the server
   URL, paste the token, keep the session ID as `voice-loop` (must match
   `VOICE_SESSION_ID` in the server's `.env` if you changed it).
4. Tap **"1. Open Accessibility Settings"** → find **Sia Companion** →
   turn it on → accept the permission dialog. This step can't be done
   from inside the app itself; Android requires you to do it from
   Settings directly, on purpose.
5. Tap **"2. Save & Connect"**. You should see a persistent notification
   ("Sia Companion active") — that means the phone is now reachable.
6. Also turn off battery optimization for the app (Settings > Apps > Sia
   Companion > Battery > Unrestricted) or Android will eventually kill
   the background connection to save power.

## Try it

From the desktop chat UI's Device Control panel, or from the voice loop,
say/type something like: *"open WhatsApp on my phone and read the
screen"* — that routes to `mobile_open_app` + `mobile_read_screen`, both
executed on the paired phone.

## Security notes

- The pair token in `.env` is the only thing standing between "your
  phone" and "anyone who can reach that port." Keep it private, and put
  the server behind a real firewall/VPN before using this off your home
  network.
- Every gesture/type/tap command from the model is still gated by the
  same risky-action confirmation flow as desktop control — nothing here
  bypasses that.
- `QUERY_ALL_PACKAGES` is required to open apps by name; Google Play has
  extra review for this permission if you ever publish rather than
  side-load this app. For personal use (sideloaded via Android Studio),
  it's a non-issue.
