// Accepts https://host, https://host/ or https://host/api — always ends up as https://host/api
const ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000').trim().replace(/\/+$/, '').replace(/\/api$/, '')
const BASE = ROOT + '/api'
const call = async (path, opts) => {
  try { const r = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return r.ok ? await r.json() : null }
  catch { return null }
}
const post = (p, body) => call(p, { method: 'POST', body: JSON.stringify(body || {}) })
export const api = {
  boot: () => call('/boot'),
  search: async (q, f) => (await call(`/search?q=${encodeURIComponent(q)}&subj=${encodeURIComponent(f.subj)}&type=${encodeURIComponent(f.type)}`)) || [],
  plan: (s, d) => call('/exam-plan?subj=' + encodeURIComponent(s) + '&days=' + d),
  progress: (subj, topic) => post('/progress', { subj, topic }),
  pyqs: s => call('/pyqs?subj=' + encodeURIComponent(s)),
  save: id => post(`/notes/${id}/save`),
  helpful: () => post('/helpful'),
  upload: fd => call('/upload', { method: 'POST', body: fd, headers: {} }),
  del: id => call('/notes/' + id, { method: 'DELETE' }),
  edit: (id, b) => call('/notes/' + id, { method: 'PUT', body: JSON.stringify(b) }),
  fileUrl: f => ROOT + '/uploads/' + f,
  request: b => post('/requests', b),
}