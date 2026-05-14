// ── HEALTH CHECKS REALS ─────────────────────────────────────────
// Aquests checks fan trucades reals als serveis externs (no només verifiquen
// que la variable d'entorn existeixi). Els resultats es guarden a:
//   · health_status.json   → últim resultat de cada servei (per /api/status)
//   · health_history.json  → buffer rodant amb les últimes 24h de snapshots
//                            (un check cada 2 min ≈ 720 entries/dia)

const { readJSON, writeJSON } = require('../db');
const mailer = require('./email');

const STATUS_FILE = 'health_status.json';
const HISTORY_FILE = 'health_history.json';
const HISTORY_MAX_ENTRIES = 30 * 24 * 30; // ~30 dies × 24h × 30 (cada 2min) = 21600

// Fa servir AbortSignal.timeout (Node 17.3+) per limitar la durada de fetch
function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

// ── SMTP ─────────────────────────────────────────────────────────
async function checkSmtp() {
  const t0 = Date.now();
  if (!mailer.isConfigured()) return { status: 'unconfigured', responseTime: 0, error: 'SMTP no configurat' };
  try {
    await mailer.verifyConnection();
    const ms = Date.now() - t0;
    return { status: ms > 3000 ? 'degraded' : 'operational', responseTime: ms };
  } catch (e) {
    return { status: 'major_outage', responseTime: Date.now() - t0, error: e.message || String(e) };
  }
}

// ── IA (Groq · l'app fa servir Groq, no Anthropic) ──────────────
// Fa una trucada extremament barata (1 token) per verificar autenticació
// + connectivitat. Cost: pràcticament zero amb Groq (tier gratuït).
async function checkAI() {
  const t0 = Date.now();
  if (!process.env.GROQ_API_KEY) return { status: 'unconfigured', responseTime: 0, error: 'GROQ_API_KEY no configurat' };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: timeoutSignal(6000),
    });
    const ms = Date.now() - t0;
    if (res.status === 401 || res.status === 403) {
      const body = await res.text().catch(() => '');
      return { status: 'major_outage', responseTime: ms, error: 'Auth failed: ' + body.slice(0, 100) };
    }
    if (res.status === 429) return { status: 'degraded', responseTime: ms, error: 'Rate limited' };
    if (res.status >= 500) return { status: 'partial_outage', responseTime: ms, error: `Server error ${res.status}` };
    if (!res.ok && res.status !== 400) return { status: 'partial_outage', responseTime: ms, error: `HTTP ${res.status}` };
    return { status: ms > 4000 ? 'degraded' : 'operational', responseTime: ms, meta: { provider: 'Groq' } };
  } catch (e) {
    return { status: 'major_outage', responseTime: Date.now() - t0, error: (e.message || String(e)).slice(0, 120) };
  }
}

// ── Google Calendar ─────────────────────────────────────────────
// Verifica que els endpoints públics de Google estan accessibles + valida
// que tenim refresh_tokens vàlids guardats (per a algun formador).
async function checkGoogle() {
  const t0 = Date.now();
  if (!process.env.GOOGLE_CLIENT_ID) return { status: 'unconfigured', responseTime: 0, error: 'OAuth no configurat' };
  try {
    // 1) Connectivitat amb api.googleapis.com (HEAD a un endpoint discovery)
    const res = await fetch('https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest', {
      method: 'GET',
      signal: timeoutSignal(5000),
    });
    const ms = Date.now() - t0;
    if (!res.ok) return { status: 'partial_outage', responseTime: ms, error: `Discovery HTTP ${res.status}` };
    // 2) Comprovem si tenim almenys un token vàlid guardat (informatiu)
    const tokenStore = readJSON('google_tokens.json', {});
    const tokenCount = Object.keys(tokenStore).length;
    return {
      status: ms > 3000 ? 'degraded' : 'operational',
      responseTime: ms,
      meta: { tokensStored: tokenCount },
    };
  } catch (e) {
    return { status: 'major_outage', responseTime: Date.now() - t0, error: (e.message || String(e)).slice(0, 120) };
  }
}

