# BRAIN.md — Sia's Persistent Memory & Task Loop

> This file is the spec for how Sia remembers what it's doing and never
> loses the thread — across page reloads, server restarts, and long-running
> autonomous work.

## Why this exists

Before this: every browser refresh wiped the chat (`client/app.js` kept
history only in a JS variable), and there was no concept of "the current
task" at all — each `/api/chat` call was stateless.

That's fine for a single Q&A, but breaks the moment you want Sia to:
- survive a server restart mid-conversation
- run multi-step work autonomously (a "loop") without you re-explaining
  the goal every cycle
- pick back up where it left off if a model call fails or the process crashes

## The two-file split (important — read this before editing either)

Markdown is for humans. Loops need something a program can parse reliably
without a markdown parser breaking on a stray `#` in your chat. So:

- **`data/sessions/<id>/brain-state.json`** — the real, machine-read/written
  state, one file per session. Every persistence read/write in the code
  touches this file, atomically. `<id>` is a UUID from the browser's
  `sia_session` cookie for web chats, or the fixed id `cli` for anything run
  via `loop.js` directly — so autonomous CLI runs never collide with, or
  leak into, any browser session's memory.
- **`data/sessions/<id>/brain.md`** — per-session human-readable snapshot.
- **`brain.md`** (this file, project root) — the hand-written spec above
  this line, plus a mirrored snapshot of the `cli` session specifically
  (since that's the one you're usually checking by eye after running
  `loop.js`). Web session snapshots live only under `data/sessions/`.

Never hand-edit a `brain.md` snapshot expecting Sia to read it back — edit
the JSON (or just talk to Sia; it updates its own state).

## Session isolation

Every browser gets its own `sia_session` cookie (httpOnly, signed-safe
random UUID) on first visit, via `server/session.js`. That id is the only
thing that determines which state file a request reads and writes — so two
people using the same deployed Sia never see each other's chat or task
history. `brainStore.js` validates the session id against a strict
`[a-zA-Z0-9_-]` pattern before it ever touches the filesystem, so a forged
or malformed cookie can't be used for path traversal — it just gets a fresh
session instead.

## Auth

If `SIA_PASSWORD` is set (see `.env.example`), every `/api/*` route except
`/api/login` requires a valid signed `sia_auth` cookie, issued by
`server/auth.js` after a correct password. If `SIA_PASSWORD` is unset, Sia
runs open — fine on your own machine, not fine the moment the URL is
reachable by anyone else. The server logs a warning on boot either way.

## What gets stored

```
current_task     — id, goal, status (idle | in_progress | blocked | done), started_at
plan             — ordered checklist of steps, each with done: true/false
decisions_log    — timestamped one-liners: what was decided and why
chat_summary     — rolling COMPRESSED summary of the conversation, not raw transcript
recent_messages  — last N raw messages verbatim (enough for immediate context)
blockers         — things the loop couldn't resolve on its own, needs a human
last_updated     — ISO timestamp
```

### Why "compressed summary" instead of the full raw chat

Storing the entire raw conversation forever grows unbounded — you'll blow
your model's context window and your OpenRouter bill within a few hundred
turns. The real pattern (this is what production agent loops actually do):

- Keep the last **N raw messages** (default 20) for immediate context
- Once messages age out of that window, **fold them into `chat_summary`**
  via a cheap model call, instead of deleting them
- Sia's context on any given turn = `chat_summary` + `recent_messages`,
  never the full history

This is implemented in `server/memory/brainStore.js` → `summarizeIfNeeded()`.

## The loop

`server/memory/loop.js` is a standalone runner for autonomous multi-step
work (separate from the interactive `/api/chat` request/response cycle).
Give it a goal, it breaks it into steps in `plan`, executes one step per
cycle via Sia's router, checks the step off, and writes state atomically
after every single step — so a crash mid-run loses at most one step, never
the whole task.

Run it directly:

```bash
node server/memory/loop.js "research and draft a competitor comparison for our CRM feature"
```

Or import `runLoop()` into your own script/cron job.

## Failure handling (this is what makes it launch-safe, not a toy)

1. **Atomic writes** — state is written to a `.tmp` file then renamed over
   the real file. A crash mid-write never corrupts `brain-state.json`.
2. **Errors are logged into state, not thrown away** — if a step fails,
   the loop records it under `blockers` and moves to the next step instead
   of dying silently or crashing the whole process.
3. **Idempotent resume** — `runLoop()` reads existing state on startup; if
   a task is already `in_progress`, it resumes from the first unchecked
   step instead of restarting from scratch.

