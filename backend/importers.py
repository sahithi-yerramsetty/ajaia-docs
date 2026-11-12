"""Turn an uploaded file into HTML the editor can open."""
import html
import io
from pathlib import Path

import mammoth
import markdown as md

ALLOWED_EXTENSIONS = {".txt", ".md", ".docx"}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MB


class ImportError_(ValueError):
    pass


def file_to_html(filename: str, data: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ImportError_("Only .txt, .md and .docx files are supported.")
    if len(data) == 0:
        raise ImportError_("The file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ImportError_("File is too large (max 2 MB).")

    if ext == ".docx":
        try:
            return mammoth.convert_to_html(io.BytesIO(data)).value
        except Exception:
            raise ImportError_("Could not read this .docx file.")

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise ImportError_("Text files must be UTF-8 encoded.")

    if ext == ".md":
        return md.markdown(text)

    # .txt: one <p> per paragraph, escaped so no raw HTML gets in
    paragraphs = [p.strip() for p in text.replace("\r\n", "\n").split("\n\n")]
    return "".join(
        f"<p>{html.escape(p).replace(chr(10), '<br>')}</p>" for p in paragraphs if p
    )
    