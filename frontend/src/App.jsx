import { useEffect, useState } from "react";
import { api, setUser } from "./api.js";
import Avatar from "./Avatar.jsx";
import DocList from "./DocList.jsx";
import DocEditor from "./DocEditor.jsx";

// The open doc lives in the URL hash (#/doc/5) so refresh reopens it.
function readDocId() {
  const m = window.location.hash.match(/^#\/doc\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function savedUserId() {
  try { return Number(localStorage.getItem("userId")) || null; } catch { return null; }
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(savedUserId);
  const [docId, setDocId] = useState(readDocId);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.users()
      .then((list) => {
        setUsers(list);
        if (!list.some((u) => u.id === userId) && list.length) setUserId(list[0].id);
      })
      .catch(() => setError("Can't reach the server. Is the backend running?"));
    api.aiStatus().then((s) => setAiEnabled(s.enabled)).catch(() => setAiEnabled(false));
  }, []);

  useEffect(() => {
    const onHash = () => setDocId(readDocId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (userId) {
    setUser(userId);
    try { localStorage.setItem("userId", String(userId)); } catch {}
  }

  const me = users.find((u) => u.id === userId);
  const openDoc = (id) => (window.location.hash = id ? `#/doc/${id}` : "");

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => openDoc(null)}>
          <span className="brand-icon">▤</span> Ajaia Docs
        </a>
        <div className="user-switch">
          <span className="muted">Signed in as</span>
          <Avatar user={me} />
          <select aria-label="Switch user" value={userId || ""}
            onChange={(e) => { setUserId(Number(e.target.value)); openDoc(null); }}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
        </div>
      </header>

      {error && <div className="page"><div className="banner error">{error}</div></div>}

      <main>
        {userId && me && (docId
          ? <DocEditor key={`${userId}-${docId}`} docId={docId} users={users} me={me}
              aiEnabled={aiEnabled} onBack={() => openDoc(null)} />
          : <DocList key={userId} me={me} onOpen={openDoc} />)}
      </main>
    </div>
  );
}
