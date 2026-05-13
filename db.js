const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DB_PATH = path.join(DATA_DIR, 'gesem.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS store (
    filename TEXT PRIMARY KEY,
    content  TEXT NOT NULL,
    updated  TEXT NOT NULL
  )
`);

const selectStmt = db.prepare('SELECT content FROM store WHERE filename = ?');
const upsertStmt = db.prepare(`
  INSERT INTO store (filename, content, updated)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(filename) DO UPDATE SET content = excluded.content, updated = excluded.updated
`);

function readJSON(file, def) {
  try {
    const row = selectStmt.get(file);
    if (row) return JSON.parse(row.content);
  } catch (e) {
    console.error('Error llegint', file, e.message);
  }
  return def;
}

function writeJSON(file, data) {
  try {
    upsertStmt.run(file, JSON.stringify(data));
  } catch (e) {
    console.error('Error escrivint', file, e.message);
  }
}

function hasKey(file) {
  return !!selectStmt.get(file);
}

module.exports = { db, readJSON, writeJSON, hasKey, DATA_DIR, DB_PATH };
