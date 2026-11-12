import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { api } from "./api.js";
import Avatar from "./Avatar.jsx";
import ShareDialog from "./ShareDialog.jsx";
import { AiButton, AiResult } from "./AiAssist.jsx";
import { useToast } from "./Toast.jsx";

const SAVE_DELAY_MS = 800;

function Toolbar({ editor, aiEnabled, onAiResult }) {
  if (!editor) return null;
  const btn = (label, isActive, run, title) => (
    <button type="button" title={title} aria-label={title} aria-pressed={isActive}
      className={isActive ? "active" : ""}
      onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>
  );
  const chain = () => editor.chain().focus();
  const headingValue = editor.isActive("heading", { level: 1 }) ? "1"
    : editor.isActive("heading", { level: 2 }) ? "2"
    : editor.isActive("heading", { level: 3 }) ? "3" : "0";

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {btn("↶", false, () => chain().undo().run(), "Undo (Ctrl+Z)")}
      {btn("↷", false, () => chain().redo().run(), "Redo (Ctrl+Shift+Z)")}
      <span className="sep" />
      <select className="style-select" aria-label="Text style" value={headingValue}
        onChange={(e) => {
          const level = Number(e.target.value);
          level ? chain().setHeading({ level }).run() : chain().setParagraph().run();
        }}>
        <option value="0">Normal text</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
      <span className="sep" />
      {btn(<b>B</b>, editor.isActive("bold"), () => chain().toggleBold().run(), "Bold (Ctrl+B)")}
      {btn(<i>I</i>, editor.isActive("italic"), () => chain().toggleItalic().run(), "Italic (Ctrl+I)")}
      {btn(<u>U</u>, editor.isActive("underline"), () => chain().toggleUnderline().run(), "Underline (Ctrl+U)")}
      {btn(<s>S</s>, editor.isActive("strike"), () => chain().toggleStrike().run(), "Strikethrough")}
      <span className="sep" />
      {btn("• ≡", editor.isActive("bulletList"), () => chain().toggleBulletList().run(), "Bulleted list")}
      {btn("1. ≡", editor.isActive("orderedList"), () => chain().toggleOrderedList().run(), "Numbered list")}
      {btn("❝", editor.isActive("blockquote"), () => chain().toggleBlockquote().run(), "Quote")}
      {btn("</>", editor.isActive("codeBlock"), () => chain().toggleCodeBlock().run(), "Code block")}
      {btn("―", false, () => chain().setHorizontalRule().run(), "Divider")}
      {aiEnabled && <><span className="spacer" /><AiButton editor={editor} onResult={onAiResult} /></>}
    </div>
  );
}

function SaveStatus({ status }) {
  const map = {
    saving: ["⟳", "Saving…"],
    unsaved: ["●", "Unsaved changes"],
    saved: ["☁", "Saved"],
    error: ["⚠", "Not saved"],
  };
  if (!map[status]) return null;
  const [icon, text] = map[status];
  return <span className={`save-status ${status}`}><span aria-hidden="true">{icon}</span> {text}</span>;
}

export default function DocEditor({ docId, users, me, aiEnabled, onBack }) {
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const saveTimer = useRef(null);
  const dirty = useRef(false);
  const toast = useToast();

  const canEdit = doc && doc.role !== "viewer";

  function updateCounts(ed) {
    const text = ed.getText();
    setCounts({ words: (text.match(/\S+/g) || []).length, chars: text.length });
  }

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: "",
    editable: false,
    shouldRerenderOnTransaction: true, // keeps toolbar buttons' active state fresh
    onUpdate: ({ editor }) => {
      dirty.current = true;
      setStatus("unsaved");
      updateCounts(editor);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save({ content: editor.getHTML() }), SAVE_DELAY_MS);
    },
  });

  async function save(changes) {
    setStatus("saving");
    try {
      const updated = await api.updateDoc(docId, changes);
      setDoc((d) => ({ ...d, ...updated, content: d.content }));
      if (changes.content !== undefined) dirty.current = false;
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      toast(`Save failed: ${e.message}`, "error");
    }
  }

  function saveNow() {
    if (!editor || !canEdit) return;
    clearTimeout(saveTimer.current);
    save({ content: editor.getHTML() });
  }

  // Load the document once the editor is ready
  useEffect(() => {
    if (!editor) return;
    api.getDoc(docId)
      .then((d) => {
        setDoc(d);
        setTitle(d.title);
        editor.commands.setContent(d.content || "", { emitUpdate: false });
        editor.setEditable(d.role !== "viewer");
        updateCounts(editor);
        if (d.role !== "viewer") editor.commands.focus("end");
      })
      .catch((e) => setLoadError(e.message));
    return () => clearTimeout(saveTimer.current);
  }, [editor, docId]);

  // Warn before closing the tab with unsaved work; Ctrl/Cmd+S saves right away
  useEffect(() => {
    const beforeUnload = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    const keydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keydown);
    };
  }, [editor, doc]);

  function goBack() {
    if (dirty.current) saveNow(); // flush pending edits before leaving
    onBack();
  }

  function saveTitle() {
    const t = title.trim();
    if (!t) { setTitle(doc.title); toast("Title can't be empty", "error"); return; }
    if (t !== doc.title) save({ title: t });
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="banner error">{loadError}</div>
        <button onClick={onBack}>← Back to documents</button>
      </div>
    );
  }

  const collaborators = doc ? [doc.owner, ...(doc.shares || []).map((s) => ({ id: s.user_id, name: s.name, email: s.email }))] : [];

  return (
    <div className="editor-page">
      <div className="doc-header">
        <button className="icon-btn back" onClick={goBack} title="All documents" aria-label="Back to all documents">←</button>
        <div className="doc-header-main">
          <input className="title-input" value={title} disabled={!canEdit} maxLength={200}
            onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()} aria-label="Document title" />
          <div className="doc-subline">
            {doc && doc.role !== "owner" && (
              <span className="chip">Shared by {doc.owner.name} · {doc.role === "editor" ? "Can edit" : "View only"}</span>
            )}
            <SaveStatus status={status} />
          </div>
        </div>
        <div className="doc-header-right">
          {doc?.role === "owner" && (
            <div className="avatar-stack">{collaborators.map((u) => <Avatar key={u.id} user={u} size={30} />)}</div>
          )}
          {doc?.role === "owner" && <button className="primary share-btn" onClick={() => setShareOpen(true)}>🔒 Share</button>}
        </div>
      </div>

      {canEdit && <Toolbar editor={editor} aiEnabled={aiEnabled} onAiResult={setSuggestion} />}
      {doc?.role === "viewer" && <div className="viewer-bar">👁 You have view-only access. Ask {doc.owner.name} for edit access.</div>}

      <div className="canvas">
        {suggestion && <AiResult editor={editor} suggestion={suggestion} onClose={() => setSuggestion(null)} />}
        <div className="paper">
          {!doc && <p className="muted">Loading…</p>}
          <EditorContent editor={editor} className="editor" />
        </div>
        <div className="word-count">{counts.words} words · {counts.chars} characters</div>
      </div>

      {shareOpen && doc && (
        <ShareDialog doc={doc} users={users} me={me} onClose={() => setShareOpen(false)}
          onChange={(updated) => setDoc((d) => ({ ...d, shares: updated.shares }))} />
      )}
    </div>
  );
}
