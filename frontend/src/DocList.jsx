import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import Avatar from "./Avatar.jsx";
import { useToast } from "./Toast.jsx";
import { timeAgo } from "./utils.js";

function DocIcon() {
  return (
    <svg className="doc-icon" viewBox="0 0 40 48" aria-hidden="true">
      <path d="M4 0h22l14 14v30a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z" fill="#4285f4" />
      <path d="M26 0l14 14H30a4 4 0 0 1-4-4z" fill="#a1c2fa" />
      <rect x="9" y="22" width="22" height="3" rx="1.5" fill="#fff" />
      <rect x="9" y="29" width="22" height="3" rx="1.5" fill="#fff" />
      <rect x="9" y="36" width="14" height="3" rx="1.5" fill="#fff" />
    </svg>
  );
}

function DocCard({ doc, onOpen, onDelete }) {
  return (
    <div className="doc-card" role="button" tabIndex={0}
      onClick={() => onOpen(doc.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(doc.id)}>
      <div className="doc-card-top"><DocIcon /></div>
      <div className="doc-card-body">
        <div className="doc-card-title" title={doc.title}>{doc.title}</div>
        <div className="doc-card-meta">
          {doc.role === "owner"
            ? <>You · edited {timeAgo(doc.updated_at)}</>
            : <><Avatar user={doc.owner} size={18} /> {doc.owner.name} ·{" "}
                <span className="chip">{doc.role === "editor" ? "Can edit" : "View only"}</span></>}
        </div>
      </div>
      {onDelete && (
        <button className="icon-btn delete" title="Delete document" aria-label={`Delete ${doc.title}`}
          onClick={(e) => { e.stopPropagation(); onDelete(doc); }}>🗑</button>
      )}
    </div>
  );
}

export default function DocList({ me, onOpen }) {
  const [docs, setDocs] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const toast = useToast();

  const load = () => api.listDocs().then(setDocs).catch((e) => toast(e.message, "error"));
  useEffect(() => { load(); }, []);

  async function createDoc() {
    setBusy(true);
    try {
      const doc = await api.createDoc("Untitled document");
      onOpen(doc.id);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }

  async function uploadFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setBusy(true);
    try {
      const doc = await api.importFile(file);
      toast(`Imported "${file.name}"`, "success");
      onOpen(doc.id);
    } catch (err) { toast(`Upload failed: ${err.message}`, "error"); } finally { setBusy(false); }
  }

  async function deleteDoc(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    try {
      await api.deleteDoc(doc.id);
      toast("Document deleted", "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  }

  const match = (d) => d.title.toLowerCase().includes(query.trim().toLowerCase());
  const owned = docs?.owned.filter(match) || [];
  const shared = docs?.shared.filter(match) || [];

  return (
    <>
      <section className="start-strip">
        <div className="page">
          <h2 className="section-label">Start a new document</h2>
          <div className="start-options">
            <button className="start-tile" onClick={createDoc} disabled={busy}>
              <span className="start-tile-art plus">+</span>
              <span>Blank document</span>
            </button>
            <button className="start-tile" onClick={() => fileInput.current.click()} disabled={busy}>
              <span className="start-tile-art upload">⇪</span>
              <span>Upload a file</span>
            </button>
            <input ref={fileInput} type="file" accept=".txt,.md,.docx" hidden onChange={uploadFile} />
            <p className="hint">Upload turns a <b>.txt</b>, <b>.md</b> or <b>.docx</b> file (max 2 MB) into a new editable document.</p>
          </div>
        </div>
      </section>

      <div className="page">
        <div className="list-header">
          <h2 className="section-label">Hi {me.name} 👋</h2>
          <input className="search" type="search" placeholder="Search documents by title"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search documents" />
        </div>

        {!docs ? <p className="muted">Loading…</p> : (
          <>
            <h3 className="group-title">My documents <span className="count">{owned.length}</span></h3>
            {owned.length === 0
              ? <p className="empty">{query ? "No matches." : "No documents yet. Start a blank one or upload a file."}</p>
              : <div className="doc-grid">{owned.map((d) =>
                  <DocCard key={d.id} doc={d} onOpen={onOpen} onDelete={deleteDoc} />)}</div>}

            <h3 className="group-title">Shared with me <span className="count">{shared.length}</span></h3>
            {shared.length === 0
              ? <p className="empty">{query ? "No matches." : "Nothing shared with you yet. Try switching users in the top-right."}</p>
              : <div className="doc-grid">{shared.map((d) =>
                  <DocCard key={d.id} doc={d} onOpen={onOpen} />)}</div>}
          </>
        )}
      </div>
    </>
  );
}
