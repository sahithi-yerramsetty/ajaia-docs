import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { useToast } from "./Toast.jsx";

const ACTIONS = [
  { id: "summarize", label: "Summarize", hint: "Selection, or the whole doc" },
  { id: "fix_grammar", label: "Fix grammar & spelling", hint: "Selected text" },
  { id: "shorten", label: "Make shorter", hint: "Selected text" },
  { id: "professional", label: "Make it professional", hint: "Selected text" },
];
const MAX_CHARS = 4000;

// Turn plain AI text into editor nodes. We never insert AI output as HTML.
function toNodes(text) {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] }));
}

export function AiButton({ editor, onResult }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function run(action) {
    setOpen(false);
    const { from, to, empty } = editor.state.selection;
    let range = { from, to, hasSelection: !empty };
    let text = empty ? "" : editor.state.doc.textBetween(from, to, "\n");

    if (!text.trim()) {
      if (action.id !== "summarize") { toast("Select some text first", "info"); return; }
      text = editor.getText();
      range = { from: 0, to: editor.state.doc.content.size, hasSelection: false };
      if (!text.trim()) { toast("The document is empty", "info"); return; }
    }
    if (text.length > MAX_CHARS) {
      toast(`Please select less text (max ${MAX_CHARS} characters)`, "error");
      return;
    }

    setLoading(true);
    try {
      const { result } = await api.aiAssist(action.id, text);
      onResult({ action, original: text, result, range });
    } catch (e) { toast(e.message, "error"); } finally { setLoading(false); }
  }

  return (
    <div className="ai-wrap" ref={ref}>
      <button type="button" className="ai-btn" disabled={loading}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}
        title="AI Assist" aria-haspopup="menu" aria-expanded={open}>
        {loading ? <span className="spinner" /> : "✨"} AI Assist
      </button>
      {open && (
        <div className="ai-menu" role="menu">
          {ACTIONS.map((a) => (
            <button key={a.id} role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => run(a)}>
              <span>{a.label}</span><small>{a.hint}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Preview card: the user decides what happens to the AI output.
export function AiResult({ editor, suggestion, onClose }) {
  const toast = useToast();
  const { action, result, range } = suggestion;

  function insertBelow() {
    const doc = editor.state.doc;
    const to = Math.min(range.to, doc.content.size);
    const $pos = doc.resolve(to);
    const pos = $pos.depth >= 1 ? $pos.after(1) : doc.content.size;
    editor.chain().focus().insertContentAt(pos, toNodes(result)).run();
    onClose();
  }

  function replace() {
    const size = editor.state.doc.content.size;
    const target = { from: Math.min(range.from, size), to: Math.min(range.to, size) };
    const nodes = toNodes(result);
    const content = nodes.length === 1 ? nodes[0].content[0] : nodes; // keep one line inline
    editor.chain().focus().insertContentAt(target, content).run();
    onClose();
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result); toast("Copied", "success"); }
    catch { toast("Couldn't copy", "error"); }
  }

  return (
    <div className="ai-result" role="region" aria-label="AI suggestion">
      <div className="ai-result-head">
        <strong>✨ {action.label}</strong>
        <span className="muted">Review before applying. AI can make mistakes.</span>
      </div>
      <div className="ai-result-text">{result}</div>
      <div className="ai-result-actions">
        {range.hasSelection && <button className="primary" onClick={replace}>Replace selection</button>}
        <button className={range.hasSelection ? "" : "primary"} onClick={insertBelow}>Insert below</button>
        <button onClick={copy}>Copy</button>
        <button className="link" onClick={onClose}>Discard</button>
      </div>
    </div>
  );
}
