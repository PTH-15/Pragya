import fs from 'fs'
import { pool } from './db.js'
import { notes } from '../src/data.js' // same mock data = single source of truth
await pool.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
for (const n of notes)
  await pool.query('INSERT INTO notes(id,title,subj,unit,topic,uploader,helpful,views,type,verified,kw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [n.id, n.title, n.subj, n.unit, n.topic, n.by, n.helpful, n.views, n.type, n.verified, n.kw])
await pool.query("SELECT setval(pg_get_serial_sequence('notes','id'),(SELECT max(id) FROM notes))")
await pool.query("INSERT INTO saved VALUES(1)")
await pool.query("INSERT INTO stats VALUES('helpful',142)")
console.log('Database seeded ✓'); await pool.end()