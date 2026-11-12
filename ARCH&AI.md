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

## How I worked
I owned the product decisions, setup, integration, testing and deployment, and used AI as a pair programmer to move faster on drafting code and docs.

**What I drove myself**
- **Scope and product decisions:** chose which features to build for the timebox, what to cut (real-time editing, real auth), and to add an AI-native feature inside the product.
- **AI Assist feature:** decided to build AI into the editor and how it should behave: a preview before applying, plain-text insertion, input limits, and hiding the button when no key is set.
- **Environment and deployment:** set up the project in GitHub Codespaces when my local machine ran out of disk space; set up Neon Postgres, Render (Docker), Groq, and all environment variables and secrets.
- **Debugging and fixes:** traced AI Assist failures to a retired Groq model by testing the API directly, compared the available models, tested the replacement before switching, and made the model configurable. Also fixed a build failure caused by a file-name case mismatch.
- **Testing and review:** ran the full user flow as each role (owner, editor, viewer) locally and on the live URL, checked error handling for bad uploads and empty titles, and verified secrets were never committed.
- **Documentation and delivery:** edited all docs, chose the roadmap, took screenshots and recorded the walkthrough.

## Where AI helped
- **Tools:** Claude (chat) as a coding assistant; Groq API (`openai/gpt-oss-120b`) inside the product.
- **Architecture:** talked through options and trade-offs before settling on FastAPI + React + Postgres in one Docker service.
- **Code drafts:** first versions of API routes, permission checks, editor UI and styling, which I reviewed, ran, tested and adjusted.
- **Tests and docs:** drafted test cases and first drafts of the README and notes.

## What I changed or rejected
- **Storage format:** switched from TipTap JSON to HTML, so uploaded files convert cleanly.
- **Database:** chose Neon Postgres over SQLite because Render's free tier wipes local files.
- **AI model:** replaced the retired model after testing alternatives; moved the model name into an env var.
- **UX fix:** made the AI result card stay visible on long documents.

## How I verified quality
- **12 automated tests** (access control, validation, file import, AI behavior with a mocked model).
- **Manual end-to-end checks** on local and live: create → format → refresh → share → switch user → view-only → upload → AI Assist.
- **Security:** API keys only in Render environment variables; `.env` excluded from git; AI output inserted as plain text.
- **Deployment health checks:** `/api/health`, `/api/users`, `/api/ai/status`.

## With more time
- Real login with authentication (magic link or Google sign-in)
- Download a document as .docx, .md or PDF
- Frontend improvements: mobile layout, loading states, shortcuts panel
