// ── KEYBOARD SHORTCUTS + MOBILE SIDEBAR + DARK MODE ─────────────
// Carregat abans d'app.js perquè defineix funcions globals que les pàgines necessiten

// ── Dark mode (s'aplica abans del render per evitar flash) ──────
(function applyTheme(){
  try{
    const saved = localStorage.getItem('theme');
    const prefDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefDark)) {
      document.documentElement.classList.add('dark-pre'); // marca al <html> abans del body
    }
  } catch(e){}
})();
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.classList.contains('dark-pre')) {
    document.body.classList.add('dark');
    document.documentElement.classList.remove('dark-pre');
  }
});

function toggleTheme(){
  const isDark = document.body.classList.toggle('dark');
  try{ localStorage.setItem('theme', isDark ? 'dark' : 'light'); }catch(e){}
  // Refresca el text del label de la sidebar
  const sbLbl = document.getElementById('sb-theme-label');
  if (sbLbl) sbLbl.textContent = isDark ? 'Mode clar' : 'Mode fosc';
}

// També inicialitzar el label correcte al carregar (per si la pàgina ja és dark)
document.addEventListener('DOMContentLoaded', () => {
  const sbLbl = document.getElementById('sb-theme-label');
  if (sbLbl) sbLbl.textContent = document.body.classList.contains('dark') ? 'Mode clar' : 'Mode fosc';
});

// ── Menú a l'appbar (engranatge) ────────────────────────────────
function mountAppbarMenu() {
  const mount = document.getElementById('appbar-menu-mount');
  if (!mount || mount._mounted) return;
  mount._mounted = true;
  // Botó simple a l'appbar que obre el panel de dreceres
  mount.innerHTML = `
    <button class="appbar-menu-btn" id="appbar-menu-btn" aria-label="Dreceres de teclat" title="Dreceres de teclat (?)" onclick="openShortcutsHelp()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
    </button>
  `;
}

function toggleAppbarMenu() {
  const menu = document.getElementById('appbar-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}
function closeAppbarMenu() {
  document.getElementById('appbar-menu')?.classList.remove('open');
}
// Tancar al fer clic fora
document.addEventListener('click', (e) => {
  const menu = document.getElementById('appbar-menu');
  const btn = document.getElementById('appbar-menu-btn');
  if (!menu || !menu.classList.contains('open')) return;
  if (!menu.contains(e.target) && !btn?.contains(e.target)) closeAppbarMenu();
});

document.addEventListener('DOMContentLoaded', mountAppbarMenu);

// ── Diàleg de confirmació polit (substitueix al confirm() del navegador) ──
// Ús: const ok = await confirmDialog({title:'Eliminar?', message:'No es pot desfer', confirmText:'Eliminar', danger:true});
function confirmDialog(opts){
  return new Promise(resolve => {
    const o = Object.assign({
      title: 'Confirmar acció',
      message: 'Estàs segur?',
      confirmText: 'Confirmar',
      cancelText: 'Cancel·lar',
      danger: false,
    }, opts || {});
    const div = document.createElement('div');
    div.className = 'confirm-bg';
    div.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon ${o.danger ? 'danger' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="confirm-title">${o.title}</div>
        <div class="confirm-msg">${o.message}</div>
        <div class="confirm-actions">
          <button class="btn btn-cancel">${o.cancelText}</button>
          <button class="btn ${o.danger ? 'btn-danger' : 'btn-p'} btn-ok">${o.confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(div);
    const close = (val) => { div.remove(); resolve(val); };
    div.querySelector('.btn-cancel').onclick = () => close(false);
    div.querySelector('.btn-ok').onclick = () => close(true);
    div.onclick = (e) => { if (e.target === div) close(false); };
    setTimeout(() => div.querySelector('.btn-ok').focus(), 30);
    // ESC per cancel·lar
    const esc = (e) => { if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
  });
}

// Mobile: obrir/tancar sidebar amb hamburger o backdrop
function toggleSidebar(forceState) {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  const next = typeof forceState === 'boolean' ? forceState : !isOpen;
  sidebar.classList.toggle('open', next);
  if (backdrop) backdrop.classList.toggle('open', next);
}

// Desktop: plegar/desplegar sidebar (només icones)
function toggleSidebarCollapse() {
  const shell = document.querySelector('.app-shell');
  if (!shell) return;
  const collapsed = shell.classList.toggle('collapsed');
  syncSidebarTooltips(collapsed);
  try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch (e) {}
}

// Posar/treure data-tip a tots els elements col·lapsables
// (basat en el text del span i18n o el primer span dins de l'element)
function syncSidebarTooltips(collapsed) {
  document.querySelectorAll('.sidebar .nb, .sidebar .sb-foot-item').forEach(el => {
    if (collapsed) {
      // Trobar el text de l'element (preferint el span amb data-i18n)
      const labelEl = el.querySelector('[data-i18n]') || el.querySelector('span:not(.lang-flag):not(.moon):not(.sun)');
      const text = (labelEl?.textContent || '').trim();
      if (text) {
        el.setAttribute('data-tip', text);
        el.setAttribute('title', text);
      }
    } else {
      el.removeAttribute('data-tip');
      el.removeAttribute('title');
    }
  });
}

// Restaurar estat al carregar
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (localStorage.getItem('sidebarCollapsed') === '1') {
      document.querySelector('.app-shell')?.classList.add('collapsed');
      // Esperar una mica perquè i18n hagi aplicat traduccions
      setTimeout(() => syncSidebarTooltips(true), 100);
    }
  } catch (e) {}
});

// Quan canvia l'idioma, refrescar tooltips si està col·lapsada
document.addEventListener('langchange', () => {
  if (document.querySelector('.app-shell.collapsed')) {
    setTimeout(() => syncSidebarTooltips(true), 50);
  }
});

// Snackbar de confirmació de shortcut
function showShortcutHint(text) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1400);
}

