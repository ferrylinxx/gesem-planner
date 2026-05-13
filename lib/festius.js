// ── FESTIUS · CATALUNYA + ESPANYA ─────────────────────────────────
// Calcula automàticament els festius oficials per a qualsevol any.
// Inclou:
//   · 8 festius nacionals (Espanya) — alguns es perden si cauen en diumenge
//   · 4 festius autonòmics de Catalunya
//   · 1 festiu local de Barcelona (La Mercè) — opcional
//
// La Pasqua és mòbil i depèn d'un càlcul astronòmic. Implementem
// l'algoritme de Gauss (vàlid per a anys 1583-4099, calendari gregorià).

// ── Càlcul de Pasqua (algoritme de Butcher / Gauss) ─────────────
// Retorna {year, month (1-12), day} per al diumenge de Pasqua de Resurrecció.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31); // 3 = Mar, 4 = Apr
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

// Helper: formata YYYY-MM-DD a partir de Y/M(1-12)/D
function toISO(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// Helper: suma N dies a una data ISO
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

// ── Llista de festius per a un any concret ──────────────────────
// Opcions:
//   includeBarcelona (default true): inclou La Mercè (24 set) i Pasqua granada (lunes)
//     que són festius locals de Barcelona ciutat
//   includeStateOnSunday (default false): inclou festius nacionals encara que caiguin
//     en diumenge (a Espanya NO es traslladen automàticament — es perden)
//
// Retorna: { 'YYYY-MM-DD': { nom, tipus: 'estatal'|'autonomic'|'local' } }
function getFestius(year, opts = {}) {
  const includeBarcelona = opts.includeBarcelona !== false;
  const includeStateOnSunday = opts.includeStateOnSunday === true;
  const result = {};

  // Pasqua de Resurrecció (referència mòbil)
  const easter = easterSunday(year);
  const easterISO = toISO(easter.year, easter.month, easter.day);
  const goodFriday = addDays(easterISO, -2); // Divendres Sant
  const easterMonday = addDays(easterISO, 1); // Dilluns de Pasqua (Catalunya)
  const whitMonday = addDays(easterISO, 50); // Pasqua granada — Pentecosta + 1

  // Festius nacionals d'Espanya (8 + 1 local que cada autonomia tria — Catalunya tria Sant Joan)
  const stateHolidays = [
    { iso: toISO(year, 1, 1),  nom: "Cap d'Any" },
    { iso: toISO(year, 1, 6),  nom: 'Reis' },
    { iso: goodFriday,         nom: 'Divendres Sant' },
    { iso: toISO(year, 5, 1),  nom: 'Festa del Treball' },
    { iso: toISO(year, 8, 15), nom: 'Assumpció de Maria' },
    { iso: toISO(year, 10, 12),nom: 'Festa Nacional d\'Espanya' },
    { iso: toISO(year, 11, 1), nom: 'Tots Sants' },
    { iso: toISO(year, 12, 6), nom: 'Dia de la Constitució' },
    { iso: toISO(year, 12, 8), nom: 'Immaculada Concepció' },
    { iso: toISO(year, 12, 25),nom: 'Nadal' },
  ];

  // Festius autonòmics de Catalunya
  const catHolidays = [
    { iso: easterMonday,       nom: 'Dilluns de Pasqua Florida' },
    { iso: toISO(year, 6, 24), nom: 'Sant Joan' },
    { iso: toISO(year, 9, 11), nom: 'Diada Nacional de Catalunya' },
    { iso: toISO(year, 12, 26),nom: 'Sant Esteve' },
  ];

  // Festius locals (Barcelona ciutat — GESEM hi és)
  const localHolidays = includeBarcelona ? [
    { iso: whitMonday,         nom: 'Dilluns de Pasqua Granada' },
    { iso: toISO(year, 9, 24), nom: 'La Mercè' },
  ] : [];

  // Filtra els nacionals que cauen en diumenge (no es traslladen a Espanya, simplement es perden)
  function dayOfWeek(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).getDay(); // 0 = diumenge
  }

  stateHolidays.forEach(h => {
    if (!includeStateOnSunday && dayOfWeek(h.iso) === 0) return; // perdut
    result[h.iso] = { nom: h.nom, tipus: 'estatal' };
  });
  catHolidays.forEach(h => {
    // Si el festiu autonòmic ja és nacional el mateix dia, prevalia el nacional (rar)
    if (result[h.iso]) return;
    if (!includeStateOnSunday && dayOfWeek(h.iso) === 0) return;
    result[h.iso] = { nom: h.nom, tipus: 'autonomic' };
  });
  localHolidays.forEach(h => {
    if (result[h.iso]) return;
    if (!includeStateOnSunday && dayOfWeek(h.iso) === 0) return;
    result[h.iso] = { nom: h.nom, tipus: 'local' };
  });

  return result;
}

// Retorna un objecte agregant múltiples anys: { 'YYYY-MM-DD': {...} }
function getFestiusForRange(yearFrom, yearTo, opts) {
  const out = {};
  for (let y = yearFrom; y <= yearTo; y++) {
    Object.assign(out, getFestius(y, opts));
  }
  return out;
}

// Helper: comprova si una data ISO és festiu (any inferit del propi ISO)
function isFestiu(iso, opts) {
  const year = parseInt(iso.split('-')[0]);
  const list = getFestius(year, opts);
  return !!list[iso];
}

module.exports = {
  easterSunday,
  getFestius,
  getFestiusForRange,
  isFestiu,
};
