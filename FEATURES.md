# Sia — Feature Backlog

Organized by priority tier, then category. This is a working backlog, not a
promise that all of it ships — pull from the top first. Items are kept
distinct on purpose; nothing here is the same idea reworded to pad the count.

A note on scope: earlier in this conversation "1000+ features" was asked
for. A genuinely distinct, non-repeated list for a project this size tops
out well under that — padding past this point would mean listing the same
handful of ideas with different wording, which wastes your time when you're
trying to launch. What's below is real and prioritized; use it as-is.

---

## Tier 0 — Fix before you show this to anyone else (launch blockers)

**Shipped:**
- [x] **Per-user/session state** — `data/sessions/<id>/` isolates each
      browser's chat/task history via a signed `sia_session` cookie.
      Verified: two separate cookie jars produce completely separate
      histories, and a forged/malformed session cookie is rejected and
      replaced rather than crashing or reaching the filesystem unsafely.
- [x] **Auth** — set `SIA_PASSWORD` and every `/api/*` route requires a
      signed `sia_auth` cookie issued after a correct password. Unset =
      runs open with a boot-time warning (fine for local-only use).
- [x] **Rate limiting** — `/api/chat` capped at 60 req/15min, `/api/login`
      at 10 attempts/15min (brute-force defense). Verified: the 11th login
      attempt in a window returns 429.
- [x] **API key never reaches the client** — confirmed, still true.
- [x] **`/api/brain` scoped to the caller's own session** — no longer a
      global "see everyone's history" endpoint; still worth removing or
      hiding behind an admin-only check before a public launch.
- [x] **`.gitignore` added** — covers `.env`, `data/`, `node_modules/`.
- [x] **Runtime memory excluded from Git** — session files are local-only;
      per-user chat history and knowledge files are not repository content.
- [x] **Risky device actions require approval** — destructive file actions,
      command execution, calls, and messages pause before execution; fast-path
      dispatch cannot bypass that approval step.
- [x] **Device file sandbox** — file actions stay under `SIA_DEVICE_ROOT`,
      including symlink-resolved path checks.
- [x] **Session-scoped response cache** — cached answers never cross browser
      sessions.
- [x] **Iteration-limit accuracy** — the agent reports an incomplete task
      when it reaches its step cap instead of claiming success.
- [x] **Error messages sanitized for the client** — `/api/chat` no longer
      forwards raw OpenRouter error text (which can include account/billing
      details) to the browser; full detail still goes to server logs.

**Still open:**
- [ ] **Real accounts** — current auth is one shared password for everyone,
      not per-person logins. Fine for you + a small trusted team, not for
      public signup — that's real user accounts (Tier 2+ work).
- [ ] **HTTPS in production** — cookies are marked `secure` only when
      `NODE_ENV=production`; make sure your actual deployment terminates
      TLS (most PaaS hosts do this for you, but verify).
- [ ] **Rate limit store is in-memory** — resets on server restart and
      doesn't share state across multiple server instances; fine for a
      single-process deployment, not for horizontal scaling.

## Tier 1 — Needed for a real launch (not just a demo)

### Reliability
- [ ] Retry with backoff on transient OpenRouter errors (5xx, timeouts)
- [ ] Fallback model if the primary pick for a category is down/rate-limited
- [ ] Request timeout (currently a hung OpenRouter call hangs the request forever)
- [ ] Health check endpoint (`/api/health`) for uptime monitoring
- [ ] Structured logging (request id, category, model, latency, cost) instead of `console.log`

### Cost control
- [ ] Token usage tracking per request (OpenRouter returns this — currently discarded)
- [ ] Per-user or global daily/monthly spend cap with a hard stop
- [ ] Cost estimate shown before sending a request that'll route to an expensive model
- [ ] Usage dashboard (spend by category, by model, by day)

### Core UX
- [x] Streaming responses
- [ ] Markdown rendering in the chat bubble (currently plain text — code blocks look bad)
- [ ] Copy-to-clipboard button on responses
- [ ] Edit-and-resend a previous message
- [x] Stop/cancel button for an in-flight request
- [ ] Mobile-responsive layout check

### Data safety
- [ ] Input length limit (nothing currently caps message size before sending to a model)
- [ ] Sanitize/escape before rendering — check `client/app.js` isn't vulnerable to script injection via message content
- [ ] Backup/export of `brain-state.json` (single file, single point of loss)

---

## Tier 2 — High-value additions

### Routing intelligence
- [ ] Confidence score shown alongside the routing decision, not just the category
- [ ] User can thumbs-down a routing decision → feeds back into classifier tuning
- [ ] A/B test two models for the same category, track which performs better
- [ ] Per-user routing preference overrides ("always use Claude for coding")
- [ ] Multi-model consensus mode (README already suggests this): send to 2-3 models, show all answers side by side
- [ ] Cascade mode: try a cheap model first, escalate to an expensive one only if the answer looks weak
- [ ] Category confidence threshold — below X%, ask the user to confirm the category instead of guessing

### Memory (building on brainStore)
- [ ] Multiple named conversations (not just one global thread)
- [ ] Search past conversations/tasks
- [ ] Pin/star important decisions in `decisions_log`
- [ ] Export a task's full history (plan + decisions + summary) as a shareable doc
- [ ] Configurable `RECENT_MESSAGE_LIMIT` per conversation (long research threads may want more raw context)
- [ ] Manual "forget this" — let a user clear chat_summary/recent_messages without wiping current_task

### File & media handling
- [ ] Image upload for the vision category (README already flags this)
- [ ] PDF upload → long_context category
- [ ] CSV/spreadsheet upload → data category
- [ ] Voice input (speech-to-text before classification)
- [ ] Generated file download (if a model produces code/a doc, offer it as a file, not just chat text)

### Admin & ops
- [ ] Admin panel to edit `MODEL_REGISTRY` without redeploying
- [ ] Live model availability check (ping OpenRouter's model list, warn if a registered model was deprecated)
- [ ] Category keyword editor in the UI (no more hand-editing `classifier.js`)
- [ ] Audit log of who changed routing config and when

---

## Tier 3 — Differentiators (worth doing once core is solid)

- [ ] Team/workspace mode — shared brain across a small team, not per-user isolated
- [ ] Slack/Discord bot front-end using the same router
- [ ] Browser extension — right-click "ask Sia" on any selected text
- [ ] API access for developers to hit Sia's router directly (you become the OpenRouter-of-OpenRouter)
- [ ] Scheduled/recurring loop tasks (cron-triggered `loop.js` runs — e.g. "summarize my inbox every morning")
- [ ] Plugin system — let a category call an external tool (web search, calculator, code execution) before or after the model call
- [ ] Custom category builder — non-technical users define a new category + its ideal model from the UI
- [ ] Cost-vs-quality slider — user picks "cheapest acceptable" vs "best possible" per request
- [ ] Model leaderboard — real usage data on which model actually performs best per category for *your* users, not just vendor claims

---

## Explicitly out of scope for now (don't build these yet)

- Fine-tuning your own models — defeats the point of a routing layer
- Building your own model — same reason
- Full enterprise SSO/SAML — premature before you have paying teams

---

## How to use this file

Work top to bottom by tier. Tier 0 isn't optional if anyone besides you will
ever use this — skipping it is how side projects end up with a leaked API
key or a surprise five-figure OpenRouter bill. Everything below Tier 1 is
genuinely optional and should be driven by what your actual users ask for,
not by working through this list for its own sake.