// Mapa de shortcuts → URL
const NAV_SHORTCUTS = {
  'p': '/peticio',
  'r': '/gestio',
  'c': '/canvis',
  'f': '/formadors',
  'e': '/entrades',
};

// ── Command Palette (Ctrl/Cmd + K) ──────────────────────────────
let _palette = null;
function openPalette() {
  if (_palette) return;
  _palette = document.createElement('div');
  _palette.id = 'cmd-palette';
  _palette.innerHTML = `
    <div class="cmdp-bg" onclick="closePalette()"></div>
    <div class="cmdp-box">
      <div class="cmdp-input-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="cmdp-input" placeholder="Escriu per cercar o navegar..." autofocus/>
        <kbd>esc</kbd>
      </div>
      <div class="cmdp-results" id="cmdp-results"></div>
    </div>`;
  document.body.appendChild(_palette);
  setTimeout(() => document.getElementById('cmdp-input')?.focus(), 30);
  document.getElementById('cmdp-input').addEventListener('input', renderPalette);
  renderPalette();
}
function closePalette() {
  if (_palette) { _palette.remove(); _palette = null; }
}
function renderPalette() {
  const q = (document.getElementById('cmdp-input')?.value || '').toLowerCase().trim();
  const items = [
    { icon: '📋', title: 'Nova petició',         desc: 'Anar a la pàgina de planificació', href: '/peticio' },
    { icon: '📊', title: 'Reserves',             desc: 'Gestió de totes les reserves',     href: '/gestio' },
    { icon: '🔄', title: 'Canvis',               desc: 'Gestió de canvis a reserves',       href: '/canvis' },
    { icon: '👥', title: 'Formadors',            desc: 'Llista i edició de formadors',     href: '/formadors' },
    { icon: '📥', title: 'Entrades',             desc: 'Canals d\'entrada de peticions',   href: '/entrades' },
  ];
  const filtered = q ? items.filter(i => i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)) : items;
  const wrap = document.getElementById('cmdp-results');
  if (!wrap) return;
  if (filtered.length === 0) {
    wrap.innerHTML = '<div class="cmdp-empty">Cap resultat per "' + q + '"</div>';
    return;
  }
  wrap.innerHTML = filtered.map((it, i) =>
    `<button class="cmdp-item${i===0?' sel':''}" data-href="${it.href}" onclick="window.location.href='${it.href}'">
      <span class="cmdp-icon">${it.icon}</span>
      <span class="cmdp-title">${it.title}</span>
      <span class="cmdp-desc">${it.desc}</span>
    </button>`).join('');
}

