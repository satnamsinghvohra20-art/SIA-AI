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
_(nothing summarized yet — still within recent_messages window)_

## snapshot: blockers (last 10)
_(none)_

## snapshot: last_updated
2026-08-15T06:58:14.544Z
