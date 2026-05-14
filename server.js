const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const os = require('os');
const { readJSON, writeJSON, hasKey, DATA_DIR, DB_PATH } = require('./db');
const mailer = require('./lib/email');
const ai = require('./lib/ai');
const tokens = require('./lib/tokens');
const icsLib = require('./lib/ics');
const tmpl = require('./lib/emailTemplates');
const google = require('./lib/google');
const festius = require('./lib/festius');
const auth = require('./lib/auth');

const app = express();
app.use(compression()); // gzip per a tot: redueix JS/HTML/CSS ~70%
app.use(express.json({ limit: '32mb' }));
app.use(cookieParser());

// ── HEADERS PER A INTEGRACIÓ AMB MICROSOFT TEAMS ────────────────
// Teams carrega l'app dins d'un iframe. Si retornem X-Frame-Options:DENY
// (o un CSP frame-ancestors restrictiu), Teams mostra una pantalla en blanc.
// Aquests dominis són els hosts on Teams pot embed contingut:
//   · *.teams.microsoft.com  · *.skype.com  · *.microsoft365.com
// Trust the proxy (Nginx) per a què req.protocol/req.ip funcionin bé
app.set('trust proxy', 1);
app.use((req, res, next) => {
  // Permetre embed en Teams + clients Office
  res.removeHeader('X-Frame-Options'); // per si alguna middleware el posa
  res.setHeader('Content-Security-Policy',
    "frame-ancestors 'self' " +
    "https://teams.microsoft.com https://*.teams.microsoft.com " +
    "https://*.skype.com https://*.microsoft365.com " +
    "https://*.office.com https://*.officeapps.live.com " +
    "https://*.sharepoint.com");
  // HSTS si arribem via HTTPS (només si trust proxy detecta protocol)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});
// ── MAINTENANCE MODE MIDDLEWARE ──────────────────────────────────
// Si la flag està activa: tothom veu /maintenance.html
// Excepcions (sempre accessibles): /admin*, /api/admin/*, /maintenance, assets estàtics
function isMaintenanceBypass(req) {
  const p = req.path;
  if (p === '/admin' || p.startsWith('/admin/')) return true;
  if (p.startsWith('/api/admin/')) return true;
  if (p === '/maintenance' || p === '/maintenance.html') return true;
  // Login: durant manteniment els admins han de poder entrar a /admin
  if (p === '/login' || p === '/login.html') return true;
  if (p.startsWith('/api/auth/')) return true;
  // Assets necessaris perquè la pàgina de manteniment renderitzi
  if (p.startsWith('/css/') || p.startsWith('/js/') || p === '/favicon.svg') return true;
  return false;
}

app.use((req, res, next) => {
  if (isMaintenanceBypass(req)) return next();
  const m = readJSON('maintenance.json', { active: false });
  if (!m.active) return next();
  // Headers anti-cache perquè el navegador no es quedi amb la pàgina anterior
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  // Per peticions HTML serveix la pàgina; per /api retorna 503 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({ error: 'Servei en manteniment', message: m.message || '' });
  }
  res.status(503).sendFile(path.join(__dirname, 'public', 'maintenance.html'));
});

// `index: false` perquè la ruta "/" custom funcioni (redirigeix a /peticio)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── AUTH · endpoints + middleware ──────────────────────────────
// Login: rep email+password, retorna sessió + cookie HttpOnly
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email i password obligatoris' });
  const user = auth.findUserByEmail(email);
  if (!user || !auth.verifyPassword(password, user.password)) {
    // No revelem si l'usuari existeix o no
    return res.status(401).json({ ok: false, error: 'Credencials incorrectes' });
  }
  const { token, expiresAt } = auth.createSession(user.email);
  // SameSite='none' és essencial perquè la cookie funcioni dins de l'iframe de
  // Microsoft Teams (l'app es carrega a teams.microsoft.com com a "top frame"
  // i planner.gesem.es queda com a "third-party"). Sense això, el navegador
  // bloqueja la cookie de sessió quan l'app corre dins de Teams.
  // Requereix Secure:true, que ja tenim via HTTPS en producció.
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(auth.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',  // 'none' només funciona amb Secure
    maxAge: auth.SESSION_TTL_MS,
    path: '/',
  });
  const { password: _, ...safe } = user;
  res.json({ ok: true, user: safe, expiresAt });
});

// Estat de sessió actual · si no està logat, 200 amb user:null (no 401)
app.get('/api/auth/me', (req, res) => {
  const token = req.cookies && req.cookies[auth.COOKIE_NAME];
  const user = auth.validateSession(token);
  res.json({ authenticated: !!user, user: user || null });
});

// Edita el propi perfil · només l'usuari pot tocar el seu compte (no rol!)
// Permet canviar: name, img · password (requereix currentPassword)
app.put('/api/auth/me', (req, res) => {
  const token = req.cookies && req.cookies[auth.COOKIE_NAME];
  const sessionUser = auth.validateSession(token);
  if (!sessionUser) return res.status(401).json({ ok: false, error: 'No autenticat' });
  const { name, img, currentPassword, newPassword } = req.body || {};
  const patch = {};
  if (name !== undefined && String(name).trim()) patch.name = String(name).trim();
  if (img !== undefined) patch.img = img;  // null o data URL
  // Canvi de contrasenya: verificar la actual
  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ ok: false, error: 'Cal la contrasenya actual per a canviar-la' });
    const fullUser = auth.findUserByEmail(sessionUser.email);
    if (!auth.verifyPassword(currentPassword, fullUser.password)) {
      return res.status(401).json({ ok: false, error: 'Contrasenya actual incorrecta' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ ok: false, error: 'La nova contrasenya ha de tenir min 8 caràcters' });
    }
    patch.password = newPassword;
  }
  try {
    const updated = auth.updateUser(sessionUser.email, patch);
    res.json({ ok: true, user: updated });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Logout · esborra cookie + invalida sessió
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies && req.cookies[auth.COOKIE_NAME];
  if (token) auth.revokeSession(token);
  // Per a clearCookie cal indicar els mateixos atributs amb què es va crear
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(auth.COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
  });
  res.json({ ok: true });
});

// Middleware d'autenticació · protegeix totes les rutes excepte les públiques
// (login, assets, /r/:token, /api/google/callback, /maintenance)
app.use(auth.middleware());

// Crear usuari admin inicial al boot si encara no n'hi ha cap
auth.ensureInitialAdmin();

// Cleanup periòdic de sessions caducades (cada 6h)
setInterval(() => { try { auth.cleanupExpired(); } catch(e){} }, 6 * 60 * 60 * 1000);

// Endpoint per a /login (públic)
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login.html', (req, res) => res.redirect('/login'));

// ── ADMIN: gestió d'usuaris (només per admins) ─────────────────
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Cal rol admin' });
  }
  next();
}

app.get('/api/auth/users', requireAdmin, (req, res) => {
  res.json({ users: auth.listUsers() });
});

