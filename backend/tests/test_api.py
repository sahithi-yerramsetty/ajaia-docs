import io
import os
import sys

# Use a fresh SQLite file for tests (must be set before importing the app)
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from database import Base, engine
from main import app

ALICE, BOB, CAROL = {"X-User-Id": "1"}, {"X-User-Id": "2"}, {"X-User-Id": "3"}


@pytest.fixture(autouse=True)
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:  # runs startup: create tables + seed users
        yield c


def make_doc(client, headers=ALICE, title="Plan"):
    r = client.post("/api/documents", json={"title": title, "content": "<p>hi</p>"}, headers=headers)
    assert r.status_code == 201
    return r.json()["id"]


def test_requires_user(client):
    assert client.get("/api/documents").status_code == 401


def test_owner_can_create_rename_and_reopen(client):
    doc_id = make_doc(client)
    r = client.patch(f"/api/documents/{doc_id}",
                     json={"title": "Q4 Plan", "content": "<p><strong>bold</strong></p>"},
                     headers=ALICE)
    assert r.status_code == 200
    r = client.get(f"/api/documents/{doc_id}", headers=ALICE)
    assert r.json()["title"] == "Q4 Plan"
    assert "<strong>bold</strong>" in r.json()["content"]  # formatting persisted


def test_empty_title_rejected(client):
    doc_id = make_doc(client)
    r = client.patch(f"/api/documents/{doc_id}", json={"title": "   "}, headers=ALICE)
    assert r.status_code == 422


def test_unshared_user_is_blocked(client):
    doc_id = make_doc(client)
    assert client.get(f"/api/documents/{doc_id}", headers=BOB).status_code == 403


def test_viewer_can_read_but_not_edit(client):
    doc_id = make_doc(client)
    r = client.post(f"/api/documents/{doc_id}/shares",
                    json={"email": "bob@ajaia.dev", "role": "viewer"}, headers=ALICE)
    assert r.status_code == 201

    assert client.get(f"/api/documents/{doc_id}", headers=BOB).status_code == 200
    r = client.patch(f"/api/documents/{doc_id}", json={"content": "<p>hack</p>"}, headers=BOB)
    assert r.status_code == 403

    # Shows up under Bob's "shared", not "owned"
    lists = client.get("/api/documents", headers=BOB).json()
    assert lists["owned"] == []
    assert [d["id"] for d in lists["shared"]] == [doc_id]


def test_editor_can_edit_but_not_share(client):
    doc_id = make_doc(client)
    client.post(f"/api/documents/{doc_id}/shares",
                json={"email": "bob@ajaia.dev", "role": "editor"}, headers=ALICE)
    r = client.patch(f"/api/documents/{doc_id}", json={"content": "<p>edit</p>"}, headers=BOB)
    assert r.status_code == 200
    r = client.post(f"/api/documents/{doc_id}/shares",
                    json={"email": "carol@ajaia.dev"}, headers=BOB)
    assert r.status_code == 403


def test_import_markdown_creates_doc(client):
    f = ("notes.md", io.BytesIO(b"# Title\n\n- one\n- two"), "text/markdown")
    r = client.post("/api/documents/import", files={"file": f}, headers=ALICE)
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "notes"
    assert "<h1>Title</h1>" in body["content"] and "<li>one</li>" in body["content"]


def test_import_rejects_unsupported_type(client):
    f = ("photo.png", io.BytesIO(b"\x89PNG"), "image/png")
    r = client.post("/api/documents/import", files={"file": f}, headers=ALICE)
    assert r.status_code == 400