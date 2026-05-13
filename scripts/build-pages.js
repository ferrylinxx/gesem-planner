// Genera els 5 fitxers HTML de pàgina a partir de index.html
// AVÍS: aquest script NOMÉS funciona si encara existeix public/index.html
// (font monolítica original). Es va eliminar al refactor — si el necessites,
// recupera'l del git: `git show HEAD:public/index.html > public/index.html`
//
// Per a edicions petites a posteriori, fes scripts puntuals com els que
// patcheen els 5 fitxers individualment (vegeu shortcuts.js patch).

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'index.html');
const PUBLIC = path.join(__dirname, '..', 'public');

if (!fs.existsSync(SRC)) {
  console.error('❌ public/index.html no existeix.');
  console.error('   Aquest script només funciona amb el fitxer monolític original.');
  console.error('   Per recuperar-lo des del git: git show <commit>:public/index.html > public/index.html');
  process.exit(1);
}

const src = fs.readFileSync(SRC, 'utf8');

// Helper: extreu del fitxer entre dos marcadors (per posició, no per regex)
function extract(startStr, endStr) {
  const s = src.indexOf(startStr);
  if (s < 0) throw new Error('No trobat start: ' + startStr);
  const e = src.indexOf(endStr, s);
  if (e < 0) throw new Error('No trobat end: ' + endStr);
  return src.substring(s, e).trim();
}

// Extreure cada secció — usem els comentaris del HTML com a marcadors
const sections = {
  peticio:    extract('<!-- PETICIÓ -->', '<!-- GESTIÓ RESERVES -->'),
  gestio:     extract('<!-- GESTIÓ RESERVES -->', '<!-- CANVIS -->'),
  canvis:     extract('<!-- CANVIS -->', '<!-- FORMADORS -->'), // inclou canvis-apply-bg modal
  formadors:  extract('<!-- FORMADORS -->', '<!-- ENTRADES -->'),
  entrades:   extract('<!-- ENTRADES -->', '<!-- MODAL FORMADOR -->'),
};

// Modals — sempre inclosos a totes les pàgines (és més simple i ocupa poc)
const modals = src.substring(
  src.indexOf('<!-- MODAL FORMADOR -->'),
  src.indexOf('</div><!-- /content-area -->')
).trim();

// Title per pàgina (per a appbar i <title>)
const titles = {
  peticio:   { appbar: 'Nova petició',       title: 'Petició' },
  gestio:    { appbar: 'Gestió de reserves', title: 'Reserves' },
  canvis:    { appbar: 'Gestió de canvis',   title: 'Canvis' },
  formadors: { appbar: 'Formadors',          title: 'Formadors' },
  entrades:  { appbar: 'Entrades de peticions', title: 'Entrades' },
};

// Mapping pàgina → id de boto nav (per a active state)
const navIds = {
  peticio:   'p',
  gestio:    'gest',
  canvis:    'canvis',
  formadors: 'f',
  entrades:  'entrades',
};

// Generar la sidebar HTML (compartida a totes les pàgines)
function sidebarHtml(activePage) {
  const id = navIds[activePage];
  const navItems = [
    { id: 'p',         href: '/peticio',   label: 'Nova petició', svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>' },
    { id: 'gest',      href: '/gestio',    label: 'Reserves',     svg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>' },
    { id: 'canvis',    href: '/canvis',    label: 'Canvis',       svg: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>' },
    { id: 'f',         href: '/formadors', label: 'Formadors',    svg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { id: 'entrades',  href: '/entrades',  label: 'Entrades',     svg: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>' },
  ];
  const items = navItems.map(item => {
    const active = item.id === id ? ' act' : '';
    return `    <a class="nb${active}" id="nb-${item.id}" href="${item.href}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.svg}</svg>
      ${item.label}
    </a>`;
  }).join('\n');

  return `<aside class="sidebar">
  <div class="logo">
    <div class="lm"><svg width="22" height="22" viewBox="0 0 56 56" fill="none"><rect x="8" y="14" width="36" height="10" rx="2" fill="#A7F3D0" transform="rotate(-4 26 19)"/><rect x="10" y="22" width="36" height="10" rx="2" fill="#34D399"/><rect x="12" y="32" width="36" height="10" rx="2" fill="#059669" transform="rotate(3 30 37)"/></svg></div>
    <div style="display:flex;flex-direction:column;line-height:1.15">
      <span>GESEM</span>
      <span class="logo-g">Planner</span>
    </div>
  </div>

  <div class="nav">
${items}
  </div>

  <div style="margin-top:auto;padding:10px 8px 2px;border-top:1px solid var(--border);display:flex;align-items:center;gap:9px;color:var(--text-muted);font-size:11.5px">
    <div style="width:24px;height:24px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;letter-spacing:.02em">G</div>
    <span style="font-weight:600;color:var(--text)">GESEM</span>
  </div>
</aside>`;
}

// Generar HTML complet d'una pàgina
function pageHtml(pageKey) {
  const t = titles[pageKey];
  const content = sections[pageKey];
  return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>GESEM Planner · ${t.title}</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<link rel="apple-touch-icon" href="/favicon.svg"/>
<meta name="theme-color" content="#059669"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/css/styles.css"/>
</head>
<body>
<div class="app-shell">

${sidebarHtml(pageKey)}

<div class="sidebar-backdrop" id="sidebar-backdrop" onclick="toggleSidebar(false)"></div>
<div class="main-area">
<div class="appbar">
  <button class="mobile-toggle" aria-label="Menú" onclick="toggleSidebar()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>
  <div class="appbar-title" id="appbar-title">${t.appbar}</div>
  <div class="appbar-spacer"></div>
  <span style="font-size:11px;color:var(--text-subtle);font-weight:500">v11</span>
</div>
<div class="content-area">

${content}

${modals}

</div><!-- /content-area -->
</div><!-- /main-area -->
</div><!-- /app-shell -->

<div class="toast" id="toast"></div>

<div class="loading-overlay" id="loading-overlay">
  <div class="spin"></div>
  <div class="lbl">Carregant GESEM Planner...</div>
</div>

<script src="/js/shortcuts.js" defer></script>
<script src="/js/app.js" defer></script>
</body>
</html>
`;
}

// Generar els fitxers
const pages = ['peticio', 'gestio', 'canvis', 'formadors', 'entrades'];
for (const p of pages) {
  const out = path.join(PUBLIC, `${p}.html`);
  fs.writeFileSync(out, pageHtml(p), 'utf8');
  console.log(`✓ ${p}.html (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
}
console.log('\nFet. ' + pages.length + ' pàgines generades.');