app.post('/api/auth/users', requireAdmin, (req, res) => {
  try {
    const u = auth.createUser(req.body || {});
    res.json({ ok: true, user: u });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.put('/api/auth/users/:email', requireAdmin, (req, res) => {
  try {
    const u = auth.updateUser(decodeURIComponent(req.params.email), req.body || {});
    res.json({ ok: true, user: u });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.delete('/api/auth/users/:email', requireAdmin, (req, res) => {
  // No permetre eliminar el propi usuari (per evitar quedar-se fora)
  if (decodeURIComponent(req.params.email).toLowerCase() === (req.user.email || '').toLowerCase()) {
    return res.status(400).json({ ok: false, error: 'No pots eliminar el teu propi usuari' });
  }
  const ok = auth.deleteUser(decodeURIComponent(req.params.email));
  res.json({ ok });
});

// ── ADMIN: estat de manteniment ────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
// Permet previsualitzar la pàgina de manteniment encara que no estigui activa
app.get('/maintenance', (req, res) => res.sendFile(path.join(__dirname, 'public', 'maintenance.html')));

app.get('/api/admin/maintenance', (req, res) => {
  res.json(readJSON('maintenance.json', { active: false }));
});

app.post('/api/admin/maintenance', (req, res) => {
  const { active, message } = req.body || {};
  const cur = readJSON('maintenance.json', { active: false });
  const next = {
    active: !!active,
    message: typeof message === 'string' ? message : (cur.message || ''),
    activatedAt: active && !cur.active ? new Date().toISOString() : (active ? cur.activatedAt : null),
  };
  writeJSON('maintenance.json', next);
  res.json({ ok: true, ...next });
});

// Helper: sendFile amb headers anti-cache (per que el manteniment s'apliqui
// instantàniament i les actualitzacions de versió no es quedin a cache)
function sendNoCache(res, file) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.sendFile(file);
}

// ── RUTES NETES PER A LES PÀGINES ────────────────────────────────
const PAGE_ROUTES = ['peticio', 'gestio', 'canvis', 'formadors', 'entrades', 'changelog'];
PAGE_ROUTES.forEach(r => {
  app.get('/' + r, (req, res) => sendNoCache(res, path.join(__dirname, 'public', r + '.html')));
});
// "/" redirigeix a /peticio (la pàgina d'inici · Dashboard eliminat a v22)
app.get('/', (req, res) => res.redirect('/peticio'));
// /dashboard → /peticio (compat amb URLs antigues)
app.get('/dashboard', (req, res) => res.redirect('/peticio'));

const AV_COLORS = ['#1D9E75','#185FA5','#854F0B','#534AB7','#993C1D','#3B6D11','#72243E','#D85A30','#0F6E56','#3C3489'];

// ── DADES INICIALS ────────────────────────────────────────────────
function seedIfEmpty() {
  if (!hasKey('agents.json')) {
    writeJSON('agents.json', [
      { nom: 'Jordi Llopart', color: AV_COLORS[0] },
      { nom: 'Marc Abad',     color: AV_COLORS[1] },
      { nom: 'Raquel Muñoz',  color: AV_COLORS[2] },
      { nom: 'Marta Ruiz',    color: AV_COLORS[3] }
    ]);
    console.log('Agents inicials creats.');
  }

  if (!hasKey('cats.json')) {
    writeJSON('cats.json', {
      esp:   ['Lideratge i management','Comunicació efectiva','Vendes i negociació','Excel i eines Office','Prevenció de riscos','Atenció al client','Treball en equip','Habilitats digitals','Recursos humans','Finances per no financers','Idiomes','Presentacions efectives'],
      modal: ['Presencial','Síncrona online','Híbrida','E-learning asíncron'],
      hsess: ['1.5','2','2.5','3','4'],
      torn:  ['9:30–11:30h','12:00–15:00h','9:00–11:00h','16:00–18:00h','Qualsevol']
    });
    console.log('Catàlegs inicials creats.');
  }

  if (!hasKey('formadors.json')) {
    function sd(n, mx) { let v = n * 2654435761 | 0; v = ((v ^ (v >>> 16)) * 2246822519 | 0); return Math.abs(v) % mx; }
    const esps = readJSON('cats.json', {}).esp || [];
    const noms = ['Marta Alonso','Jordi Roca','Clara López','Pere Ribas','Núria Bosch','Anna Ferrer','Marc Puig','Laia Soler','David Valls','Elena Martí','Pau Giménez','Sílvia Torres','Raül Domínguez','Irene Castells','Carles Mas'];
    const formadors = noms.map((nom, i) => ({
      id: i, nom,
      email: nom.split(' ')[0].toLowerCase() + '.' + nom.split(' ')[1].toLowerCase() + '@formadors.cat',
      tel: '6' + String(sd(i*7, 90000000) + 10000000),
      tipus: i < 5 ? 'intern' : 'extern',
      specs: [esps[sd(i*7+1, esps.length)], esps[sd(i*7+3, esps.length)]].filter((v,j,a) => a.indexOf(v)===j),
      preu_hora: 30 + sd(i*3, 45),
      rating: (4.1 + sd(i*3+1, 9) * 0.1).toFixed(1),
      cursos: 4 + sd(i*5+2, 35),
      disp: ['alta','alta','alta','parcial','baixa'][sd(i*7+5, 5)],
      agenda: 'manual',
      notes: '',
      img: null
    }));
    writeJSON('formadors.json', formadors);
    console.log('Formadors inicials creats.');
  }

  if (!hasKey('reserves.json')) {
    writeJSON('reserves.json', []);
    console.log('Fitxer reserves creat.');
  }
}
seedIfEmpty();

// ── API: EMAIL (SMTP) ─────────────────────────────────────────────
// GET  /api/email/status   → { configured: bool, host, user, ... }
// POST /api/email/test     → comprova connexió SMTP (verify)
// POST /api/email/send     → { to, subject, text|html, replyTo?, cc?, bcc? }

app.get('/api/email/status', (req, res) => {
  res.json({ configured: mailer.isConfigured(), config: mailer.getConfig() });
});

app.post('/api/email/test', async (req, res) => {
  try {
    await mailer.verifyConnection();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/email/send', async (req, res) => {
  if (!mailer.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'SMTP no configurat al servidor' });
  }
  const { to, subject, text, html, replyTo, cc, bcc } = req.body || {};
  if (!to || !subject) {
    return res.status(400).json({ ok: false, error: 'Falten camps to i subject' });
  }
  try {
    const result = await mailer.sendMail({ to, subject, text, html, replyTo, cc, bcc });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Error enviant email:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── API: AI (Groq · Llama 3.3) ────────────────────────────────────
app.get('/api/ai/status', (req, res) => {
  res.json({ configured: ai.isConfigured(), model: ai.getModel() });
});

app.post('/api/ai/test', async (req, res) => {
  if (!ai.isConfigured()) return res.status(503).json({ ok: false, error: 'IA no configurada' });
  try {
    const result = await ai.verifyConnection();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Suggeriment de canvis a una reserva (per a /canvis)
app.post('/api/ai/suggest-changes', async (req, res) => {
  if (!ai.isConfigured()) return res.status(503).json({ ok: false, error: 'IA no configurada' });
  const { reservaId, tipus, motiu } = req.body || {};
  if (!reservaId || !tipus) return res.status(400).json({ ok: false, error: 'Falten reservaId/tipus' });
  try {
    const reserves = readJSON('reserves.json', []);
    const formadors = readJSON('formadors.json', []);
    const cats = readJSON('cats.json', {});
    const reserva = reserves.find(r => r.id === reservaId);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no trobada' });
    const formadorActual = formadors.find(f => f.id === reserva.formadorId);
    const formadorsAlternatius = formadors.filter(f => f.id !== reserva.formadorId);
    const allReservaDates = new Set(reserves.filter(r => r.id !== reservaId && r.estat !== 'cancel').flatMap(r => r.dates || []));
    // Festius (els hardcodejats al frontend; reuse del catàleg si està)
    // Festius calculats dinàmicament (Espanya + Catalunya + Barcelona)
    // Per a la IA li passem només els ISO ordenats, dels propers 2 anys
    const fest = festius.getFestiusForRange(new Date().getFullYear(), new Date().getFullYear() + 1);
    const festiusList = Object.keys(fest).sort();
    const start = Date.now();
    const result = await ai.suggestChanges({ reserva, tipus, motiu, formadorActual, formadorsAlternatius, allReservaDates, festius: festiusList });
    res.json({ ok: true, ...result, ms: Date.now() - start });
  } catch (e) {
    console.error('AI suggest-changes:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Suggeriment del millor formador per a una nova petició
app.post('/api/ai/suggest-formador', async (req, res) => {
  if (!ai.isConfigured()) return res.status(503).json({ ok: false, error: 'IA no configurada' });
  const { peticio } = req.body || {};
  if (!peticio || !peticio.client) return res.status(400).json({ ok: false, error: 'Falten dades de petició' });
  try {
    const formadors = readJSON('formadors.json', []);
    const reservesPrevies = readJSON('reserves.json', []);
    const start = Date.now();
    const result = await ai.suggestFormador({ peticio, formadors, reservesPrevies });
    res.json({ ok: true, ...result, ms: Date.now() - start });
  } catch (e) {
    console.error('AI suggest-formador:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/ai/parse-email', async (req, res) => {
  if (!ai.isConfigured()) return res.status(503).json({ ok: false, error: 'IA no configurada al servidor' });
  const { text } = req.body || {};
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ ok: false, error: 'Text massa curt' });
  }
  try {
    const cats = readJSON('cats.json', {});
    const agents = readJSON('agents.json', []);
    const start = Date.now();
    const result = await ai.parseCommercialEmail(text, {
      especialitats: cats.esp || [],
      modalitats:    cats.modal || [],
      torns:         cats.torn || [],
      agents:        agents.map(a => a.nom),
    });
    const ms = Date.now() - start;
    res.json({ ok: true, ...result, ms });
  } catch (e) {
    console.error('AI parse-email error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GOOGLE CALENDAR · OAuth 2-way ──────────────────────────────
// 1) GET  /api/google/status         · estat global (configurat?)
// 2) GET  /api/google/connections    · llista de formadors connectats
// 3) GET  /api/google/auth/start?formadorId=X  · redirigeix a Google
// 4) GET  /api/google/callback?code=X&state=Y  · callback OAuth (públic)
// 5) POST /api/google/disconnect     · { formadorId }
// 6) POST /api/google/sync-reserva   · { reservaId } · força sync (test)

app.get('/api/google/status', (req, res) => {
  res.json({
    configured: google.isConfigured(),
    redirectUri: process.env.GOOGLE_REDIRECT_URI || null,
  });
});

app.get('/api/google/connections', (req, res) => {
  const tokenStore = readJSON('google_tokens.json', {});
  const connected = Object.keys(tokenStore).map(id => ({
    formadorId: parseInt(id),
    connectedAt: tokenStore[id].connected_at || null,
    hasRefreshToken: !!tokenStore[id].refresh_token,
  }));
  res.json({ connected });
});

app.get('/api/google/auth/start', (req, res) => {
  if (!google.isConfigured()) return res.status(503).send('Google OAuth no configurat. Afegeix GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET i GOOGLE_REDIRECT_URI al .env del servidor.');
  const formadorId = parseInt(req.query.formadorId);
  if (!formadorId) return res.status(400).send('Falta formadorId');
  res.redirect(google.buildAuthUrl(formadorId));
});

app.get('/api/google/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state || '';
  const error = req.query.error;
  if (error) return res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>❌ Autorització cancel·lada</h2><p>${error}</p><a href="/formadors">Tornar</a></body></html>`);
  if (!code) return res.status(400).send('Falta code');
  const formadorId = parseInt((state || '').replace('formador_', ''));
  if (!formadorId) return res.status(400).send('State invàlid');

  try {
    const tok = await google.exchangeCodeForToken(code);
    const tokenStore = readJSON('google_tokens.json', {});
    tokenStore[formadorId] = {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token || tokenStore[formadorId]?.refresh_token,
      expires_at: Date.now() + (tok.expires_in || 3600) * 1000,
      connected_at: new Date().toISOString(),
      scope: tok.scope,
    };
    writeJSON('google_tokens.json', tokenStore);
    // Pàgina de confirmació maca
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Connectat a Google</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAFAF7;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#fff;border:1px solid #E7E5E4;border-radius:14px;padding:40px;text-align:center;max-width:420px;box-shadow:0 4px 12px rgba(0,0,0,0.06)}.icon{font-size:56px;margin-bottom:14px}.title{font-size:20px;font-weight:600;margin-bottom:6px}.desc{color:#71717A;font-size:14px;line-height:1.55;margin-bottom:24px}.btn{display:inline-block;background:#059669;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}</style></head><body><div class="box"><div class="icon">✅</div><div class="title">Calendari de Google connectat!</div><div class="desc">Ara GESEM Planner pot crear events directament al teu calendari quan es confirmi una reserva.</div><a href="/formadors" class="btn">Tornar a GESEM Planner</a></div></body></html>`);
  } catch (e) {
    res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>❌ Error connectant Google</h2><p>${e.message}</p><a href="/formadors">Tornar</a></body></html>`);
  }
});

app.post('/api/google/disconnect', (req, res) => {
  const { formadorId } = req.body || {};
  if (!formadorId) return res.status(400).json({ ok: false, error: 'Falta formadorId' });
  const tokenStore = readJSON('google_tokens.json', {});
  delete tokenStore[formadorId];
  writeJSON('google_tokens.json', tokenStore);
  res.json({ ok: true });
});

// Helper: sync events d'una reserva al calendari del seu formador (si està connectat)
async function autoSyncReservaToGoogle(reserva) {
  if (!google.isConfigured()) return { skipped: true, reason: 'Google not configured' };
  if (!reserva || !reserva.formadorId) return { skipped: true, reason: 'no formadorId' };
  const tokenStore = readJSON('google_tokens.json', {});
  if (!tokenStore[reserva.formadorId]) return { skipped: true, reason: 'formador not connected' };
  try {
    const { accessToken, store } = await google.getValidAccessToken(tokenStore, reserva.formadorId);
    writeJSON('google_tokens.json', store); // desar si el token s'ha refrescat
    // Parsa el torn
    const t = icsLib.parseTorn(reserva.torn);
    const torn = { startH: t.startH, startM: t.startM };
    const sessionMinutes = (parseFloat(reserva.hs) || 2) * 60;
    const result = await google.createEventsForReserva({ accessToken, reserva, torn, sessionMinutes });
    return { ok: true, ...result };
  } catch (e) {
    console.warn('Google sync failed for reserva', reserva.id, ':', e.message);
    return { ok: false, error: e.message };
  }
}

app.post('/api/google/sync-reserva', async (req, res) => {
  const { reservaId } = req.body || {};
  if (!reservaId) return res.status(400).json({ ok: false, error: 'Falta reservaId' });
  const reserves = readJSON('reserves.json', []);
  const reserva = reserves.find(r => r.id === reservaId);
  if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no trobada' });
  const result = await autoSyncReservaToGoogle(reserva);
  res.json(result);
});

// ── EMAIL FORMADOR amb CONFIRMACIÓ (HTML + .ics + tokens) ──────
// POST /api/email/send-formador-confirm  { reservaId, body, subject, to }
app.post('/api/email/send-formador-confirm', async (req, res) => {
  if (!mailer.isConfigured()) return res.status(503).json({ ok: false, error: 'SMTP no configurat' });
  const { reservaId, body, subject, to } = req.body || {};
  if (!reservaId || !subject || !to) return res.status(400).json({ ok: false, error: 'Falten camps' });
  const reserves = readJSON('reserves.json', []);
  const reserva = reserves.find(r => r.id === reservaId);
  if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no trobada' });

  const baseUrl = process.env.BASE_URL || ('http://' + (req.get('host') || 'localhost:3001'));
  const token = tokens.signReservaToken(reservaId, reserva.formadorId);

  // Build HTML email + ICS attachment
  const html = tmpl.formadorEmailHtml({ reserva, plainBody: body, baseUrl, token });
  const ics = icsLib.buildIcs(reserva);
  const filename = icsLib.icsFilename(reserva);

  try {
    const result = await mailer.sendMail({
      to,
      subject,
      text: body,  // fallback si el client d'email no suporta HTML
      html,
      attachments: [{ filename, content: ics, contentType: 'text/calendar; method=PUBLISH; charset=UTF-8' }],
    });
    // Marcar la reserva com a "email enviat amb confirmació"
    reserva.emailFormadorEnviat = true;
    reserva.formadorAccepted = null;
    reserva.formadorTokenSentAt = new Date().toISOString();
    writeJSON('reserves.json', reserves);
    res.json({ ok: true, ...result, token, baseUrl });
  } catch (e) {
    console.error('Error enviant email confirmació formador:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── PÀGINA PÚBLICA · Resposta del formador ──────────────────────
// GET /r/:token       → vista per defecte (?a=accept o ?a=decline)
// POST /r/:token/accept
// POST /r/:token/decline (form-data: reason)
// GET /r/:token/ics   → descarregar fitxer calendari

function loadReservaFromToken(token) {
  const payload = tokens.verify(token); // throws si invàlid/caducat
  const reserves = readJSON('reserves.json', []);
  const reserva = reserves.find(r => r.id === payload.reservaId);
  if (!reserva) throw new Error('Reserva no trobada');
  return { reserva, reserves, payload };
}

app.get('/r/:token', (req, res) => {
  const baseUrl = process.env.BASE_URL || ('http://' + (req.get('host') || 'localhost:3001'));
  const action = req.query.a || 'view';
  try {
    const { reserva } = loadReservaFromToken(req.params.token);
    if (action === 'accept') {
      // Acció directa via GET (clic de l'email) — només si encara no ha respost
      if (reserva.formadorAccepted == null) {
        return acceptReserva(req.params.token, req, res);
      }
      // Si ja havia respost, mostra la pantalla de gràcies
      return res.send(tmpl.responsePage({ reserva, action: 'accept', token: req.params.token, baseUrl, message: 'ok' }));
    }
    if (action === 'decline') {
      // Mostra el form per al motiu (no l'acció encara)
      return res.send(tmpl.responsePage({ reserva, action: 'decline', token: req.params.token, baseUrl }));
    }
    res.send(tmpl.responsePage({ reserva, action: 'view', token: req.params.token, baseUrl }));
  } catch (e) {
    res.status(400).send(tmpl.responsePage({ action: 'view', token: req.params.token, baseUrl, error: e.message }));
  }
});

function acceptReserva(token, req, res) {
  try {
    const { reserva, reserves } = loadReservaFromToken(token);
    if (reserva.formadorAccepted == null) {
      reserva.formadorAccepted = true;
      reserva.formadorRespondedAt = new Date().toISOString();
      // Auto-promote: si estava pendent-form, passa a confirmada
      if (reserva.estat === 'pendent-form' || reserva.estat === 'pendent-cli') {
        reserva.estat = 'confirmada';
      }
      writeJSON('reserves.json', reserves);
      // Notificar el comercial (asíncron, sense bloquejar la resposta)
      notifyAgentOfResponse(reserva, true).catch(e => console.warn('Notif agent fail:', e.message));
    }
    const baseUrl = process.env.BASE_URL || ('http://' + (req.get('host') || 'localhost:3001'));
    res.send(tmpl.responsePage({ reserva, action: 'accept', token, baseUrl, message: 'ok' }));
  } catch (e) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    res.status(400).send(tmpl.responsePage({ action: 'view', token, baseUrl, error: e.message }));
  }
}

// POST decline amb form-data (formulari de motiu)
app.post('/r/:token/decline', express.urlencoded({ extended: false }), (req, res) => {
  const baseUrl = process.env.BASE_URL || ('http://' + (req.get('host') || 'localhost:3001'));
  try {
    const { reserva, reserves } = loadReservaFromToken(req.params.token);
    if (reserva.formadorAccepted == null) {
      reserva.formadorAccepted = false;
      reserva.formadorDeclineReason = (req.body.reason || '').slice(0, 500);
      reserva.formadorRespondedAt = new Date().toISOString();
      writeJSON('reserves.json', reserves);
      notifyAgentOfResponse(reserva, false).catch(e => console.warn('Notif agent fail:', e.message));
    }
    res.send(tmpl.responsePage({ reserva, action: 'decline', token: req.params.token, baseUrl, message: 'ok' }));
  } catch (e) {
    res.status(400).send(tmpl.responsePage({ action: 'view', token: req.params.token, baseUrl, error: e.message }));
  }
});

// Descarregar el fitxer .ics de la reserva
app.get('/r/:token/ics', (req, res) => {
  try {
    const { reserva } = loadReservaFromToken(req.params.token);
    const ics = icsLib.buildIcs(reserva);
    const filename = icsLib.icsFilename(reserva);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(ics);
  } catch (e) {
    res.status(400).send('Token invàlid o reserva no trobada');
  }
});

// Notifica al comercial que el formador ha respost
async function notifyAgentOfResponse(reserva, accepted) {
  if (!mailer.isConfigured()) return;
  if (!reserva.comercial) return;
  // Busca el correu real de l'agent comercial; si no n'hi ha, fallback a l'autogenerat
  const agents = readJSON('agents.json', []);
  const agent = agents.find(a => (a.nom || '').toLowerCase() === (reserva.comercial || '').toLowerCase());
  const agentEmail = (agent && agent.email)
    ? agent.email
    : ((reserva.comercial || '').toLowerCase().replace(/\s+/g, '.') + '@gesem.es');
  const subject = accepted
    ? `✓ ${reserva.formador} ha ACCEPTAT · ${reserva.curs} · ${reserva.client}`
    : `✕ ${reserva.formador} ha DECLINAT · ${reserva.curs} · ${reserva.client}`;
  const body = accepted
    ? `Hola ${reserva.comercial},\n\nEl formador ${reserva.formador} ha acceptat les dates de la reserva pel curs "${reserva.curs}" del client ${reserva.client}.\n\nHa estat afegit al seu calendari (envia el fitxer .ics).\n\nLa reserva s'ha marcat com a CONFIRMADA al sistema.\n\nGESEM Planner`
    : `Hola ${reserva.comercial},\n\nEl formador ${reserva.formador} ha DECLINAT la reserva pel curs "${reserva.curs}" del client ${reserva.client}.\n\nMotiu indicat:\n${reserva.formadorDeclineReason || '(sense motiu)'}\n\nCaldrà buscar dates alternatives o un altre formador.\n\nGESEM Planner`;
  await mailer.sendMail({ to: agentEmail, subject, text: body });
}

// ── API: BOOTSTRAP (un sol fetch en lloc de 4) ──────────────────
app.get('/api/bootstrap', (req, res) => {
  // Inclou els festius dels propers 2 anys (any actual + següent) per a estalviar
  // una crida extra al client
  const yNow = new Date().getFullYear();
  res.json({
    cats:      readJSON('cats.json',      {}),
    agents:    readJSON('agents.json',    []),
    formadors: readJSON('formadors.json', []),
    reserves:  readJSON('reserves.json',  []),
    festius:   festius.getFestiusForRange(yNow, yNow + 1),
    serverTime: new Date().toISOString(),
  });
});

// ── API: FESTIUS ─────────────────────────────────────────────────
// Festius oficials d'Espanya + Catalunya + Barcelona (calculats dinàmicament,
// incloent Pasqua mòbil). Query opcional: ?from=2026&to=2027
app.get('/api/festius', (req, res) => {
  const yNow = new Date().getFullYear();
  const from = parseInt(req.query.from) || yNow;
  const to = parseInt(req.query.to) || (yNow + 1);
  if (to - from > 10) return res.status(400).json({ error: 'Rang massa gran (max 10 anys)' });
  const includeBarcelona = req.query.bcn !== '0'; // default: inclou
  res.json({
    from, to,
    festius: festius.getFestiusForRange(from, to, { includeBarcelona }),
  });
});

// ── API: AGENTS ───────────────────────────────────────────────────
app.get('/api/agents', (req, res) => {
  res.json(readJSON('agents.json', []));
});
app.post('/api/agents', (req, res) => {
  const { nom, email, color, img } = req.body;
  if (!nom) return res.status(400).json({ error: 'nom requerit' });
  const agents = readJSON('agents.json', []);
  const idx = agents.findIndex(a => a.nom === nom);
  const next = { nom, color };
  if (email !== undefined) next.email = (email || '').trim().toLowerCase();
  if (img !== undefined) next.img = img;
  if (idx >= 0) agents[idx] = { ...agents[idx], ...next };
  else agents.push(next);
  writeJSON('agents.json', agents);
  res.json({ ok: true });
});
app.delete('/api/agents/:nom', (req, res) => {
  let agents = readJSON('agents.json', []);
  agents = agents.filter(a => a.nom !== decodeURIComponent(req.params.nom));
  writeJSON('agents.json', agents);
  res.json({ ok: true });
});
// PUT: editar (suporta canvi de nom) — la URL porta el nom antic
app.put('/api/agents/:nom', (req, res) => {
  const oldNom = decodeURIComponent(req.params.nom);
  const { nom, email, color, img } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'nom requerit' });
  const agents = readJSON('agents.json', []);
  const idx = agents.findIndex(a => a.nom === oldNom);
  if (idx < 0) return res.status(404).json({ error: 'agent no trobat' });
  // Si canvia el nom, comprovar que no col·lisiona
  if (nom !== oldNom && agents.some(a => a.nom === nom)) {
    return res.status(409).json({ error: 'ja existeix un agent amb aquest nom' });
  }
  const updated = { nom, color: color || agents[idx].color };
  // email: undefined = mantenir; '' = treure; string = nou
  if (email === undefined) updated.email = agents[idx].email;
  else if (email === '' || email === null) { /* es treu */ }
  else updated.email = String(email).trim().toLowerCase();
  // img: undefined = mantenir l'antic; null = treure; string = nou
  if (img === undefined) updated.img = agents[idx].img;
  else if (img === null) { /* no inclou img → es treu */ }
  else updated.img = img;
  agents[idx] = updated;
  writeJSON('agents.json', agents);
  // Si ha canviat el nom, propagar a les reserves
  if (nom !== oldNom) {
    const reserves = readJSON('reserves.json', []);
    let changed = 0;
    reserves.forEach(r => { if (r.comercial === oldNom) { r.comercial = nom; changed++; } });
    if (changed > 0) writeJSON('reserves.json', reserves);
    return res.json({ ok: true, renamed: true, reservesUpdated: changed });
  }
  res.json({ ok: true });
});

// ── API: FORMADORS ────────────────────────────────────────────────
app.get('/api/formadors', (req, res) => {
  res.json(readJSON('formadors.json', []));
});
app.post('/api/formadors', (req, res) => {
  const formadors = readJSON('formadors.json', []);
  const idx = formadors.findIndex(f => f.id === req.body.id);
  if (idx >= 0) formadors[idx] = req.body;
  else formadors.push(req.body);
  writeJSON('formadors.json', formadors);
  res.json({ ok: true });
});
app.put('/api/formadors/:id', (req, res) => {
  const formadors = readJSON('formadors.json', []);
  const idx = formadors.findIndex(f => f.id === parseInt(req.params.id));
  if (idx >= 0) formadors[idx] = { ...formadors[idx], ...req.body };
  writeJSON('formadors.json', formadors);
  res.json({ ok: true });
});
app.delete('/api/formadors/:id', (req, res) => {
  let formadors = readJSON('formadors.json', []);
  formadors = formadors.filter(f => f.id !== parseInt(req.params.id));
  writeJSON('formadors.json', formadors);
  res.json({ ok: true });
});

// ── API: RESERVES ─────────────────────────────────────────────────
app.get('/api/reserves', (req, res) => {
  res.json(readJSON('reserves.json', []));
});
app.post('/api/reserves', (req, res) => {
  const reserves = readJSON('reserves.json', []);
  reserves.push(req.body);
  writeJSON('reserves.json', reserves);
  res.json({ ok: true });
});
app.put('/api/reserves/:id', (req, res) => {
  const reserves = readJSON('reserves.json', []);
  const idx = reserves.findIndex(r => r.id === req.params.id);
  if (idx >= 0) reserves[idx] = req.body;
  writeJSON('reserves.json', reserves);
  res.json({ ok: true });
});
app.delete('/api/reserves/:id', (req, res) => {
  let reserves = readJSON('reserves.json', []);
  reserves = reserves.filter(r => r.id !== req.params.id);
  writeJSON('reserves.json', reserves);
  res.json({ ok: true });
});

// ── API: CATÀLEGS ─────────────────────────────────────────────────
app.get('/api/cats', (req, res) => {
  res.json(readJSON('cats.json', {}));
});
app.put('/api/cats/:cat', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items ha de ser array' });
  const cats = readJSON('cats.json', {});
  cats[req.params.cat] = items;
  writeJSON('cats.json', cats);
  res.json({ ok: true });
});

// ── INTEGRACIÓ ICAL / CALENDARIS ─────────────────────────────────

// In-memory cache (workspace en calent). Es popula al boot des de SQLite via
// readJSON('cal_cache.json') i es desa cada vegada que s'actualitza una entrada.
// Així sobreviu reinicis del procés (systemctl restart, deploy, crash).
const calCache = (function loadInitial(){
  try{
    const persisted = readJSON('cal_cache.json', {});
    // Filtrem entrades caducades en carregar
    const now = Date.now();
    const fresh = {};
    Object.entries(persisted || {}).forEach(([id, entry]) => {
      if (entry && entry.ts && now - entry.ts < 24*60*60*1000) {
        fresh[id] = entry;
      }
    });
    if (Object.keys(fresh).length){
      console.log('[cal-cache] Restaurades', Object.keys(fresh).length, 'entrades de calendari des de SQLite');
    }
    return fresh;
  }catch(e){
    return {};
  }
})();
const CACHE_TTL = 30 * 60 * 1000; // 30 minuts (TTL "fresc" — després es força re-fetch)

// Persisteix el cache amb debounce per no escriure SQLite en cada actualització.
let _calCacheSaveTimer = null;
function persistCalCache(){
  clearTimeout(_calCacheSaveTimer);
  _calCacheSaveTimer = setTimeout(() => {
    try { writeJSON('cal_cache.json', calCache); }
    catch(e) { console.warn('[cal-cache] persist failed:', e.message); }
  }, 500);
}

// ── Helpers de timezone (B2) ─────────────────────────────────
// La nostra "zona oficial" és Europe/Madrid (on opera GESEM).
// Tots els càlculs de DATA es fan en aquesta zona perquè un event que
// comença a les 23h de Madrid no es comptabilitzi al dia següent.
const CAL_TZ = 'Europe/Madrid';

// Donat un Date (UTC instant), retorna els components de wall-clock a Madrid.
function instantToMadridParts(d) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find(p => p.type === type)?.value;
  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    hour: parseInt(get('hour')) % 24,
    minute: parseInt(get('minute')),
    second: parseInt(get('second')),
  };
}

function toISODate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Parseja una data/hora iCal. Retorna { date: Date, isAllDay: bool, minOfDay: number }
//
// Política de zones (B2):
//   · isAllDay  → date és la data wall-clock a Madrid (00:00 local)
//   · acaba en Z (UTC) → convertim a wall-clock de Madrid abans de retornar
//   · TZID present (no UTC) → assumim que el wall-clock és en la zona indicada,
//     i (per simplicitat) el tractem com a Madrid wall-clock. En pràctica
//     totes les agendes GESEM són Europe/Madrid, així que això és correcte.
//   · Floating (sense Z ni TZID) → wall-clock local (Madrid del servidor)
function parseICSDate(str, tzid) {
  if (!str) return null;
  const raw = str.trim();
  const isAllDay = raw.length === 8 && /^\d{8}$/.test(raw);
  let d;
  if (isAllDay) {
    d = new Date(parseInt(raw.slice(0,4)), parseInt(raw.slice(4,6))-1, parseInt(raw.slice(6,8)));
    if (!d || isNaN(d.getTime())) return null;
    return { date: d, isAllDay: true, minOfDay: 0 };
  }
  const Y = parseInt(raw.slice(0,4)), M = parseInt(raw.slice(4,6))-1, D = parseInt(raw.slice(6,8));
  const h = parseInt(raw.slice(9,11)||0), mi = parseInt(raw.slice(11,13)||0), se = parseInt(raw.slice(13,15)||0);
  if (raw.endsWith('Z')) {
    // UTC instant → convertir a wall-clock Madrid
    const utcInstant = new Date(Date.UTC(Y, M, D, h, mi, se));
    if (isNaN(utcInstant.getTime())) return null;
    const p = instantToMadridParts(utcInstant);
    d = new Date(p.year, p.month-1, p.day, p.hour, p.minute, p.second);
  } else {
    // Floating o TZID: ja és wall-clock local
    d = new Date(Y, M, D, h, mi, se);
  }
  if (!d || isNaN(d.getTime())) return null;
  return { date: d, isAllDay: false, minOfDay: d.getHours()*60 + d.getMinutes() };
}

// ── Expansió de RRULE (B1) ───────────────────────────────────
// Implementem el subset més comú: FREQ, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY.
// Generem ocurrències fins a 18 mesos vista (suficient per al planning de cursos).
// Aplica EXDATE per excloure dates específiques.
const _RRULE_DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const _RRULE_HORIZON_DAYS = 540; // ~18 mesos
const _RRULE_MAX_OCCURRENCES = 400;

function expandRRule(rruleStr, dtStart, exDateSet) {
  const rules = {};
  rruleStr.split(';').forEach(part => {
    const [k, v] = part.split('=');
    if (k && v != null) rules[k.toUpperCase()] = v;
  });
  const freq = (rules.FREQ || '').toUpperCase();
  const interval = Math.max(1, parseInt(rules.INTERVAL) || 1);
  const count = rules.COUNT ? parseInt(rules.COUNT) : null;
  const until = rules.UNTIL ? parseICSDate(rules.UNTIL.replace(/[^0-9TZ]/g, ''))?.date : null;
  const byDay = rules.BYDAY ? rules.BYDAY.split(',').map(d => d.replace(/^[\-\+]?\d+/, '').trim()) : null;
  const byMonthDay = rules.BYMONTHDAY ? rules.BYMONTHDAY.split(',').map(n => parseInt(n)).filter(n => !isNaN(n)) : null;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + _RRULE_HORIZON_DAYS);

  const occurrences = [];
  let totalGenerated = 0; // inclou EXDATE excluded (compten per COUNT)
  const tryAdd = (d) => {
    if (occurrences.length >= _RRULE_MAX_OCCURRENCES) return false;
    if (until && d > until) return false;
    if (d > horizon) return false;
    if (count !== null && totalGenerated >= count) return false;
    totalGenerated++;
    const iso = toISODate(d);
    if (!exDateSet.has(iso)) occurrences.push(new Date(d.getTime()));
    return true;
  };

  let safety = 0;
  let cur = new Date(dtStart.getTime());

  if (freq === 'DAILY') {
    while (safety++ < 2000) {
      if (!tryAdd(cur)) break;
      cur.setDate(cur.getDate() + interval);
    }
  } else if (freq === 'WEEKLY') {
    // Sense BYDAY: 1 ocurrència per cada interval setmanes al mateix dia-setmana
    if (!byDay) {
      while (safety++ < 1000) {
        if (!tryAdd(cur)) break;
        cur.setDate(cur.getDate() + 7 * interval);
      }
    } else {
      const byDayNums = byDay.map(d => _RRULE_DAY_MAP[d]).filter(x => x !== undefined).sort();
      // Ancorem a l'inici de la setmana del DTSTART (mou cur al diumenge anterior o igual)
      const weekStart = new Date(cur);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // diumenge
      while (safety++ < 500) {
        let exhausted = false;
        for (const dayNum of byDayNums) {
          const occ = new Date(weekStart);
          occ.setDate(occ.getDate() + dayNum);
          if (occ >= dtStart) {
            if (!tryAdd(occ)) { exhausted = true; break; }
          }
        }
        if (exhausted) break;
        weekStart.setDate(weekStart.getDate() + 7 * interval);
        if (weekStart > horizon) break;
      }
    }
  } else if (freq === 'MONTHLY') {
    while (safety++ < 500) {
      if (byMonthDay) {
        const month = cur.getMonth(), year = cur.getFullYear();
        let stopped = false;
        for (const dom of byMonthDay) {
          const occ = new Date(year, month, dom);
          if (occ.getMonth() !== month) continue; // dia inexistent (ex: 31 a febrer)
          if (occ >= dtStart) {
            if (!tryAdd(occ)) { stopped = true; break; }
          }
        }
        if (stopped) break;
      } else {
        if (!tryAdd(cur)) break;
      }
      cur.setMonth(cur.getMonth() + interval);
    }
  } else if (freq === 'YEARLY') {
    while (safety++ < 50) {
      if (!tryAdd(cur)) break;
      cur.setFullYear(cur.getFullYear() + interval);
    }
  } else {
    // FREQ desconegut: només l'event original
    occurrences.push(new Date(dtStart.getTime()));
  }
  return occurrences;
}

// Parser principal: retorna slots amb franja horària exacta + dies complets bloquejats
function parseICSEvents(text) {
  const slots = [];       // [{date:'YYYY-MM-DD', startMin:int, endMin:int, allDay:bool, summary:str}]
  const fullDayDates = new Set(); // dies totalment bloquejats (events de dia sencer)

  const normalized = text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, ''); // unfold iCal line folding
  const lines = normalized.split('\n');

  let inEvent = false, inFB = false;
  let evStartRaw='', evEndRaw='', evTransp='', evStatus='', evSummary='', evDtStartTzid='';
  let evRRule='', evExDates=[];

  function addSlot(startInfo, endInfo) {
    if (!startInfo || !endInfo) return;
    if (startInfo.isAllDay) {
      // Event de dia sencer: bloquejar tots els dies del rang
      const d = new Date(startInfo.date); d.setHours(0,0,0,0);
      const e = new Date(endInfo.date);   e.setHours(0,0,0,0);
      // iCal: DTEND d'un all-day és exclusiu (dia següent), per tant iterem fins < e
      const limit = d.getTime() === e.getTime() ? new Date(d.getTime()+86400000) : e;
      const cur = new Date(d);
      while (cur < limit) { fullDayDates.add(toISODate(cur)); cur.setDate(cur.getDate()+1); }
    } else {
      // Event amb hora: guardar franja exacta
      const isoDate = toISODate(startInfo.date);
      const startMin = startInfo.minOfDay;
      // Si l'event acaba l'endemà, considerar fins a mitjanit (1440)
      let endMin = endInfo.minOfDay;
      if (toISODate(endInfo.date) !== isoDate && endMin === 0) endMin = 1440;
      else if (toISODate(endInfo.date) !== isoDate) endMin = 1440;
      slots.push({ date: isoDate, startMin, endMin: Math.max(startMin + 15, endMin), allDay: false, summary: evSummary });
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const fullKey = line.slice(0, colonIdx);
    const key = fullKey.split(';')[0].toUpperCase();
    const val = line.slice(colonIdx + 1).trim();
    // Extreure TZID dels paràmetres (ex: DTSTART;TZID=Europe/Madrid:...)
    const tzidMatch = fullKey.match(/TZID=([^;]+)/i);
    const tzid = tzidMatch ? tzidMatch[1] : null;

    if (key === 'BEGIN') {
      if (val === 'VEVENT')     { inEvent=true; evStartRaw=''; evEndRaw=''; evTransp=''; evStatus=''; evSummary=''; evDtStartTzid=''; evRRule=''; evExDates=[]; }
      if (val === 'VFREEBUSY') inFB = true;
    } else if (key === 'END') {
      if (val === 'VEVENT' && inEvent) {
        inEvent = false;
        if (evStatus === 'CANCELLED' || evStatus === 'TENTATIVE') {
          // skip
        } else {
          const s = parseICSDate(evStartRaw, evDtStartTzid);
          const eRawAdjusted = evEndRaw || (evStartRaw.length===8
            ? String(parseInt(evStartRaw.slice(0,8))+1).padStart(8,'0')
            : evStartRaw);
          const e = parseICSDate(eRawAdjusted, evDtStartTzid);
          const isAllDay = s && s.isAllDay;
          const include = isAllDay || evTransp !== 'TRANSPARENT';

          if (include && s) {
            if (evRRule) {
              // ── B1: expandir RRULE en ocurrències ──────────────────
              const exDateSet = new Set(evExDates.map(toISODate));
              const occs = expandRRule(evRRule, s.date, exDateSet);
              const duration = e ? (e.date.getTime() - s.date.getTime()) : (isAllDay ? 86400000 : 60*60*1000);
              for (const occStart of occs) {
                const occEnd = new Date(occStart.getTime() + duration);
                const startInfo = { date: occStart, isAllDay, minOfDay: isAllDay ? 0 : occStart.getHours()*60+occStart.getMinutes() };
                const endInfo = { date: occEnd, isAllDay, minOfDay: isAllDay ? 0 : occEnd.getHours()*60+occEnd.getMinutes() };
                addSlot(startInfo, endInfo);
              }
            } else {
              addSlot(s, e || s);
            }
          }
        }
      }
      if (val === 'VFREEBUSY') inFB = false;
    }

    if (inEvent) {
      if (key === 'DTSTART')  { evStartRaw = val.replace(/[^0-9TZ]/g,''); evDtStartTzid = tzid||''; }
      else if (key === 'DTEND')   evEndRaw  = val.replace(/[^0-9TZ]/g,'');
      else if (key === 'DURATION' && !evEndRaw && evStartRaw) {
        // Calcular DTEND des de DURATION
        const s = parseICSDate(evStartRaw);
        if (s) {
          const m = val.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
          if (m) {
            const dur = new Date(s.date);
            if (m[1]) dur.setDate(dur.getDate() + parseInt(m[1])*7);
            if (m[2]) dur.setDate(dur.getDate() + parseInt(m[2]));
            if (m[3]) dur.setHours(dur.getHours() + parseInt(m[3]));
            if (m[4]) dur.setMinutes(dur.getMinutes() + parseInt(m[4]));
            evEndRaw = dur.getFullYear()
              + String(dur.getMonth()+1).padStart(2,'0')
              + String(dur.getDate()).padStart(2,'0')
              + 'T' + String(dur.getHours()).padStart(2,'0')
              + String(dur.getMinutes()).padStart(2,'0') + '00';
          }
        }
      }
      else if (key === 'TRANSP')  evTransp  = val.toUpperCase();
      else if (key === 'STATUS')  evStatus  = val.toUpperCase();
      else if (key === 'SUMMARY') evSummary = val.slice(0,60);
      else if (key === 'RRULE')   evRRule   = val;
      else if (key === 'EXDATE') {
        // EXDATE pot ser: EXDATE:20260520T093000Z  o  EXDATE;VALUE=DATE:20260520
        // (i fins i tot múltiples valors separats per coma)
        val.split(',').forEach(ed => {
          const parsed = parseICSDate(ed.replace(/[^0-9TZ]/g, ''), tzid);
          if (parsed) evExDates.push(parsed.date);
        });
      }
    }

    if (inFB && key === 'FREEBUSY') {
      val.split(',').forEach(period => {
        const [sRaw, eRaw] = period.split('/');
        if (!sRaw || !eRaw) return;
        const s = parseICSDate(sRaw.replace(/[^0-9TZ]/g,''));
        let eDate;
        if (eRaw.startsWith('P')) {
          const m = eRaw.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
          eDate = s ? new Date(s.date) : new Date();
          if (m) {
            if (m[1]) eDate.setDate(eDate.getDate() + parseInt(m[1]));
            if (m[2]) eDate.setHours(eDate.getHours() + parseInt(m[2]));
            if (m[3]) eDate.setMinutes(eDate.getMinutes() + parseInt(m[3]));
          }
          eDate = { date: eDate, isAllDay: false, minOfDay: eDate.getHours()*60+eDate.getMinutes() };
        } else {
          eDate = parseICSDate(eRaw.replace(/[^0-9TZ]/g,''));
        }
        if (s && eDate) addSlot(s, eDate);
      });
    }
  }
  return { slots, fullDayDates: [...fullDayDates].sort() };
}

async function fetchAndParseICS(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'GESEM-Planner/1.0 Calendar-Integration' },
    signal: controller.signal
  });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`HTTP ${response.status} · ${response.statusText}`);
  const text = await response.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('No és un fitxer iCal vàlid');
  return parseICSEvents(text);
}

// Obtenir disponibilitat d'un formador (amb cache)
app.get('/api/disponibilitat/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const formadors = readJSON('formadors.json', []);
  const f = formadors.find(x => x.id === id);

  if (!f || !f.icsUrl) {
    return res.json({ ok: true, slots: [], fullDayDates: [], source: 'manual', nom: f?.nom });
  }

  const cached = calCache[id];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.json({ ok: true, ...cached.data, cached: true, ts: cached.ts, nom: f.nom });
  }

  try {
    const data = await fetchAndParseICS(f.icsUrl);
    calCache[id] = { data, ts: Date.now() };
    persistCalCache();
    const count = data.slots.length + data.fullDayDates.length;
    res.json({ ok: true, ...data, count, nom: f.nom });
  } catch(e) {
    // Si tenim entrada antiga (caducada) la retornem amb stale=true per evitar
    // que el client mostri "pendent" quan hi ha hagut un error puntual de xarxa.
    if (cached && cached.data) {
      return res.json({ ok: true, ...cached.data, cached: true, stale: true, ts: cached.ts, nom: f.nom, fetchError: e.message });
    }
    res.json({ ok: false, slots: [], fullDayDates: [], error: e.message, nom: f?.nom });
  }
});

// Verificar una URL iCal
app.post('/api/verificar-ical', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ ok: false, error: 'URL requerida' });
  try {
    const data = await fetchAndParseICS(url);
    const total = data.slots.length + data.fullDayDates.length;
    const eventsDia = data.fullDayDates.length;
    const eventsHora = data.slots.length;
    res.json({ ok: true, message: `Connexió OK · ${eventsDia} dies complets + ${eventsHora} events amb hora detectats` });
  } catch(e) {
    let msg = e.message;
    if (e.name === 'AbortError') msg = 'Temps d\'espera superat (12s)';
    res.json({ ok: false, error: msg });
  }
});

// Buidar cache d'un formador
app.delete('/api/disponibilitat/:id/cache', (req, res) => {
  delete calCache[parseInt(req.params.id)];
  persistCalCache();
  res.json({ ok: true });
});

// ── 404 HANDLER (sempre l'últim, abans de listen) ───────────────
// Per a peticions HTML serveix la pàgina 404 polida; per a /api retorna JSON
app.use((req, res) => {
  // Headers anti-cache: alguns navegadors cachen 404 i mostren l'antic
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no trobat', path: req.path });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── CRON DIARI · refresc automàtic dels calendaris ─────────────
// Cada nit a les 03:00 invalidem la cache i refetchem tots els iCal dels formadors
async function refreshAllCalendarsCache() {
  const formadors = readJSON('formadors.json', []);
  const withCal = formadors.filter(f => f.icsUrl);
  if (!withCal.length) return;
  console.log('[cron] Refreshing', withCal.length, 'calendars at', new Date().toISOString());
  let ok = 0, fail = 0;
  await Promise.all(withCal.map(async f => {
    try {
      const data = await fetchAndParseICS(f.icsUrl);
      calCache[f.id] = { data, ts: Date.now() };
      ok++;
    } catch (e) {
      console.warn('[cron] Failed', f.nom, '·', e.message);
      fail++;
    }
  }));
  persistCalCache();
  console.log('[cron] Calendars refreshed: ' + ok + ' ok · ' + fail + ' errors');
}

// Programa la pròxima execució a les 03:00 i després cada 24h
function scheduleDailyCalendarRefresh() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  console.log('[cron] First daily calendar refresh scheduled for', next.toISOString(), '(' + Math.round(delay / 60000) + ' min from now)');
  setTimeout(() => {
    refreshAllCalendarsCache();
    setInterval(refreshAllCalendarsCache, 24 * 60 * 60 * 1000);
  }, delay);
}

// També oferim un endpoint manual per disparar-ho des de fora
app.post('/api/admin/refresh-calendars', async (req, res) => {
  try {
    await refreshAllCalendarsCache();
    res.json({ ok: true, message: 'Calendars refresh triggered' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── ARRANCAR SERVIDOR ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n══════════════════════════════════════════');
  console.log('  GESEM Planner  -  Servidor actiu');
  console.log('══════════════════════════════════════════');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Xarxa:   http://${ip}:${PORT}`);
  console.log('──────────────────────────────────────────');
  console.log('  Dades a: ' + DATA_DIR);
  console.log('  Ctrl+C per aturar el servidor');
  console.log('══════════════════════════════════════════\n');
  // Activar el cron diari de refresc de calendaris
  scheduleDailyCalendarRefresh();
});
