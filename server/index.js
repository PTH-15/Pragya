import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import { pool as db } from './db.js'

const app = express()
app.use(cors(), express.json())
fs.mkdirSync('uploads', { recursive: true })
app.use('/uploads', express.static('uploads'))
await db.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS file TEXT')
await db.query(`CREATE TABLE IF NOT EXISTS pyqs(id SERIAL PRIMARY KEY, subj TEXT, topic TEXT, unit TEXT, year INT, marks INT, question TEXT);
CREATE TABLE IF NOT EXISTS progress(subj TEXT, topic TEXT, PRIMARY KEY(subj,topic))`)
if (!(await db.query('SELECT 1 FROM pyqs LIMIT 1')).rowCount) {
  const O = 'Object Oriented Programming', D = 'Data Structures', A = 'Fundamentals of AI', M = 'Database Management Systems'
  const rows = [
    [O,'Polymorphism','Unit 3',2025,8,'Explain runtime polymorphism with suitable example.'],[O,'Polymorphism','Unit 3',2024,6,'Differentiate overloading and overriding.'],[O,'Polymorphism','Unit 3',2023,8,'Explain dynamic method dispatch.'],
    [O,'Inheritance','Unit 3',2025,6,'Differentiate single and multilevel inheritance in Java.'],[O,'Inheritance','Unit 3',2023,6,'Explain the super keyword with example.'],
    [O,'Exception Handling','Unit 4',2024,8,'Explain try, catch, finally with a program.'],[O,'Exception Handling','Unit 4',2022,6,'Differentiate throw and throws.'],
    [O,'Classes & Objects','Unit 2',2024,4,'Define class and object with example.'],[O,'Classes & Objects','Unit 2',2022,4,'Explain access specifiers.'],
    [O,'Constructors','Unit 2',2023,4,'What is constructor overloading?'],[O,'Introduction to OOP','Unit 1',2022,2,'List the features of OOP.'],
    [D,'Trees','Unit 3',2025,6,'Write inorder traversal of a binary tree.'],[D,'Trees','Unit 3',2024,8,'Explain BST insertion and deletion.'],[D,'Trees','Unit 3',2023,6,'Differentiate BFS and DFS traversal.'],
    [D,'Stacks & Queues','Unit 2',2025,4,'Implement a stack using an array.'],[D,'Stacks & Queues','Unit 2',2023,6,'Explain circular queue.'],[D,'Arrays & Linked Lists','Unit 1',2024,6,'Compare arrays and linked lists.'],
    [A,'Search','Unit 2',2025,8,'Explain A* search with an example.'],[A,'Search','Unit 2',2024,6,'Compare BFS and DFS.'],[A,'Intelligent Agents','Unit 1',2023,4,'Explain types of agents.'],
    [M,'Normalization','Unit 3',2025,8,'Explain 1NF, 2NF, 3NF with example.'],[M,'Normalization','Unit 3',2024,8,'What is BCNF?'],[M,'Normalization','Unit 3',2023,6,'Explain functional dependency.'],
    [M,'ER Model','Unit 1',2024,6,'Draw an ER diagram for a library system.'],[M,'Transactions','Unit 4',2025,6,'Explain ACID properties.'],[M,'Transactions','Unit 4',2022,6,'Explain concurrency control.']]
  for (const r of rows) await db.query('INSERT INTO pyqs(subj,topic,unit,year,marks,question) VALUES($1,$2,$3,$4,$5,$6)', r)
}
const up = multer({ storage: multer.diskStorage({ destination: 'uploads', filename: (_, f, cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^\w.-]/g, '_')) }), limits: { fileSize: 25 * 1024 * 1024 } })
const SEL = 'SELECT id,title,subj,unit,topic,uploader AS "by",helpful,views,type,verified,kw,file FROM notes'
const wrap = f => (req, res) => f(req, res).catch(e => { console.error(e); res.status(500).json({ error: e.message }) })
const syn = { polymorph: 'polymorphism', 'many forms': 'polymorphism', override: 'overriding', overload: 'overloading', tree: 'tree', normal: 'normalization', search: 'search', exception: 'exception', error: 'exception' }

