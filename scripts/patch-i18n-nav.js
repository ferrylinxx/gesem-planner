// Patcha els ítems de nav amb data-i18n. Utilitza string-replace simple (no regex).
const fs = require('fs');
const path = require('path');
const PUBLIC = path.join(__dirname, '..', 'public');
const pages = ['peticio', 'gestio', 'canvis', 'formadors', 'entrades', 'changelog', 'dashboard'];

const textMap = [
  { text: 'Dashboard',     key: 'nav.dashboard' },
  { text: 'Nova petició',  key: 'nav.peticio' },
  { text: 'Reserves',      key: 'nav.reserves' },
  { text: 'Canvis',        key: 'nav.canvis' },
  { text: 'Formadors',     key: 'nav.formadors' },
  { text: 'Entrades',      key: 'nav.entrades' },
];

for (const p of pages) {
  const file = path.join(PUBLIC, p + '.html');
  if (!fs.existsSync(file)) { console.log('  ↷ ' + p + '.html: no existeix'); continue; }
  let html = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const { text, key } of textMap) {
    const literal = '</svg>\n      ' + text + '\n    </a>';
    const replacement = '</svg>\n      <span data-i18n="' + key + '">' + text + '</span>\n    </a>';
    if (html.includes(literal)) {
      html = html.split(literal).join(replacement);
      count++;
    }
  }
  fs.writeFileSync(file, html, 'utf8');
  console.log('  ' + p + '.html · ' + count + ' nav items');
}
