// Migració d'una sola execució: data/*.json -> data/gesem.db
// Segura: no esborra els JSON. Si la clau ja existeix a la DB, demana confirmació
// abans de sobreescriure (per evitar destruir dades més recents).

const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON, hasKey, DB_PATH, DATA_DIR } = require('../db');

const FILES = ['agents.json', 'cats.json', 'formadors.json', 'reserves.json'];
const force = process.argv.includes('--force');

console.log('── Migració JSON → SQLite ──');
console.log('  DB:', DB_PATH);
console.log('  Data dir:', DATA_DIR);
console.log('');

let migrated = 0, skipped = 0, missing = 0;

for (const file of FILES) {
  const jsonPath = path.join(DATA_DIR, file);

  if (!fs.existsSync(jsonPath)) {
    console.log(`  [—] ${file}: no existeix, saltat`);
    missing++;
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.log(`  [✗] ${file}: JSON invàlid (${e.message})`);
    continue;
  }

  if (hasKey(file) && !force) {
    console.log(`  [↷] ${file}: ja existeix a la DB, saltat (usa --force per sobreescriure)`);
    skipped++;
    continue;
  }

  writeJSON(file, parsed);
  const summary = Array.isArray(parsed)
    ? `${parsed.length} registres`
    : `${Object.keys(parsed).length} claus`;
  console.log(`  [✓] ${file}: ${summary}`);
  migrated++;
}

console.log('');
console.log(`Resultat: ${migrated} migrats · ${skipped} saltats · ${missing} no trobats`);
console.log('Els fitxers JSON originals NO s\'han tocat (queden com a backup).');