// One call to hydrate the whole app
app.get('/api/boot', wrap(async (_, res) => {
  const [n, s, h, u] = await Promise.all([
    db.query(SEL + ' ORDER BY id'), db.query('SELECT note_id FROM saved'),
    db.query("SELECT value FROM stats WHERE key='helpful'"),
    db.query("SELECT count(*)::int c FROM notes WHERE uploader='Prathmesh'")])
  res.json({ notes: n.rows, saved: s.rows.map(r => r.note_id), helpful: h.rows[0].value, uploads: u.rows[0].c })
}))

// Semantic-style search (synonym expansion + concept scoring). Swap for pgvector embeddings later.
app.get('/api/search', wrap(async (req, res) => {
  const { q = '', subj = '', type = '' } = req.query
  const l = q.toLowerCase()
  const toks = [...l.split(/\W+/), ...Object.entries(syn).filter(([k]) => l.includes(k)).map(e => e[1])]
  const { rows } = await db.query(SEL + " WHERE ($1::text='' OR subj=$1) AND ($2::text='' OR type=$2)", [subj, type])
  res.json(rows.map(n => {
    const hit = toks.filter(t => t.length > 3 && n.kw.includes(t)).length
    return { ...n, score: hit ? Math.min(98, 55 + hit * 14 + n.helpful / 20) : 0 }
  }).filter(n => n.score > 0).sort((a, b) => b.score - a.score))
}))

app.post('/api/notes/:id/save', wrap(async (req, res) => {
  const d = await db.query('DELETE FROM saved WHERE note_id=$1 RETURNING 1', [req.params.id])
  if (!d.rowCount) await db.query('INSERT INTO saved VALUES($1)', [req.params.id])
  res.json({ saved: !d.rowCount })
}))
app.post('/api/helpful', wrap(async (_, res) => {
  const r = await db.query("UPDATE stats SET value=value+1 WHERE key='helpful' RETURNING value"); res.json({ helpful: r.rows[0].value })
}))
app.post('/api/upload', up.single('file'), wrap(async (req, res) => {
  const b = req.body, kw = [b.title, b.topic, b.subj, b.description].join(' ').toLowerCase()
  const r = await db.query("INSERT INTO notes(title,subj,unit,topic,uploader,helpful,views,type,verified,kw,file) VALUES($1,$2,$3,$4,'Prathmesh',80,0,$5,false,$6,$7) RETURNING id",
    [b.title, b.subj, b.unit, b.topic, b.type, kw, req.file ? req.file.filename : null])
  res.json({ id: r.rows[0].id })
}))
app.put('/api/notes/:id', wrap(async (req, res) => {
  const b = req.body
  await db.query('UPDATE notes SET title=$1,subj=$2,unit=$3,topic=$4,type=$5 WHERE id=$6', [b.title, b.subj, b.unit, b.topic, b.type, req.params.id])
  res.json({ ok: true })
}))
app.delete('/api/notes/:id', wrap(async (req, res) => {
  const r = await db.query('DELETE FROM notes WHERE id=$1 RETURNING file', [req.params.id])
  if (r.rows[0]?.file) fs.unlink('uploads/' + r.rows[0].file, () => {})
  res.json({ ok: true })
}))
app.post('/api/requests', wrap(async (req, res) => {
  const { subject = 'Database Management Systems', unit = 'Unit 4', topic = '', description = '' } = req.body
  await db.query('INSERT INTO requests(subject,unit,topic,description) VALUES($1,$2,$3,$4)', [subject, unit, topic, description])
  const c = await db.query('SELECT count(*)::int c FROM requests')
  res.json({ count: 23 + c.rows[0].c })
}))

// PYQ intelligence: past questions grouped by topic, heaviest first
app.get('/api/pyqs', wrap(async (req, res) => {
  const { rows } = await db.query('SELECT topic,unit,year,marks,question FROM pyqs WHERE subj=$1 ORDER BY year DESC', [req.query.subj || ''])
  const T = {}
  rows.forEach(r => { const x = T[r.topic] || (T[r.topic] = { topic: r.topic, unit: r.unit, freq: 0, marks: 0, asked: [] }); x.freq++; x.marks += r.marks; x.asked.push({ year: r.year, marks: r.marks, question: r.question }) })
  res.json(Object.values(T).sort((a, b) => b.marks - a.marks))
}))

