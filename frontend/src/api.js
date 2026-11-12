// Small wrapper around fetch. Sends the "logged in" user id on every call.
let currentUserId = null;
export function setUser(id) {
  currentUserId = id;
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (currentUserId) headers["X-User-Id"] = String(currentUserId);
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI sends {detail: "..."} or {detail: [{msg: "..."}]}
    const d = data.detail;
    const msg = Array.isArray(d) ? d.map((x) => x.msg).join(", ") : d;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  users: () => request("/users"),
  listDocs: () => request("/documents"),
  getDoc: (id) => request(`/documents/${id}`),
  createDoc: (title) => request("/documents", { method: "POST", body: { title } }),
  updateDoc: (id, changes) => request(`/documents/${id}`, { method: "PATCH", body: changes }),
  deleteDoc: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  share: (id, email, role) =>
    request(`/documents/${id}/shares`, { method: "POST", body: { email, role } }),
  unshare: (id, userId) => request(`/documents/${id}/shares/${userId}`, { method: "DELETE" }),
  importFile: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/documents/import", { method: "POST", body: form });
  },
  aiStatus: () => request("/ai/status"),
  aiAssist: (action, text) => request("/ai/assist", { method: "POST", body: { action, text } }),
};
