// ── ICS · Generador de fitxer calendari (RFC 5545) ─────────────
// Genera un .ics amb una entrada VEVENT per cada sessió de la reserva.
// Adjuntat als emails als formadors o oferit per descàrrega als clients.

function pad2(n) { return String(n).padStart(2, '0'); }

// Format DATE-TIME UTC: 20260514T093000Z
function fmtUTC(d) {
  return d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) + 'T' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) + '00Z';
}

// Escapa text iCal (comes, ; i salts de línia)
function esc(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Parsa el torn (ex: "9:30–11:30h" / "9:00-11:00") i retorna { startH, startM, endH, endM }
function parseTorn(torn) {
  if (!torn) return { startH: 9, startM: 30, endH: 11, endM: 30 };
  // Suports: 9:30, 09:30, 9.30, 9-11, 9:30–11:30h
  const clean = torn.replace(/h/gi, '').replace(/[–—-]/g, '-').trim();
  const m = clean.match(/(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/);
  if (!m) {
    const m2 = clean.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
    if (m2) return { startH: +m2[1], startM: 0, endH: +m2[2], endM: 0 };
    return { startH: 9, startM: 30, endH: 11, endM: 30 };
  }
  return { startH: +m[1], startM: +m[2], endH: +m[3], endM: +m[4] };
}

// Construeix el .ics per a una reserva
//   reserva: { id, client, curs, formador, dates: [iso strings], torn, hs, ns, h, formadorEmail }
//   options: {
//     method: 'PUBLISH' | 'REQUEST' | 'CANCEL'  (default PUBLISH)
//       · PUBLISH: events informatius (descàrrega manual, webcal subscription)
//       · REQUEST: invitació de reunió · Gmail/Outlook/Apple Mail detecten i mostren
//         botons natius "Sí/Maybe/No" inline · auto-add al calendari amb 1 clic
//     organizerEmail, organizerName: qui envia la invitació (default GESEM)
//     attendeeEmail, attendeeName: a qui va dirigida (default reserva.formadorEmail/formador)
//     sequence: nombre de revisió de l'event (incrementa-lo si envies updates)
//     status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
//   }
function buildIcs(reserva, options = {}) {
  const t = parseTorn(reserva.torn);
  const sessionMinutes = (parseFloat(reserva.hs) || 2) * 60;
  const method = options.method || 'PUBLISH';
  const status = options.status || 'CONFIRMED';
  const sequence = options.sequence || 0;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GESEM Planner//Reserves//ES',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
  ];

  const now = new Date();
  const dtstamp = fmtUTC(now);

  // Per a METHOD:REQUEST cal ORGANIZER + ATTENDEE
  const isRequest = method === 'REQUEST' || method === 'CANCEL';
  const orgEmail = options.organizerEmail || 'comunicacions@gesem.cat';
  const orgName = options.organizerName || 'GESEM digital & SoftSkills';
  const attEmail = options.attendeeEmail || reserva.formadorEmail || '';
  const attName = options.attendeeName || reserva.formador || '';

  (reserva.dates || []).forEach((dateISO, i) => {
    if (!dateISO) return;
    const [yyyy, mm, dd] = dateISO.split('-').map(Number);
    // Construir data LOCAL Europe/Madrid
    // Per al servidor (TZ Europe/Madrid) això funciona correctament
    const start = new Date(yyyy, mm - 1, dd, t.startH, t.startM);
    const end = new Date(start.getTime() + sessionMinutes * 60 * 1000);

    const summary = `GESEM · ${reserva.curs || 'Curs'} · ${reserva.client || ''}`;
    const desc = [
      `Sessió ${i + 1} de ${(reserva.dates || []).length}`,
      `Curs: ${reserva.curs || ''}`,
      `Client: ${reserva.client || ''}`,
      `Formador: ${reserva.formador || ''}`,
      `Reserva ID: ${reserva.id || ''}`,
    ].join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:gesem-${reserva.id || 'r'}-s${i + 1}@gesem.cat`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${fmtUTC(start)}`,
      `DTEND:${fmtUTC(end)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(desc)}`,
      `LOCATION:${esc(reserva.modal || 'Per confirmar')}`,
      `STATUS:${status}`,
      'TRANSP:OPAQUE',
      `SEQUENCE:${sequence}`
    );
    if (isRequest) {
      // ORGANIZER · obligatori per a REQUEST. El email client mostrarà
      // aquest nom com a "remitent de la invitació"
      lines.push(`ORGANIZER;CN=${esc(orgName)}:mailto:${orgEmail}`);
      if (attEmail) {
        // ATTENDEE · RSVP=TRUE perquè el client demani resposta
        // PARTSTAT=NEEDS-ACTION · l'usuari encara no ha contestat
        // ROLE=REQ-PARTICIPANT · obligatori que participi
        lines.push(`ATTENDEE;CN=${esc(attName)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT;CUTYPE=INDIVIDUAL:mailto:${attEmail}`);
      }
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  // RFC 5545: línies separades per CRLF
  return lines.join('\r\n');
}

// Helper: construeix un .ics agregat amb totes les reserves d'un formador,
// per a la subscripció webcal. Genera VEVENTs de totes les reserves no
// canceladaes amb method PUBLISH (no és invitació, és feed informatiu).
function buildIcsFeed(reservas, formador) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GESEM Planner//Feed//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:GESEM · ${formador?.nom || 'Formacions'}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    'REFRESH-INTERVAL;VALUE=DURATION:PT2H',  // suggerir al client polling cada 2h
    'X-PUBLISHED-TTL:PT2H',
  ];
  const now = new Date();
  const dtstamp = fmtUTC(now);

  (reservas || []).forEach(reserva => {
    if (!reserva || reserva.estat === 'cancel') return;
    const t = parseTorn(reserva.torn);
    const sessionMinutes = (parseFloat(reserva.hs) || 2) * 60;
    (reserva.dates || []).forEach((dateISO, i) => {
      if (!dateISO) return;
      const [yyyy, mm, dd] = dateISO.split('-').map(Number);
      const start = new Date(yyyy, mm - 1, dd, t.startH, t.startM);
      const end = new Date(start.getTime() + sessionMinutes * 60 * 1000);
      const summary = `GESEM · ${reserva.curs || 'Curs'} · ${reserva.client || ''}`;
      const desc = [
        `Sessió ${i + 1} de ${(reserva.dates || []).length}`,
        `Curs: ${reserva.curs || ''}`,
        `Client: ${reserva.client || ''}`,
        `Estat: ${reserva.estat || ''}`,
        `Reserva ID: ${reserva.id || ''}`,
      ].join('\\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:gesem-${reserva.id || 'r'}-s${i + 1}@gesem.cat`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${fmtUTC(start)}`,
        `DTEND:${fmtUTC(end)}`,
        `SUMMARY:${esc(summary)}`,
        `DESCRIPTION:${esc(desc)}`,
        `LOCATION:${esc(reserva.modal || 'Per confirmar')}`,
        `STATUS:${reserva.estat === 'confirmada' ? 'CONFIRMED' : 'TENTATIVE'}`,
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    });
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// Genera un nom de fitxer net per al .ics
function icsFilename(reserva) {
  const safe = (reserva.client || 'reserva').replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+|-$/g, '').toLowerCase();
  return `gesem-${safe}-${reserva.id || 'res'}.ics`;
}

module.exports = { buildIcs, buildIcsFeed, icsFilename, parseTorn };
