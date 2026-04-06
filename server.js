const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── BASE DE DADES (fitxers JSON) ──────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const AV_COLORS = ['#1D9E75','#185FA5','#854F0B','#534AB7','#993C1D','#3B6D11','#72243E','#D85A30','#0F6E56','#3C3489'];

function readJSON(file, def) {
  const p = path.join(DATA_DIR, file);
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { console.error('Error llegint', file, e.message); }
  return def;
}
function writeJSON(file, data) {
  try { fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8'); }
  catch(e) { console.error('Error escrivint', file, e.message); }
}

// ── DADES INICIALS ────────────────────────────────────────────────
function seedIfEmpty() {
  if (!fs.existsSync(path.join(DATA_DIR, 'agents.json'))) {
    writeJSON('agents.json', [
      { nom: 'Jordi Llopart', color: AV_COLORS[0] },
      { nom: 'Marc Abad',     color: AV_COLORS[1] },
      { nom: 'Raquel Muñoz',  color: AV_COLORS[2] },
      { nom: 'Marta Ruiz',    color: AV_COLORS[3] }
    ]);
    console.log('Agents inicials creats.');
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'cats.json'))) {
    writeJSON('cats.json', {
      esp:   ['Lideratge i management','Comunicació efectiva','Vendes i negociació','Excel i eines Office','Prevenció de riscos','Atenció al client','Treball en equip','Habilitats digitals','Recursos humans','Finances per no financers','Idiomes','Presentacions efectives'],
      modal: ['Presencial','Síncrona online','Híbrida','E-learning asíncron'],
      hsess: ['1.5','2','2.5','3','4'],
      torn:  ['9:30–11:30h','12:00–15:00h','9:00–11:00h','16:00–18:00h','Qualsevol']
    });
    console.log('Catàlegs inicials creats.');
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'formadors.json'))) {
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

  if (!fs.existsSync(path.join(DATA_DIR, 'reserves.json'))) {
    writeJSON('reserves.json', []);
    console.log('Fitxer reserves creat.');
  }
}
seedIfEmpty();

// ── API: AGENTS ───────────────────────────────────────────────────
app.get('/api/agents', (req, res) => {
  res.json(readJSON('agents.json', []));
});
app.post('/api/agents', (req, res) => {
  const { nom, color } = req.body;
  if (!nom) return res.status(400).json({ error: 'nom requerit' });
  const agents = readJSON('agents.json', []);
  const idx = agents.findIndex(a => a.nom === nom);
  if (idx >= 0) agents[idx] = { nom, color };
  else agents.push({ nom, color });
  writeJSON('agents.json', agents);
  res.json({ ok: true });
});
app.delete('/api/agents/:nom', (req, res) => {
  let agents = readJSON('agents.json', []);
  agents = agents.filter(a => a.nom !== decodeURIComponent(req.params.nom));
  writeJSON('agents.json', agents);
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

const calCache = {}; // { id: { slots, fullDayDates, ts } }
const CACHE_TTL = 30 * 60 * 1000; // 30 minuts

function toISODate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Parseja una data/hora iCal. Retorna { date: Date, isAllDay: bool, minOfDay: number }
function parseICSDate(str, tzid) {
  if (!str) return null;
  const raw = str.trim();
  const isAllDay = raw.length === 8 && /^\d{8}$/.test(raw);
  let d;
  if (isAllDay) {
    d = new Date(parseInt(raw.slice(0,4)), parseInt(raw.slice(4,6))-1, parseInt(raw.slice(6,8)));
  } else if (raw.endsWith('Z')) {
    d = new Date(Date.UTC(
      parseInt(raw.slice(0,4)), parseInt(raw.slice(4,6))-1, parseInt(raw.slice(6,8)),
      parseInt(raw.slice(9,11)||0), parseInt(raw.slice(11,13)||0), parseInt(raw.slice(13,15)||0)
    ));
  } else {
    d = new Date(
      parseInt(raw.slice(0,4)), parseInt(raw.slice(4,6))-1, parseInt(raw.slice(6,8)),
      parseInt(raw.slice(9,11)||0), parseInt(raw.slice(11,13)||0), parseInt(raw.slice(13,15)||0)
    );
  }
  if (!d || isNaN(d.getTime())) return null;
  const minOfDay = d.getHours() * 60 + d.getMinutes();
  return { date: d, isAllDay, minOfDay };
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
      if (val === 'VEVENT')     { inEvent=true; evStartRaw=''; evEndRaw=''; evTransp=''; evStatus=''; evSummary=''; evDtStartTzid=''; }
      if (val === 'VFREEBUSY') inFB = true;
    } else if (key === 'END') {
      if (val === 'VEVENT' && inEvent) {
        inEvent = false;
        if (evTransp !== 'TRANSPARENT' && evStatus !== 'CANCELLED' && evStatus !== 'TENTATIVE') {
          const s = parseICSDate(evStartRaw, evDtStartTzid);
          const eRawAdjusted = evEndRaw || (evStartRaw.length===8
            ? String(parseInt(evStartRaw.slice(0,8))+1).padStart(8,'0') // next day for all-day
            : evStartRaw);
          const e = parseICSDate(eRawAdjusted, evDtStartTzid);
          addSlot(s, e || s);
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
    const count = data.slots.length + data.fullDayDates.length;
    res.json({ ok: true, ...data, count, nom: f.nom });
  } catch(e) {
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
  res.json({ ok: true });
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
});
