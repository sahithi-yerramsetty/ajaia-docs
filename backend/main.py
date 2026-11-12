from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from importers import file_to_html, ImportError_
from ai import ai_enabled, run_action, AIError, MAX_INPUT_CHARS, PROMPTS
from models import User, Document, Share
from seed import seed_users

MAX_CONTENT_CHARS = 1_000_000


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    seed_users()
    yield


app = FastAPI(title="Ajaia Docs", lifespan=lifespan)


# ---------- Mock auth: the frontend sends the chosen user's id in a header ----------
def current_user(
    x_user_id: Optional[int] = Header(default=None), db: Session = Depends(get_db)
) -> User:
    if x_user_id is None:
        raise HTTPException(401, "Missing X-User-Id header")
    user = db.get(User, x_user_id)
    if not user:
        raise HTTPException(401, "Unknown user")
    return user


def role_for(doc: Document, user: User) -> Optional[str]:
    if doc.owner_id == user.id:
        return "owner"
    for s in doc.shares:
        if s.user_id == user.id:
            return s.role
    return None


def load_doc(doc_id: int, user: User, db: Session, need: str = "viewer"):
    """Fetch a doc and check the user's access. need = viewer | editor | owner."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    role = role_for(doc, user)
    if role is None:
        raise HTTPException(403, "You don't have access to this document")
    rank = {"viewer": 1, "editor": 2, "owner": 3}
    if rank[role] < rank[need]:
        raise HTTPException(403, f"This action needs {need} access")
    return doc, role


# ---------- Schemas ----------
class DocCreate(BaseModel):
    title: str = "Untitled document"
    content: str = ""


class DocUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = Field(default=None, max_length=MAX_CONTENT_CHARS)

    @field_validator("title")
    @classmethod
    def check_title(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title can't be empty")
        if len(v) > 200:
            raise ValueError("Title must be 200 characters or less")
        return v


class ShareCreate(BaseModel):
    email: str
    role: Literal["viewer", "editor"] = "viewer"


def summary(doc: Document, role: str) -> dict:
    return {
        "id": doc.id,
        "title": doc.title,
        "owner": {"id": doc.owner.id, "name": doc.owner.name, "email": doc.owner.email},
        "role": role,
        "updated_at": doc.updated_at,
    }


def detail(doc: Document, role: str) -> dict:
    data = summary(doc, role)
    data["content"] = doc.content
    if role == "owner":
        data["shares"] = [
            {"user_id": s.user.id, "name": s.user.name, "email": s.user.email, "role": s.role}
            for s in doc.shares
        ]
    return data


# ---------- Routes ----------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    return [{"id": u.id, "email": u.email, "name": u.name} for u in users]


@app.get("/api/documents")
def list_documents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned = (
        db.query(Document).filter(Document.owner_id == user.id)
        .order_by(Document.updated_at.desc()).all()
    )
    shared = (
        db.query(Share).join(Document).filter(Share.user_id == user.id)
        .order_by(Document.updated_at.desc()).all()
    )
    return {
        "owned": [summary(d, "owner") for d in owned],
        "shared": [summary(s.document, s.role) for s in shared],
    }


@app.post("/api/documents", status_code=201)
def create_document(
    body: DocCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    title = body.title.strip() or "Untitled document"
    doc = Document(title=title[:200], content=body.content, owner_id=user.id)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return detail(doc, "owner")


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc, role = load_doc(doc_id, user, db)
    return detail(doc, role)


@app.patch("/api/documents/{doc_id}")
def update_document(
    doc_id: int, body: DocUpdate,
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    doc, role = load_doc(doc_id, user, db, need="editor")
    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        doc.content = body.content
    db.commit()
    db.refresh(doc)
    return detail(doc, role)


@app.delete("/api/documents/{doc_id}", status_code=204)
def delete_document(doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc, _ = load_doc(doc_id, user, db, need="owner")
    db.delete(doc)
    db.commit()


@app.post("/api/documents/{doc_id}/shares", status_code=201)
def share_document(
    doc_id: int, body: ShareCreate,
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    doc, _ = load_doc(doc_id, user, db, need="owner")
    target = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not target:
        raise HTTPException(404, "No user with that email")
    if target.id == user.id:
        raise HTTPException(400, "You already own this document")
    share = db.query(Share).filter_by(document_id=doc.id, user_id=target.id).first()
    if share:
        share.role = body.role  # update role if already shared
    else:
        db.add(Share(document_id=doc.id, user_id=target.id, role=body.role))
    db.commit()
    db.refresh(doc)
    return detail(doc, "owner")


@app.delete("/api/documents/{doc_id}/shares/{user_id}")
def unshare_document(
    doc_id: int, user_id: int,
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    doc, _ = load_doc(doc_id, user, db, need="owner")
    share = db.query(Share).filter_by(document_id=doc.id, user_id=user_id).first()
    if not share:
        raise HTTPException(404, "That user doesn't have access")
    db.delete(share)
    db.commit()
    db.refresh(doc)
    return detail(doc, "owner")


@app.post("/api/documents/import", status_code=201)
async def import_document(
    file: UploadFile = File(...),
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    data = await file.read()
    try:
        content = file_to_html(file.filename or "", data)
    except ImportError_ as e:
        raise HTTPException(400, str(e))
    title = Path(file.filename or "Imported document").stem[:200] or "Imported document"
    doc = Document(title=title, content=content, owner_id=user.id)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return detail(doc, "owner")


# ---------- AI Assist ----------
class AssistRequest(BaseModel):
    action: Literal["summarize", "fix_grammar", "shorten", "professional"]
    text: str = Field(min_length=1, max_length=MAX_INPUT_CHARS)


@app.get("/api/ai/status")
def ai_status():
    return {"enabled": ai_enabled(), "actions": list(PROMPTS)}


@app.post("/api/ai/assist")
def ai_assist(body: AssistRequest, user: User = Depends(current_user)):
    if not ai_enabled():
        raise HTTPException(503, "AI Assist is not configured on this server")
    if not body.text.strip():
        raise HTTPException(422, "Select some text first")
    try:
        return {"result": run_action(body.action, body.text)}
    except AIError as e:
        raise HTTPException(502, str(e))


# ---------- Serve the built React app (production) ----------
# API routes above take priority; everything else serves the frontend.
from fastapi.staticfiles import StaticFiles

for candidate in (Path(__file__).parent / "static", Path(__file__).parent.parent / "frontend" / "dist"):
    if candidate.is_dir():
        app.mount("/", StaticFiles(directory=candidate, html=True), name="frontend")
        break
