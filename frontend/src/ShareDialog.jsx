import { useEffect, useState } from "react";
import { api } from "./api.js";
import Avatar from "./Avatar.jsx";
import { useToast } from "./Toast.jsx";

export default function ShareDialog({ doc, users, me, onChange, onClose }) {
  const sharedIds = new Set(doc.shares.map((s) => s.user_id));
  const candidates = users.filter((u) => u.id !== me.id && !sharedIds.has(u.id));
  const [email, setEmail] = useState(candidates[0]?.email || "");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { setEmail(candidates[0]?.email || ""); }, [doc.shares.length]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function share(e) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      onChange(await api.share(doc.id, email, role));
      const name = users.find((u) => u.email === email)?.name;
      toast(`Shared with ${name} (${role === "editor" ? "can edit" : "can view"})`, "success");
    } catch (err) { toast(err.message, "error"); } finally { setBusy(false); }
  }

  async function changeRole(s, newRole) {
    try { onChange(await api.share(doc.id, s.email, newRole)); toast(`${s.name} can now ${newRole === "editor" ? "edit" : "view"}`, "success"); }
    catch (err) { toast(err.message, "error"); }
  }

  async function remove(s) {
    try { onChange(await api.unshare(doc.id, s.user_id)); toast(`Removed ${s.name}'s access`, "success"); }
    catch (err) { toast(err.message, "error"); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); toast("Link copied", "success"); }
    catch { toast("Couldn't copy the link", "error"); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Share document"
        onMouseDown={(e) => e.stopPropagation()}>
        <h3>Share "{doc.title}"</h3>

        {candidates.length > 0 ? (
          <form className="share-form" onSubmit={share}>
            <select value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Person">
              {candidates.map((u) => <option key={u.id} value={u.email}>{u.name} ({u.email})</option>)}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Access level">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button className="primary" type="submit" disabled={busy}>Share</button>
          </form>
        ) : <p className="muted">Everyone already has access.</p>}

        <h4>People with access</h4>
        <ul className="people">
          <li><Avatar user={me} /> <span className="person">{me.name} (you)</span><span className="muted">Owner</span></li>
          {doc.shares.map((s) => (
            <li key={s.user_id}>
              <Avatar user={{ id: s.user_id, name: s.name, email: s.email }} />
              <span className="person">{s.name}<small>{s.email}</small></span>
              <select value={s.role} onChange={(e) => changeRole(s, e.target.value)} aria-label={`${s.name}'s access`}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button className="icon-btn" title="Remove access" aria-label={`Remove ${s.name}`} onClick={() => remove(s)}>✕</button>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button onClick={copyLink}>🔗 Copy link</button>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
