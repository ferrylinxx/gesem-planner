// Backup online de gesem.db (segur amb WAL i mentre el servidor està actiu).
// Per defecte desa a ./backups/ i conserva els últims BACKUP_KEEP fitxers.
//
// Variables d'entorn opcionals:
//   BACKUP_DIR   carpeta destí (per defecte: ./backups dins el projecte)
//                exemple: "C:\Users\Usuario\OneDrive\GESEM-Backups"
//   BACKUP_KEEP  nombre de backups a conservar (per defecte: 14)

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'gesem.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const BACKUP_KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10);

if (!fs.existsSync(DB_PATH)) {
  console.error('No existeix la DB:', DB_PATH);
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('Creada carpeta de backup:', BACKUP_DIR);
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-05-04T08-30-00
const destFile = path.join(BACKUP_DIR, `gesem-${ts}.db`);

const db = new Database(DB_PATH, { readonly: true });

(async () => {
  try {
    const start = Date.now();
    await db.backup(destFile);
    const ms = Date.now() - start;

    // Consolidar el destí a un sol fitxer (sense .db-wal/.db-shm residuals)
    const dest = new Database(destFile);
    dest.pragma('journal_mode = DELETE');
    dest.close();

    const size = (fs.statSync(destFile).size / 1024).toFixed(1);
    console.log(`✓ Backup creat: ${path.basename(destFile)} (${size} KB · ${ms}ms)`);
  } catch (e) {
    console.error('✗ Error fent backup:', e.message);
    process.exit(2);
  } finally {
    db.close();
  }

  // Retenció: esborrar backups antics per sobre del límit
  const all = fs.readdirSync(BACKUP_DIR)
    .filter(f => /^gesem-.*\.db$/.test(f))
    .map(f => ({ name: f, full: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = all.slice(BACKUP_KEEP);
  for (const item of toDelete) {
    try {
      fs.unlinkSync(item.full);
      console.log(`  · esborrat antic: ${item.name}`);
    } catch (e) {
      console.warn(`  · no s'ha pogut esborrar ${item.name}: ${e.message}`);
    }
  }

  console.log(`Total backups conservats: ${Math.min(all.length, BACKUP_KEEP)} (límit: ${BACKUP_KEEP})`);
})();
