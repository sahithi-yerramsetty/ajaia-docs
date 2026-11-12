# Architecture Note

## Overview
One deployable service. FastAPI serves the JSON API under `/api/*` and also serves the built React app. Data lives in Neon Postgres, so it survives restarts on free hosting.

```
Browser (React + TipTap)
      │  /api/*  (X-User-Id header = mocked login)
      ▼
FastAPI (Render, Docker) ──► Neon Postgres (users, documents, shares)
      │
      └──► Groq API (AI Assist, server-side only)
```

## What I prioritized and why
1. **Core flows working end to end first:** create → edit → save → reopen → share → view as another user. Everything else was built on top of that.
2. **Permissions enforced on the server.** One `load_doc()` helper checks access for every document route (viewer < editor < owner). The UI hides buttons too, but the API is the real gate, and tests prove it.
3. **Simple, reliable persistence.** Content is stored as HTML. TipTap reads and writes HTML, and uploaded files (.md, .docx) convert straight to HTML. TipTap also drops tags it doesn't support, so imported content stays clean.
4. **One deploy instead of two.** Serving the frontend from FastAPI avoids CORS setup and gives reviewers a single URL.
5. **Tests on the risky parts:** access control, validation, file import and AI failure handling. Not on UI styling.

## Key decisions and trade-offs
| Decision | Why | Trade-off |
|---|---|---|
| Mocked login (user switcher + header) | Reviewers can test sharing in seconds | Not secure; real auth needed for production |
| Autosave with ~1s debounce | Feels like Google Docs, fewer requests | Last write wins if two people edit at once |
| Upload creates a new doc (.txt, .md, .docx, max 2 MB) | Clear, useful behavior; easy to validate | No import into an existing doc, no attachments |
| Postgres (Neon) over SQLite in production | Render's free disk is wiped on restart | One more service to set up |
| AI calls only from the backend | API key never reaches the browser; input limits enforced | Adds a little latency |
| AI result shown as a preview, not auto-applied | User stays in control; AI can be wrong | One extra click |
| AI output inserted as plain text, not HTML | Avoids injecting markup from model output | AI can't add formatting |
| Model name set by env var (`GROQ_MODEL`) | Providers retire models; no code change needed | None really |

## Intentionally left out
- Real-time co-editing (needs CRDT/websockets, e.g. Yjs). Too big for the timebox.
- Comments, version history, real authentication, file attachments.

## What I'd build next (2–4 hours)
1. **Real auth** (email magic link or OAuth) to replace the user switcher.
2. **Conflict protection:** send the doc's `updated_at` with each save and warn if someone else saved in between.
3. **Version snapshots:** save a copy on each major change, with a "restore" button.
4. **Export** a doc as `.md` or `.docx`.
5. **Frontend tests** (Playwright) for the main flow.




# AI Workflow Note

## Tools I used
- **Claude (chat):** planning the scope, generating the first version of the backend, frontend, tests, Dockerfile and docs, and debugging errors step by step.
- **Groq API (openai/gpt-oss-120b):** powers the AI Assist feature inside the product.
- **GitHub Codespaces:** dev environment (my laptop ran out of disk space, so I moved to a cloud environment).

## Where AI materially sped up my work
- **Scaffolding:** FastAPI models and routes, the TipTap editor setup and the toolbar came together in minutes, not hours.
- **Test writing:** permission tests (viewer vs editor vs owner) and AI tests with a fake LLM function.
- **Debugging:** reading error messages quickly (a failed virtualenv turned out to be a full disk; a 404 from Groq turned out to be a retired model).
- **Docs:** first drafts of the README and this note.

## What I changed or rejected
- **Storage format:** the first plan was to store TipTap JSON. I switched to HTML, because uploads (.md, .docx) convert naturally to HTML and TipTap cleans unsupported tags anyway.
- **Database:** I didn't use SQLite in production. I chose Neon Postgres because Render's free tier wipes local files on restart.
- **AI model:** the suggested model (`llama-3.3-70b-versatile`) had been retired by Groq. I listed the available models with the API, tested `openai/gpt-oss-120b` with a small script before switching, and made the model an env var so the next change won't need a code change.
- **Bugs fixed during testing:** a component file named with the wrong case (`app.jsx` vs `App.jsx`) broke the build, and the AI result card scrolled out of view on long documents, so I made it sticky.

## How I verified correctness and quality
- **Automated tests:** 12 pytest tests run before each commit (access control, validation, import, AI behavior). The AI tests mock the model call, so they don't need network access or API credits.
- **Manual end-to-end checks** on both local and the live URL: create → format → refresh → share → switch user → view-only check → upload → AI Assist.
- **Security checks:** confirmed with `git status` that `.env` is never committed; API keys only live in Render environment variables; AI output is inserted as plain text.
- **API checks:** `/api/health`, `/api/users` and `/api/ai/status` on the deployed app to confirm the database and AI were connected.
- **UX review:** clicked through as each user role and checked error messages for bad uploads and empty titles.