// AI exam planner: ranks topics by PYQ weight (recent years count more), minus topics already studied
app.get('/api/exam-plan', wrap(async (req, res) => {
  const subj = req.query.subj, days = Math.max(1, Math.min(14, +req.query.days || 3))
  const [py, nt, pr] = await Promise.all([db.query('SELECT * FROM pyqs WHERE subj=$1', [subj]), db.query('SELECT id,title,topic,unit FROM notes WHERE subj=$1', [subj]), db.query('SELECT topic FROM progress WHERE subj=$1', [subj])])
  const done = new Set(pr.rows.map(r => r.topic)), T = {}
  const get = t => T[t] || (T[t] = { topic: t, unit: '', marks: 0, freq: 0, score: 0, qs: [], notes: [], done: done.has(t) })
  py.rows.forEach(r => { const x = get(r.topic); x.unit = r.unit; x.freq++; x.marks += r.marks; x.score += r.marks * (r.year >= 2025 ? 1.5 : r.year === 2024 ? 1.2 : 1); x.qs.push(r.question + ' (' + r.year + ', ' + r.marks + 'm)') })
  nt.rows.forEach(n => { const x = get(n.topic); if (!x.unit) x.unit = n.unit; x.notes.push({ id: n.id, title: n.title }) })
  const list = Object.values(T).map(x => ({ ...x, score: Math.round(x.done ? x.score * 0.4 : x.score) })).sort((a, b) => b.score - a.score)
  const k = Math.ceil(list.length / 3); list.forEach((x, i) => x.priority = i < k ? 'HIGH' : i < 2 * k ? 'MEDIUM' : 'LOW')
  const names = a => a.map(x => x.topic).join(', ')
  const high = list.filter(x => x.priority === 'HIGH'), learn = list.filter(x => !x.done), plan = []
  if (days === 1) plan.push({ title: 'Crash revision', items: ['Quick revision: ' + names(high), 'Solve top PYQs: ' + names(high.filter(x => x.qs.length)), 'Mini mock test'] })
  else {
    const ld = Math.max(1, days - (days >= 3 ? 2 : 1)), size = Math.max(1, Math.ceil(learn.length / ld))
    for (let i = 0; i < ld; i++) {
      const ch = learn.slice(i * size, (i + 1) * size)
      plan.push({ title: 'Learn & practice', items: ch.length ? ['Learn: ' + names(ch), ...ch.filter(x => x.notes[0]).map(x => 'Read: ' + x.notes[0].title), ...ch.filter(x => x.qs[0]).map(x => 'Solve PYQ: ' + x.qs[0])] : ['All topics studied — light revision'] })
    }
    if (days >= 3) plan.push({ title: 'Revision', items: ['Revise: ' + names(high), 'Go through important questions', 'Take the MCQ quiz'] })
    plan.push({ title: 'Final push', items: ['Quick revision of high-priority topics', 'Full mock test', 'Weak-topic review: ' + (names(learn.slice(0, 3)) || 'everything covered ✓')] })
  }
  plan.forEach((d, i) => d.day = i + 1)
  res.json({ subj, days, topics: list, plan, why: { topics: list.length, pyqs: py.rowCount, notes: nt.rowCount, gaps: list.filter(x => !x.notes.length).length, studied: done.size } })
}))
app.post('/api/progress', wrap(async (req, res) => {
  const { subj, topic } = req.body
  const d = await db.query('DELETE FROM progress WHERE subj=$1 AND topic=$2 RETURNING 1', [subj, topic])
  if (!d.rowCount) await db.query('INSERT INTO progress VALUES($1,$2)', [subj, topic])
  res.json({ done: !d.rowCount })
}))

app.listen(process.env.PORT || 5000, () => console.log('Pragya API on :' + (process.env.PORT || 5000)))