// ── Listener global ──────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Cmd/Ctrl + K → Command palette
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (_palette) closePalette();
    else openPalette();
    return;
  }

  // Esc → tanca palette o modals oberts
  if (e.key === 'Escape') {
    if (_palette) { closePalette(); return; }
    // Tancar qualsevol modal obert
    document.querySelectorAll('.modal-bg').forEach(m => {
      if (m.style.display === 'flex' || m.style.display === 'block') m.style.display = 'none';
    });
    // Tancar sidebar a mòbil
    toggleSidebar(false);
    return;
  }

  // Navegació amb 'g' + tecla (estil Linear/Vercel)
  // Ho fem amb un flag temporal: després de prémer 'g', la següent tecla en 1.5s navega
  if (window._gFlag) {
    window._gFlag = false;
    clearTimeout(window._gTimer);
    if (NAV_SHORTCUTS[e.key.toLowerCase()] && !isInputFocused()) {
      e.preventDefault();
      window.location.href = NAV_SHORTCUTS[e.key.toLowerCase()];
      return;
    }
  }
  if (e.key.toLowerCase() === 'g' && !isInputFocused() && !e.metaKey && !e.ctrlKey) {
    window._gFlag = true;
    clearTimeout(window._gTimer);
    window._gTimer = setTimeout(() => { window._gFlag = false; }, 1500);
    showShortcutHint('g + p (petició) · r (reserves) · c (canvis) · f (formadors) · e (entrades)');
    return;
  }

  // 'N' → Nova petició (només si no estàs escrivint)
  if (e.key.toLowerCase() === 'n' && !isInputFocused() && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    window.location.href = '/peticio';
    return;
  }

  // '?' → mostrar shortcuts
  if (e.key === '?' && !isInputFocused()) {
    e.preventDefault();
    openShortcutsHelp();
    return;
  }
});

function isInputFocused() {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
}

// ── Help dialog amb tots els shortcuts ──────────────────────────
function openShortcutsHelp() {
  if (document.getElementById('shortcuts-help')) return;
  const div = document.createElement('div');
  div.id = 'shortcuts-help';
  div.innerHTML = `
    <div class="cmdp-bg" onclick="document.getElementById('shortcuts-help').remove()"></div>
    <div class="cmdp-box" style="max-width:420px">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-weight:600">Dreceres de teclat</div>
      <div style="padding:14px 20px">
        <div class="sh-row"><span>Cercar / navegar</span><kbd>Ctrl</kbd>+<kbd>K</kbd></div>
        <div class="sh-row"><span>Nova petició</span><kbd>N</kbd></div>
        <div class="sh-row"><span>Anar a Petició</span><kbd>G</kbd> <kbd>P</kbd></div>
        <div class="sh-row"><span>Anar a Reserves</span><kbd>G</kbd> <kbd>R</kbd></div>
        <div class="sh-row"><span>Anar a Canvis</span><kbd>G</kbd> <kbd>C</kbd></div>
        <div class="sh-row"><span>Anar a Formadors</span><kbd>G</kbd> <kbd>F</kbd></div>
        <div class="sh-row"><span>Anar a Entrades</span><kbd>G</kbd> <kbd>E</kbd></div>
        <div class="sh-row"><span>Tancar modals</span><kbd>Esc</kbd></div>
        <div class="sh-row"><span>Mostrar aquesta ajuda</span><kbd>?</kbd></div>
      </div>
    </div>`;
  document.body.appendChild(div);
}

