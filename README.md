# Ajaia Docs

A lightweight collaborative document editor inspired by Google Docs. Users can create and edit rich-text documents, import files, share documents with other users, and use AI Assist to improve their writing.

**Live app:** https://YOUR-APP.onrender.com  *(free tier: the first load after idle can take ~50 seconds while the server wakes up)*

---

## Test accounts

There is no password login. Authentication is mocked so reviewers can test sharing quickly.
Use the **"Signed in as"** dropdown in the top-right corner to switch users.

| User  | Email           |
|-------|-----------------|
| Alice | alice@ajaia.dev |
| Bob   | bob@ajaia.dev   |
| Carol | carol@ajaia.dev |

**Quick sharing test:** sign in as Alice → create a document → click **Share** → add Bob as Viewer → switch to Bob → the document appears under **Shared with me** and opens in view-only mode.

---

## Features

**Documents**
- Create, rename, edit, and delete documents
- Autosave (about 1 second after you stop typing), plus `Cmd/Ctrl + S` to save right away
- Warning before closing the tab with unsaved changes
- Documents reopen after refresh with formatting preserved

**Rich-text editing**
- Bold, italic, underline, strikethrough
- Normal text, Heading 1, 2, 3
- Bulleted and numbered lists, quote, code block, divider
- Undo / redo, word and character count

**File upload**
- Upload a file to turn it into a new editable document
- **Supported types:** `.txt`, `.md`, `.docx` (max 2 MB)
- Markdown headings and lists, and Word formatting, are converted into editor formatting
- Unsupported, empty, or oversized files show a clear error message

**Sharing**
- Every document has one owner
- The owner can share with another user as **Viewer** (read only) or **Editor** (can edit)
- The owner can change a person's role or remove access
- The home page separates **My documents** from **Shared with me**
- Permissions are enforced on the server, not only hidden in the UI

**AI Assist** (powered by Groq)
- Select text and choose: Summarize, Fix grammar & spelling, Make shorter, or Make it professional
- Summarize with no selection summarizes the whole document
- The result appears in a preview card first. The user chooses **Replace**, **Insert below**, **Copy**, or **Discard**
- If no API key is configured, the AI button is hidden and the rest of the app works normally

---

## Tech stack

| Part      | Choice |
|-----------|--------|
| Frontend  | React + Vite, TipTap rich-text editor |
| Backend   | Python, FastAPI, SQLAlchemy |
| Database  | PostgreSQL (Neon) in production, SQLite locally |
| AI        | Groq API (`openai/gpt-oss-120b`), called only from the backend |
| Tests     | pytest + FastAPI TestClient |
| Deploy    | Docker on Render (one service serves both the API and the frontend) |

---

## Run locally

**Requirements:** Python 3.10+ and Node 18+

### 1. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # optional: add a Groq key to enable AI Assist
python -m uvicorn main:app --reload --port 8000
```
With no `DATABASE_URL`, the app uses a local SQLite file (`backend/local.db`). The three test users are created automatically on startup.

### 2. Frontend (in a second terminal)
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. The dev server forwards `/api` calls to the backend on port 8000.

### Environment variables (`backend/.env`)

| Variable       | Required | Purpose |
|----------------|----------|---------|
| `DATABASE_URL` | No       | Postgres connection string. If empty, SQLite is used. |
| `GROQ_API_KEY` | No       | Turns on AI Assist. Free key at console.groq.com |
| `GROQ_MODEL`   | No       | Defaults to `openai/gpt-oss-120b` |

---

## Run tests
```bash
cd backend
source .venv/bin/activate
python -m pytest -q
```
12 tests cover:
- Login required for document APIs
- Create, rename, and reopen with formatting preserved
- Title validation
- Access blocked for users the document is not shared with
- Viewer can read but not edit
- Editor can edit but cannot share
- Markdown import, and rejection of unsupported file types
- AI Assist: disabled without a key, returns a result, rejects bad input, and handles service failures

The AI tests replace the real Groq call with a fake function, so they need no network or API key.

---

## Run with Docker (same as production)
```bash
docker build -t ajaia-docs .
docker run -p 8000:8000 -e GROQ_API_KEY=your_key ajaia-docs
```
Open http://localhost:8000

---

## Deployment

Deployed on **Render** as a Docker web service. The Dockerfile builds the React app, then runs FastAPI, which serves both `/api/*` and the built frontend from one URL.

Environment variables set in Render: `DATABASE_URL` (Neon Postgres) and `GROQ_API_KEY`.

---

## Project structure
```
backend/
  main.py          API routes, permission checks, serves the frontend in production
  models.py        User, Document, Share tables
  database.py      DB connection (Postgres or SQLite)
  importers.py     .txt / .md / .docx → HTML
  ai.py            Groq calls and prompts for AI Assist
  seed.py          Creates the 3 test users
  tests/           pytest tests
frontend/src/
  App.jsx          Top bar, user switcher, page switching
  DocList.jsx      Home page: new doc, upload, search, document cards
  DocEditor.jsx    Editor, toolbar, autosave, word count
  ShareDialog.jsx  Share with users, change role, remove access
  AiAssist.jsx     AI menu and preview card
Dockerfile         Builds frontend + backend into one image
```

---

## Known limitations

- **No real-time co-editing.** If two people edit the same document at the same time, the last save wins.
- **Mocked login.** Anyone can switch between the seeded users. This is fine for a demo, not for production.
- **Upload creates a new document only.** There is no import into an existing document or file attachments.
- **No version history or comments.**

See `ARCHITECTURE.md` for design decisions and `AI_NOTES.md` for how AI was used in building this.# ajaia-docs