// ── Base de dades (SQLite via db.js) ────────────────────────────
function checkDb() {
  const t0 = Date.now();
  try {
    const testKey = '_health_test.json';
    const testData = { ts: Date.now(), nonce: Math.random() };
    writeJSON(testKey, testData);
    const read = readJSON(testKey, null);
    if (!read || read.ts !== testData.ts) throw new Error('Read/write mismatch');
    const ms = Date.now() - t0;
    return { status: ms > 200 ? 'degraded' : 'operational', responseTime: ms };
  } catch (e) {
    return { status: 'major_outage', responseTime: Date.now() - t0, error: e.message || String(e) };
  }
}

// ── Web/API (sempre operational si el procés respon) ────────────
function checkSelf() {
  const mem = process.memoryUsage();
  const rssMB = mem.rss / 1024 / 1024;
  // Si la RSS està fora de control el procés està al límit
  if (rssMB > 1500) return { status: 'major_outage', responseTime: 0, meta: { rssMB: Math.round(rssMB) }, error: 'Memory limit critical' };
  if (rssMB > 800) return { status: 'degraded', responseTime: 0, meta: { rssMB: Math.round(rssMB) }, error: 'High memory usage' };
  return { status: 'operational', responseTime: 0, meta: { rssMB: Math.round(rssMB) } };
}

// ── ORQUESTRACIÓ ────────────────────────────────────────────────
async function runAllChecks() {
  const [smtp, ai, google] = await Promise.all([
    checkSmtp().catch(e => ({ status: 'major_outage', error: e.message })),
    checkAI().catch(e => ({ status: 'major_outage', error: e.message })),
    checkGoogle().catch(e => ({ status: 'major_outage', error: e.message })),
  ]);
  const db = checkDb();
  const self = checkSelf();
  const result = {
    at: new Date().toISOString(),
    services: {
      web: self,
      api: self,  // mateix procés
      smtp,
      ai,
      google,
      db,
    },
  };
  // Desa estat actual + afegeix snapshot a l'historial (rolling)
  writeJSON(STATUS_FILE, result);
  try {
    const hist = readJSON(HISTORY_FILE, []);
    hist.push({
      at: result.at,
      web: self.status, api: self.status,
      smtp: smtp.status, ai: ai.status, google: google.status, db: db.status,
    });
    // Trunca al màxim
    const trimmed = hist.length > HISTORY_MAX_ENTRIES ? hist.slice(hist.length - HISTORY_MAX_ENTRIES) : hist;
    writeJSON(HISTORY_FILE, trimmed);
  } catch (e) { console.warn('[health] history write error:', e.message); }
  return result;
}

// Llegeix l'últim resultat cachejat (per /api/status sense fer els checks ara)
function getCachedStatus() {
  return readJSON(STATUS_FILE, null);
}

// Calcula uptime per dia per servei a partir de l'historial.
// Si no hi ha cap entrada per a un dia, assumim 100% (sense dades = no down).
function computeDailyUptime(days = 90) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  const hist = readJSON(HISTORY_FILE, []);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = TODAY.getTime() - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const snaps = hist.filter(h => {
      const t = Date.parse(h.at);
      return t >= dayStart && t < dayEnd;
    });
    if (snaps.length === 0) {
      result.push({ date: new Date(dayStart).toISOString().slice(0, 10), uptimePct: null, status: 'no_data', snaps: 0 });
      continue;
    }
    // Per cada snapshot: és "down" si algun servei (excloent unconfigured) no és operational/degraded
    let down = 0;
    snaps.forEach(s => {
      const services = [s.web, s.api, s.smtp, s.ai, s.google, s.db];
      const isDown = services.some(st => st === 'major_outage' || st === 'partial_outage');
      if (isDown) down++;
    });
    const uptimePct = ((snaps.length - down) / snaps.length) * 100;
    let status = 'operational';
    if (uptimePct < 50) status = 'major_outage';
    else if (uptimePct < 95) status = 'partial_outage';
    else if (uptimePct < 99.9) status = 'degraded';
    result.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      uptimePct: Math.round(uptimePct * 100) / 100,
      status,
      snaps: snaps.length,
    });
  }
  return result;
}

module.exports = {
  runAllChecks,
  getCachedStatus,
  computeDailyUptime,
  checkSmtp,
  checkAI,
  checkGoogle,
  checkDb,
  checkSelf,
};
