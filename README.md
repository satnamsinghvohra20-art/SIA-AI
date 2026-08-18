# Sia — Multi-Model Orchestrator

One chat box. Every message gets classified and routed to whichever AI model
is currently best suited for that kind of task — coding to Claude, deep
reasoning to o3, research to Perplexity Sonar, vision to Gemini, and so on.

Sia also remembers — chat history and any active multi-step task persist to
disk per-session (`brain.md` / `data/sessions/<id>/`), so a page reload or
server restart never loses context, and two users never share one brain.
Add `SIA_PASSWORD` to `.env` before deploying this anywhere reachable by
others — see **Auth & sessions** below.

## How it works

```
your message
     │
     ▼
classifier.js  ──► figures out the task category
                    (heuristic keyword match first, LLM fallback if unsure)
     │
     ▼
modelRegistry.js ──► category -> best model for that category
     │
     ▼
openrouterClient.js ──► sends the request to that model via OpenRouter
     │
     ▼
your answer, tagged with which model handled it, persisted to brainStore
```

**Why OpenRouter?** It's a single API that proxies 100+ models — OpenAI,
Anthropic, Google, Meta, DeepSeek, Mistral, Qwen, xAI, and more — so you get
one key instead of juggling a dozen provider accounts. Swap any model in
`server/modelRegistry.js` any time a better one comes out.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env
# then edit .env and paste your key from https://openrouter.ai/keys

