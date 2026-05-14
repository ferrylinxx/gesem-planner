// ── AUTH · Login email/password + sessions ────────────────────
// Sistema mínim però segur:
//   · Passwords hasshats amb bcrypt (cost 10)
//   · Sessions: cookie HMAC-signed + token aleatori 32 bytes
//   · Storage: JSON dins SQLite (taula store, key='users.json' i 'sessions.json')
//   · Expiració: 30 dies (renovat a cada request actiu)
//
// API exposada:
//   - hashPassword(plain) → hash
//   - verifyPassword(plain, hash) → bool
//   - createUser({email, password, name, role}) → user (sense password)
//   - findUserByEmail(email) → user record (amb password hash)
//   - listUsers() → users sense password
//   - updateUser(email, patch) → user
//   - deleteUser(email)
//   - createSession(userEmail) → { token, expiresAt }
//   - validateSession(token) → user | null
//   - revokeSession(token)
//   - cleanupExpired() → n
//   - middleware(opts) → Express middleware

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { readJSON, writeJSON } = require('../db');

const USERS_KEY = 'users.json';
const SESSIONS_KEY = 'sessions.json';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dies
const COOKIE_NAME = 'gesem_sid';
const BCRYPT_ROUNDS = 10;

// ── PASSWORDS ─────────────────────────────────────────────────
function hashPassword(plain) {
  return bcrypt.hashSync(String(plain || ''), BCRYPT_ROUNDS);
}
function verifyPassword(plain, hash) {
  if (!hash) return false;
  try { return bcrypt.compareSync(String(plain || ''), hash); }
  catch (e) { return false; }
}

// ── USERS ─────────────────────────────────────────────────────
function _allUsers() {
  return readJSON(USERS_KEY, []);
}
function _saveUsers(users) {
  writeJSON(USERS_KEY, users);
}
function _normEmail(e) {
  return String(e || '').trim().toLowerCase();
}
function _stripPw(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

function findUserByEmail(email) {
  const e = _normEmail(email);
  return _allUsers().find(u => _normEmail(u.email) === e) || null;
}

function listUsers() {
  return _allUsers().map(_stripPw);
}

function createUser({ email, password, name, role }) {
  const e = _normEmail(email);
  if (!e || !password) throw new Error('Email i password obligatoris');
  const users = _allUsers();
  if (users.find(u => _normEmail(u.email) === e)) {
    throw new Error('Ja existeix un usuari amb aquest email');
  }
  const now = new Date().toISOString();
  const user = {
    email: e,
    password: hashPassword(password),
    name: name || e.split('@')[0],
    role: role || 'user',  // 'admin' | 'user'
    createdAt: now,
    lastLoginAt: null,
  };
  users.push(user);
  _saveUsers(users);
  return _stripPw(user);
}

function updateUser(email, patch) {
  const e = _normEmail(email);
  const users = _allUsers();
  const i = users.findIndex(u => _normEmail(u.email) === e);
  if (i < 0) throw new Error('Usuari no trobat');
  const cur = users[i];
  const next = { ...cur };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.role !== undefined) next.role = patch.role;
  if (patch.password) next.password = hashPassword(patch.password);
  users[i] = next;
  _saveUsers(users);
  return _stripPw(next);
}

function deleteUser(email) {
  const e = _normEmail(email);
  const users = _allUsers();
  const filtered = users.filter(u => _normEmail(u.email) !== e);
  _saveUsers(filtered);
  // També revoquem totes les sessions d'aquest usuari
  const sessions = readJSON(SESSIONS_KEY, {});
  let changed = false;
  Object.keys(sessions).forEach(tok => {
    if (_normEmail(sessions[tok].email) === e) { delete sessions[tok]; changed = true; }
  });
  if (changed) writeJSON(SESSIONS_KEY, sessions);
  return filtered.length < users.length;
}

// Marca lastLoginAt
function _touchUserLogin(email) {
  const users = _allUsers();
  const i = users.findIndex(u => _normEmail(u.email) === _normEmail(email));
  if (i < 0) return;
  users[i].lastLoginAt = new Date().toISOString();
  _saveUsers(users);
}

