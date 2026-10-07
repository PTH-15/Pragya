DROP TABLE IF EXISTS saved, requests, stats, notes CASCADE;
CREATE TABLE notes(id SERIAL PRIMARY KEY, title TEXT, subj TEXT, unit TEXT, topic TEXT, uploader TEXT,
  helpful INT, views INT, type TEXT, verified BOOLEAN DEFAULT false, kw TEXT DEFAULT '');
CREATE TABLE saved(note_id INT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE);
CREATE TABLE requests(id SERIAL PRIMARY KEY, subject TEXT, unit TEXT, topic TEXT, description TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE stats(key TEXT PRIMARY KEY, value INT);