# 3. Run it
npm start
```

Open **http://localhost:3000**.

## Project structure

```
sia-ai/
├── brain.md                 # human-readable memory spec + live CLI-session snapshot
├── server/
│   ├── index.js             # Express server + API routes, auth + rate-limit wiring
│   ├── router.js            # orchestration: classify -> pick model -> call it
│   ├── classifier.js        # task classification (heuristic + LLM fallback)
│   ├── modelRegistry.js     # category -> best model mapping (EDIT THIS to tune routing)
│   ├── openrouterClient.js  # thin wrapper around the OpenRouter API
│   ├── session.js           # per-browser session cookie -> isolated brain state
│   ├── auth.js               # password gate + signed auth cookie
│   └── memory/
│       ├── brainStore.js    # persistence: chat history, task/plan state, atomic writes
│       └── loop.js          # standalone autonomous task loop (multi-step, resumable)
├── data/
│   └── sessions/<id>/       # one brain-state.json + brain.md per session (git-ignored)
├── client/
│   ├── index.html            # includes the login overlay
│   ├── style.css
│   └── app.js                 # chat UI; loads history, handles login/401
├── .env.example
├── .gitignore
└── package.json
```

## Memory & the task loop

**Interactive chat** persists automatically — no setup needed. Every message
and reply is saved via `brainStore.js`; reload the page or restart the
server and `/api/history` restores the conversation. Once history passes 20
messages, the oldest ones get folded into a rolling summary instead of
growing forever, so token cost stays bounded on long conversations.

**Autonomous multi-step tasks** use the standalone loop:

```bash
node server/memory/loop.js "your goal, e.g. research competitors and draft a comparison doc"
```

It breaks the goal into steps, executes one per cycle through Sia's normal
router, and writes state to disk after every single step. If it crashes or
you kill it mid-run, re-run the same command — it resumes from the first
unfinished step instead of starting over. A step that fails gets logged
under `blockers` in `brain.md` and the loop moves on, instead of dying.

Read `brain.md` any time to see exactly what Sia is doing — current task,
plan checklist, decision log, and any blockers needing your attention.

## Auth & sessions

Set `SIA_PASSWORD` in `.env` and every `/api/*` route (except `/api/login`)
requires it — a login overlay appears in the UI automatically. Leave it
unset for local-only use and Sia runs open, with a warning on boot.

Every browser gets its own signed `sia_session` cookie on first visit, and
that id is what isolates one person's chat/task history from another's —
there's no separate "accounts" system, just per-browser state. `/api/chat`
is rate-limited (60 requests / 15 min by default) and `/api/login` is
limited tighter (10 attempts / 15 min) against brute-forcing the password.

## Customizing the routing

Everything about "who does what" lives in `server/modelRegistry.js`. To change
which model handles a category, just change the `model` string — it must be a
valid OpenRouter model id (browse them at https://openrouter.ai/models).

To add a whole new category (e.g. "translation" or "legal"):
1. Add an entry to `MODEL_REGISTRY` in `modelRegistry.js`
2. Add matching keywords to `CATEGORY_KEYWORDS` in `classifier.js`

## Manual override

The dropdown next to the input box lets you force a specific category instead
of trusting auto-routing — useful for testing or when you know exactly which
model you want.

## Next steps you might want to add

- **Streaming responses** (currently waits for the full answer before showing it)
- **Cost tracking** — OpenRouter returns token usage per call; log it per category
- **Multi-model consensus mode** — send the same prompt to 2-3 models and compare answers
- **File/image upload** for the vision category
- **Real user accounts** — current auth is one shared password, not per-person logins; fine for a small team, not for public signup
- See `FEATURES.md` for a fuller prioritized backlog

## Device Control

A "Device Control" button in the header opens a panel where you can tell
Sia to carry out actions on the machine the server runs on: opening/closing
apps, adjusting volume, taking screenshots, reading/writing files, running a
pre-approved script, sending a WhatsApp message, sending an Instagram DM, or
placing a phone call. Under the hood it's a small looping agent
(`server/deviceControl/agentLoop.js`): it asks the model for one action at a
time, runs it, feeds the result back, and repeats until the instruction is
done — up to 8 steps per request.

**Safety model, enforced server-side (not just by prompting):**
- Every action is either `safe` (runs immediately) or `risky` (deleting
  files, running a script, sending a message, placing a call, or changing
  power state) — see `server/deviceControl/actionRegistry.js`. Risky actions
  always pause and show an Approve/Deny card before they run, no matter how
  the instruction is phrased.
- File actions are sandboxed to `SIA_DEVICE_ROOT` (defaults to
  `data/device/files/`) — a path that resolves outside that folder is
  rejected, not executed.
- There's no "run this arbitrary command" action. `run_script` can only
  invoke scripts that already exist in `server/deviceControl/scripts/` —
  add your own `.sh`/`.py`/`.js` files there to extend what it can do.
- WhatsApp, Instagram, and calling use official APIs (Twilio, Meta Graph
  API) rather than unofficial personal-account automation, so they need
  their own credentials in `.env` (see `.env.example`) and won't do
  anything until configured.
- Device-control tasks are tied to your signed session cookie the same way
  chat history is — another session can't see or approve your pending
  actions.

To add a new action: write a handler function in
`server/deviceControl/handlers/`, then register it (name, description,
JSON-schema params, and `risk` level) in `actionRegistry.js`.

## Voice control — one command, does the task, talks back

This is the "control everything by voice" layer. It doesn't route through
per-app APIs (that's what the WhatsApp/Instagram/call actions above do,
and why they need Twilio/Meta credentials) — instead it drives the
**operating system directly**, on whichever device it's running on, the
same way a person would with a mouse/keyboard/finger. That's what makes
it work in apps that don't have a public API at all.

| Device | How it's controlled | Setup |
|---|---|---|
| **This PC/Mac/Linux box** | `ui_click` / `ui_type` / `ui_press_key` / `ui_scroll` — OS-level input simulation (PowerShell / AppleScript / xdotool) | Built in, nothing extra to install (Linux needs `xdotool`) |
| **Your Android phone** | `mobile_tap` / `mobile_type` / `mobile_open_app` / `mobile_read_screen` — forwarded to a companion app's Accessibility Service | Build & pair `/android-companion` — see its README |
| **Your iPhone** | Voice remote only (`/api/voice-command`) — iOS doesn't allow cross-app automation for any app, including this one | Set up the Shortcut in `/ios-companion` |

**Always-listening wake word (runs on the PC):**

```bash
npm install                      # ws is required; picovoice/node-record are optional
cp .env.example .env             # fill in PICOVOICE_ACCESS_KEY + PICOVOICE_KEYWORD_PATH
                                  # (free, from https://console.picovoice.ai) and
                                  # GROQ_API_KEY or OPENAI_API_KEY for transcription
node server/voice/voiceAgent.js
```

Say the wake word, then your instruction — e.g. *"open Chrome and search
for flight prices to Goa"* or *"tell my phone to open WhatsApp and read
the screen."* It:

1. transcribes what you said,
2. decides if it's a device task or a plain question,
3. for device tasks, runs it step by step through the same agent loop as
   the Device Control panel — narrating **each completed step out loud**
   as it happens (not silence until the very end),
4. speaks the final result when done.

This process talks to the router/agent loop directly (no HTTP hop), so
run it on the same machine as the server, or point it at a remote server
by adapting it to hit `/api/voice-command` instead if you split them
across machines.

**No wake-word setup yet?** `/api/voice-command` (text in, spoken-ready
text out) works standalone right now — that's what both the iOS Shortcut
and the Android app's own on-device speech recognition can hit directly,
without the Picovoice/Groq setup above.
"# SIA-AI" 