// ── SESSIONS ──────────────────────────────────────────────────
function createSession(userEmail) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = readJSON(SESSIONS_KEY, {});
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions[token] = { email: _normEmail(userEmail), createdAt: Date.now(), expiresAt };
  writeJSON(SESSIONS_KEY, sessions);
  _touchUserLogin(userEmail);
  return { token, expiresAt };
}

function validateSession(token) {
  if (!token) return null;
  const sessions = readJSON(SESSIONS_KEY, {});
  const s = sessions[token];
  if (!s) return null;
  if (s.expiresAt && Date.now() > s.expiresAt) {
    delete sessions[token];
    writeJSON(SESSIONS_KEY, sessions);
    return null;
  }
  // Sliding expiration: refresca la sessió si li queda < 7 dies
  const remaining = s.expiresAt - Date.now();
  if (remaining < 7 * 24 * 60 * 60 * 1000) {
    s.expiresAt = Date.now() + SESSION_TTL_MS;
    sessions[token] = s;
    writeJSON(SESSIONS_KEY, sessions);
  }
  const user = findUserByEmail(s.email);
  if (!user) {  // usuari esborrat
    delete sessions[token];
    writeJSON(SESSIONS_KEY, sessions);
    return null;
  }
  return _stripPw(user);
}

function revokeSession(token) {
  if (!token) return false;
  const sessions = readJSON(SESSIONS_KEY, {});
  if (!sessions[token]) return false;
  delete sessions[token];
  writeJSON(SESSIONS_KEY, sessions);
  return true;
}

function cleanupExpired() {
  const sessions = readJSON(SESSIONS_KEY, {});
  const now = Date.now();
  let removed = 0;
  Object.keys(sessions).forEach(tok => {
    if (!sessions[tok].expiresAt || now > sessions[tok].expiresAt) {
      delete sessions[tok];
      removed++;
    }
  });
  if (removed) writeJSON(SESSIONS_KEY, sessions);
  return removed;
}

// ── MIDDLEWARE EXPRESS ────────────────────────────────────────
// Rutes que NO requereixen auth (whitelist):
const PUBLIC_PATHS = [
  '/login', '/login.html',
  '/api/auth/login', '/api/auth/me',
  '/maintenance', '/maintenance.html',
  '/favicon.svg', '/robots.txt', '/.well-known/',
];
const PUBLIC_PREFIXES = [
  '/css/', '/js/', '/img/',
  '/r/',                // tokens públics de formador (HMAC)
  '/api/google/callback',  // OAuth callback
];

function isPublicPath(p) {
  if (PUBLIC_PATHS.includes(p)) return true;
  for (const pref of PUBLIC_PREFIXES) {
    if (p.startsWith(pref)) return true;
  }
  return false;
}

// El middleware retorna 401 si no hi ha sessió vàlida.
// Per HTML redirigeix a /login?next=<path>.
function middleware() {
  return (req, res, next) => {
    if (isPublicPath(req.path)) return next();

    const token = req.cookies && req.cookies[COOKIE_NAME];
    const user = validateSession(token);
    if (user) {
      req.user = user;
      return next();
    }

    // No autenticat
    const acceptsHTML = (req.headers.accept || '').includes('text/html');
    if (acceptsHTML && req.method === 'GET') {
      const next_ = encodeURIComponent(req.originalUrl || '/');
      return res.redirect('/login?next=' + next_);
    }
    return res.status(401).json({ error: 'No autenticat', code: 'AUTH_REQUIRED' });
  };
}

// Crea l'usuari admin inicial si no existeix cap usuari
function ensureInitialAdmin(opts = {}) {
  const users = _allUsers();
  if (users.length > 0) return null;
  const email = opts.email || process.env.ADMIN_EMAIL || 'admin@gesem.es';
  const password = opts.password || process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn('[auth] ⚠️ Cap usuari i ADMIN_PASSWORD no està al .env — login no funcionarà fins crear-ne un manualment.');
    return null;
  }
  const user = createUser({ email, password, name: opts.name || 'Administrador GESEM', role: 'admin' });
  console.log('[auth] ✓ Usuari admin inicial creat:', user.email);
  return user;
}

module.exports = {
  hashPassword,
  verifyPassword,
  findUserByEmail,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  createSession,
  validateSession,
  revokeSession,
  cleanupExpired,
  middleware,
  isPublicPath,
  ensureInitialAdmin,
  COOKIE_NAME,
  SESSION_TTL_MS,
};