// ── Estils del palette (injectats dinàmicament) ─────────────────
const _pStyle = document.createElement('style');
_pStyle.textContent = `
#cmd-palette, #shortcuts-help{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-start;justify-content:center;padding-top:80px}
#cmd-palette .cmdp-bg, #shortcuts-help .cmdp-bg{position:absolute;inset:0;background:rgba(15,23,42,0.4);backdrop-filter:blur(4px)}
#cmd-palette .cmdp-box, #shortcuts-help .cmdp-box{position:relative;width:540px;max-width:92vw;background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.2);overflow:hidden}
.cmdp-input-wrap{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)}
.cmdp-input-wrap svg{color:var(--text-muted);flex-shrink:0}
.cmdp-input-wrap input{flex:1;border:none;outline:none;font-size:15px;font-family:inherit;color:var(--text);background:transparent}
.cmdp-input-wrap kbd{font-size:11px;padding:2px 7px;background:var(--bg-muted);border:1px solid var(--border);border-radius:4px;color:var(--text-muted);font-family:'Inter',sans-serif}
.cmdp-results{max-height:400px;overflow-y:auto;padding:6px}
.cmdp-item{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:10px;width:100%;padding:9px 12px;border:none;background:transparent;cursor:pointer;border-radius:8px;font-family:inherit;text-align:left;color:var(--text)}
.cmdp-item:hover, .cmdp-item.sel{background:var(--bg-muted)}
.cmdp-icon{font-size:16px;text-align:center}
.cmdp-title{font-size:13px;font-weight:500;color:var(--text)}
.cmdp-desc{font-size:11.5px;color:var(--text-muted)}
.cmdp-empty{padding:20px;text-align:center;color:var(--text-muted);font-size:13px}
.sh-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:13px;color:var(--text)}
.sh-row kbd{font-size:11px;padding:2px 7px;background:var(--bg-muted);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'Inter',sans-serif;margin-left:3px}

/* ── Confirm dialog ─────────────────────────────────── */
.confirm-bg{position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
body.dark .confirm-bg{background:rgba(0,0,0,0.65)}
.confirm-box{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:380px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center}
.confirm-icon{width:44px;height:44px;border-radius:50%;background:var(--bg-muted);color:var(--text-muted);display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
.confirm-icon.danger{background:var(--accent-red-soft);color:var(--accent-red)}
.confirm-icon svg{width:22px;height:22px}
.confirm-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px}
.confirm-msg{font-size:13px;color:var(--text-muted);line-height:1.5;margin-bottom:18px}
.confirm-actions{display:flex;gap:8px;justify-content:flex-end}
.confirm-actions .btn{min-width:100px;justify-content:center}
.btn-danger{background:var(--accent-red);color:#fff;border-color:var(--accent-red);box-shadow:0 1px 3px rgba(220,38,38,0.3)}
.btn-danger:hover{background:#B91C1C;border-color:#B91C1C}

/* ── Empty state ─────────────────────────────────── */
.empty-state{
  background:var(--bg-card);
  border:1px dashed var(--border-strong);
  border-radius:14px;
  padding:48px 24px;
  text-align:center;
  color:var(--text-muted);
}
.empty-state .es-icon{
  width:56px;height:56px;border-radius:14px;
  background:var(--bg-muted);
  color:var(--text-muted);
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 16px;
}
.empty-state .es-icon svg{width:26px;height:26px}
.empty-state .es-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px}
.empty-state .es-desc{font-size:13px;color:var(--text-muted);line-height:1.55;margin-bottom:18px;max-width:360px;margin-left:auto;margin-right:auto}
.empty-state .es-cta{display:inline-flex}

/* ── Appbar menu (engranatge → tema/dreceres/changelog) ──── */
.appbar-menu-btn{
  width:34px;height:34px;
  border:1px solid var(--border);
  background:#fff;
  border-radius:8px;
  display:inline-flex;align-items:center;justify-content:center;
  color:var(--text-muted);cursor:pointer;
  transition:all 150ms;margin-right:6px;
}
.appbar-menu-btn:hover{background:var(--bg-muted);color:var(--text)}
.appbar-menu-btn svg{width:16px;height:16px}
body.dark .appbar-menu-btn{background:var(--bg-card);color:var(--text)}
body.dark .appbar-menu-btn:hover{background:var(--bg-hover)}

.appbar-menu{
  display:none;position:absolute;top:46px;right:14px;
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:10px;
  padding:5px;min-width:200px;
  box-shadow:var(--shadow-lg);
  z-index:90;
}
.appbar-menu.open{display:block}
.appbar-menu-item{
  display:flex;align-items:center;gap:10px;
  padding:8px 10px;width:100%;
  border:none;background:transparent;
  color:var(--text);cursor:pointer;
  font-size:13px;font-weight:500;
  font-family:inherit;text-align:left;
  border-radius:6px;text-decoration:none;
  transition:background 120ms;
}
.appbar-menu-item:hover{background:var(--bg-muted)}
.appbar-menu-item svg{width:15px;height:15px;color:var(--text-muted);flex-shrink:0}
.appbar-menu-item:hover svg{color:var(--text)}
.ami-moon{display:inline}
.ami-sun{display:none}
body.dark .ami-moon{display:none}
body.dark .ami-sun{display:inline}

/* ── Draft restore banner ─────────────────────────────── */
.draft-banner{
  background:var(--accent-amber-soft);
  border:1px solid #FCD34D;
  border-radius:10px;
  padding:10px 14px;
  font-size:12.5px;
  color:var(--accent-amber-text);
  display:flex;align-items:center;gap:10px;
  margin-bottom:14px;
}
.draft-banner svg{flex-shrink:0;width:16px;height:16px}
.draft-banner-actions{margin-left:auto;display:flex;gap:6px}
.draft-banner button{padding:3px 9px;font-size:11.5px}
`;
document.head.appendChild(_pStyle);
