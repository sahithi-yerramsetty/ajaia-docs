import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

import ai
from database import Base, engine
from main import app

ALICE = {"X-User-Id": "1"}


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


def test_ai_disabled_without_key(client, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert client.get("/api/ai/status").json()["enabled"] is False
    r = client.post("/api/ai/assist", json={"action": "summarize", "text": "hi"}, headers=ALICE)
    assert r.status_code == 503


def test_ai_assist_returns_result(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    calls = {}

    def fake_llm(instruction, text):  # no real network call in tests
        calls["instruction"], calls["text"] = instruction, text
        return "Fixed text."

    monkeypatch.setattr(ai, "call_llm", fake_llm)
    r = client.post("/api/ai/assist", json={"action": "fix_grammar", "text": "fixd txt"}, headers=ALICE)
    assert r.status_code == 200
    assert r.json()["result"] == "Fixed text."
    assert calls["text"] == "fixd txt"
    assert "grammar" in calls["instruction"].lower()


def test_ai_rejects_bad_input(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    too_long = "a" * (ai.MAX_INPUT_CHARS + 1)
    assert client.post("/api/ai/assist", json={"action": "summarize", "text": too_long},
                       headers=ALICE).status_code == 422
    assert client.post("/api/ai/assist", json={"action": "write_poem", "text": "x"},
                       headers=ALICE).status_code == 422
    assert client.post("/api/ai/assist", json={"action": "summarize", "text": "x"}).status_code == 401


def test_ai_service_failure_is_friendly(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    def broken(instruction, text):
        raise ai.AIError("The AI service is unavailable right now.")

    monkeypatch.setattr(ai, "call_llm", broken)
    r = client.post("/api/ai/assist", json={"action": "shorten", "text": "x"}, headers=ALICE)
    assert r.status_code == 502
    assert "unavailable" in r.json()["detail"]