## Files added

- `brain.md` — this file (human-readable, auto-regenerated below the marker)
- `data/sessions/<id>/brain-state.json` — per-session machine state
  (git-ignore `data/` — it now contains real per-user chat content, not just
  your own CLI runs)
- `server/memory/brainStore.js` — read/write/summarize logic, session-scoped
- `server/memory/loop.js` — the autonomous task loop (runs under the `cli` session)
- `server/session.js` — assigns/validates the per-browser session cookie
- `server/auth.js` — password gate + signed auth cookie (see `SIA_PASSWORD`)
- `server/index.js` — `/api/chat` persists every turn per-session, rate
  limited, auth-gated; `GET /api/history` restores this session's chat
- `client/app.js` / `client/index.html` — loads history on page load, shows
  a login overlay when `/api/*` returns 401

<!-- AUTO-GENERATED SNAPSHOT — DO NOT EDIT BELOW THIS LINE -->

## snapshot: session
cli

## snapshot: current_task
- id: —
- goal: —
- status: idle
- started_at: —

## snapshot: plan
_(no active plan)_

## snapshot: decisions_log (last 15)
_(none yet)_

## snapshot: chat_summary
**Updated Summary (under 200 words)**  

- **Context:** Sia is trying to view incoming WhatsApp messages from "Anuj," who offered to let her open his WhatsApp. She drafted a clarification message asking **which college "Anuj College" refers to**, but it was unclear if it was sent due to messaging/typing issues (Hebrew keyboard, contact visibility problems).  
- **Attempts:** Multiple tries to open Flipkart/WhatsApp were made; she confirmed opening WhatsApp in Edge as Anuj suggested.  
- **Latest query:** "on which college" – the user is resuming their earlier unresolved question about Anuj's college affiliation.  
- **New input:** User added "Anuj College, Hebrew" — possibly indicating the college name or a Hebrew-related context.  
- **Status:** The college name remains **unidentified** because Anuj has not yet replied with clarification.  
- **Assistant's response:** Acknowledged the status, stating that the college identification is pending Anuj's reply.  

**Open threads / needed clarification:**  
1. Which college Anuj is affiliated with (awaiting his reply).  
2. Whether the previously drafted clarification message was successfully sent.  
3. The intended purpose/content of the WhatsApp message (if not just a college query).  
4. Recipient's confirmation of received messages.

## snapshot: blockers (last 10)
- 2026-08-23T12:33:07.024Z — /api/chat failed: All candidate AI models failed. Last error: Model anthropic/claude-3.5-haiku returned 404: {"error":{"message":"No endpoints found for anthropic/claude-3.5-haiku.","code":404},"user_id":"user_3IHmLA8alz2aKZltYat9YuKDv9X"}
- 2026-08-24T14:19:11.385Z — /api/chat failed: persistedHistory is not defined
- 2026-08-24T14:48:13.046Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"Insufficient credits. This account never purchased credits. Make sure your key is on the correct account or org, and if so, purchase more at https://openrouter.ai/settings/credits
- 2026-08-24T14:48:13.417Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"Insufficient credits. This account never purchased credits. Make sure your key is on the correct account or org, and if so, purchase more at https://openrouter.ai/settings/credits
- 2026-08-24T14:48:21.659Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"Insufficient credits. This account never purchased credits. Make sure your key is on the correct account or org, and if so, purchase more at https://openrouter.ai/settings/credits
- 2026-08-24T14:48:25.925Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"Insufficient credits. This account never purchased credits. Make sure your key is on the correct account or org, and if so, purchase more at https://openrouter.ai/settings/credits
- 2026-08-24T14:48:28.257Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"Insufficient credits. This account never purchased credits. Make sure your key is on the correct account or org, and if so, purchase more at https://openrouter.ai/settings/credits
- 2026-08-24T14:48:28.891Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"This request requires more credits, or fewer max_tokens. You requested up to 700 tokens, but can only afford 603. To increase, visit https://openrouter.ai/settings/credits and upg
- 2026-08-24T14:48:29.098Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"Insufficient credits. This account never purchased credits. Make sure your key is on the correct account or org, and if so, purchase more at https://openrouter.ai/settings/credits
- 2026-08-24T15:11:48.155Z — /api/chat failed: All candidate AI models failed. Last error: Model deepseek/deepseek-chat returned 402: {"error":{"message":"Insufficient credits. This account never purchased credits. Make sure your key is on the correct account or org, and if so, purchase more at https://openrouter.ai/settings/credits

## snapshot: last_updated
2026-08-25T13:47:06.064Z
