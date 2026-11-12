# Submission: Ajaia Docs

## Links
- **Live app:** https://ajaia-docs-gyu6.onrender.com
  *(Free hosting: the first load after idle can take ~50 seconds.)*
- **Source code (GitHub):** https://github.com/sahithi-yerramsetty/ajaia-docs
- **Walkthrough video:** see `VIDEO_URL.txt`

## Test accounts
No password needed. Switch users with the **"Signed in as"** dropdown (top right).

| User  | Email           |
|-------|-----------------|
| Alice | alice@ajaia.dev |
| Bob   | bob@ajaia.dev   |
| Carol | carol@ajaia.dev |

**Suggested review flow (3 min):**
1. As **Alice**: create a document, rename it, add headings, bold and a list, then refresh. Content is kept.
2. Click **Share** → add **Bob** as Viewer.
3. Switch to **Bob**: the document is under **Shared with me** and opens view-only.
4. Back as **Alice**: click **Upload a file** and pick a `.txt`, `.md` or `.docx` file. It opens as a new document.
5. Select some text → **✨ AI Assist** → Fix grammar → Replace selection.

## What's included in this folder
| Item | Description |
|---|---|
| `ajaia-docs-source.zip` | Full source code (backend, frontend, tests, Dockerfile) |
| `README.md` | Features, local setup, run and test instructions |
| `ARCHITECTURE.md` | What I prioritized, key decisions and trade-offs |
| `AI_NOTES.md` | How I worked, where AI helped, what I changed, how I verified |
| `SUBMISSION.md` | This file |
| `VIDEO_URL.txt` | Link to the 3–5 minute walkthrough video |
| `screenshots/` | 6 screenshots of the main flows (also shown below) |

## Local setup (short version)
Full steps are in `README.md`.
```bash
# Terminal 1: backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Terminal 2: frontend
cd frontend
npm install && npm run dev
```
Open http://localhost:5173. Optional: add `GROQ_API_KEY` to `backend/.env` to enable AI Assist.

Run tests: `cd backend && python -m pytest -q` (12 tests)

## Status

**Working end to end**
- Create, rename, edit, autosave, reopen and delete documents
- Rich text: bold, italic, underline, strikethrough, headings, lists, quote, code block
- File upload (.txt, .md, .docx → new editable document) with validation and clear errors
- Sharing with Viewer / Editor roles, change role, remove access; "My documents" vs "Shared with me"
- Permissions enforced on the server, not just hidden in the UI
- Persistence in Postgres (Neon); formatting kept after refresh
- AI Assist (summarize, fix grammar, shorten, make professional) with a preview before applying
- 12 automated backend tests

**Intentionally not included**
- Real-time co-editing (last save wins)
- Real authentication (demo user switcher instead)
- Comments, version history, file attachments

**Next with 2–4 more hours**
1. **Real login with authentication** (email magic link or Google sign-in) instead of the demo user switcher
2. **Download a document** as .docx, .md or PDF
3. **Frontend improvements:** better mobile layout, loading states, keyboard shortcuts panel
4. **Save-conflict warning** when two people edit the same doc at the same time

## Screenshots

### 1. Home page
Start a blank document or upload a file. Documents are split into **My documents** and **Shared with me**, with search by title.

<img width="1440" height="900" alt="Screenshot 2026-11-12 at 3 07 41 PM" src="https://github.com/user-attachments/assets/65b15b1e-8856-4b5f-a463-5a6b1561c670" />


### 2. Editor
Rich-text editing with headings, bold, lists and more. Changes autosave and the status shows **Saved**.

<img width="1440" height="900" alt="Screenshot 2026-11-12 at 3 06 56 PM" src="https://github.com/user-attachments/assets/bb7d04c4-4926-49a8-ba18-31a4bab0c7be" />


### 3. Sharing
The owner shares a document as **Viewer** or **Editor**, can change roles, and can remove access.

<img width="1440" height="900" alt="Screenshot 2026-11-12 at 3 08 10 PM" src="https://github.com/user-attachments/assets/1e1bee81-8c7f-414c-93de-c5153f33d526" />


### 4. Shared with me
Signed in as Bob, the document Alice shared appears under **Shared with me**.

<img width="1440" height="900" alt="Screenshot 2026-11-12 at 3 08 19 PM" src="https://github.com/user-attachments/assets/d3ce3d51-bfc5-4878-ac42-5eb7d3f9b455" />


### 5. View-only access
A viewer can read but not edit. The toolbar is hidden and a banner explains why. The server also blocks edits.

<img width="1440" height="900" alt="Screenshot 2026-11-12 at 3 08 19 PM" src="https://github.com/user-attachments/assets/5efcd2f8-5dc1-49b3-9a5c-fbd53792bd76" />


### 6. AI Assist
Select text → ✨ AI Assist → pick an action. The result shows in a preview card, and the user chooses to replace, insert, copy or discard.

<img width="1440" height="900" alt="Screenshot 2026-11-12 at 3 09 49 PM" src="https://github.com/user-attachments/assets/a753c0d0-3c66-4795-a7c2-eaa0ecb09773" />
