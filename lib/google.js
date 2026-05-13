// ── GOOGLE CALENDAR OAuth 2.0 ───────────────────────────────────
// Permet escriure events directament al Google Calendar del formador
// (a més de la sincronia iCal d'una sola direcció que ja teníem).
//
// Variables d'entorn requerides al .env:
//   GOOGLE_CLIENT_ID         · de la consola de Google Cloud
//   GOOGLE_CLIENT_SECRET     · idem
//   GOOGLE_REDIRECT_URI      · ex: http://192.168.3.208:3001/api/google/callback
//
// Tokens emmagatzemats al store SQLite (key: google_tokens.json)
//   { [formadorId]: { access_token, refresh_token, expires_at } }

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

// Genera la URL d'autorització per a un formador concret
function buildAuthUrl(formadorId) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // força refresh_token
    state: 'formador_' + formadorId,
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

// Bescanvia un authorization code per access + refresh token
async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Google token exchange failed: ' + res.status + ' · ' + err.substring(0, 200));
  }
  return await res.json();
}

// Renova un access token amb el refresh_token
async function refreshAccessToken(refresh_token) {
  const body = new URLSearchParams({
    refresh_token,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Refresh failed: ' + res.status + ' · ' + err.substring(0, 200));
  }
  return await res.json();
}

// Obté un access token vàlid per a un formador (renova si cal)
async function getValidAccessToken(tokenStore, formadorId) {
  const entry = tokenStore[formadorId];
  if (!entry) throw new Error('Formador no connectat a Google Calendar');
  // Si el token caduca en menys de 60s, renovem
  if (entry.expires_at && Date.now() > entry.expires_at - 60000) {
    if (!entry.refresh_token) throw new Error('Token caducat i sense refresh_token');
    const refreshed = await refreshAccessToken(entry.refresh_token);
    entry.access_token = refreshed.access_token;
    entry.expires_at = Date.now() + (refreshed.expires_in || 3600) * 1000;
    // refresh_token pot venir o no — si ve, actualitzem
    if (refreshed.refresh_token) entry.refresh_token = refreshed.refresh_token;
    tokenStore[formadorId] = entry;
  }
  return { accessToken: entry.access_token, store: tokenStore };
}

// Crea events al calendari "primary" del formador
//   reserva: objecte reserva amb dates, curs, etc.
//   torn: { startH, startM, endH, endM }
async function createEventsForReserva({ accessToken, reserva, torn, sessionMinutes }) {
  const created = [];
  const failed = [];
  for (let i = 0; i < (reserva.dates || []).length; i++) {
    const dateISO = reserva.dates[i];
    if (!dateISO) continue;
    const [yyyy, mm, dd] = dateISO.split('-').map(Number);
    const start = new Date(yyyy, mm - 1, dd, torn.startH, torn.startM);
    const end = new Date(start.getTime() + sessionMinutes * 60 * 1000);
    const event = {
      summary: `GESEM · ${reserva.curs || 'Curs'} · ${reserva.client || ''}`,
      description: `Sessió ${i + 1} de ${reserva.dates.length}\nCurs: ${reserva.curs || ''}\nClient: ${reserva.client || ''}\nReserva ID: ${reserva.id}\n\nCreat automàticament des de GESEM Planner.`,
      start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
      end: { dateTime: end.toISOString(), timeZone: 'Europe/Madrid' },
      extendedProperties: {
        private: {
          gesemReservaId: String(reserva.id),
          gesemSessionIndex: String(i + 1),
        },
      },
      reminders: { useDefault: true },
    };
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        const err = await res.text();
        failed.push({ session: i + 1, error: err.substring(0, 100) });
        continue;
      }
      const data = await res.json();
      created.push({ session: i + 1, eventId: data.id, htmlLink: data.htmlLink });
    } catch (e) {
      failed.push({ session: i + 1, error: e.message });
    }
  }
  return { created, failed };
}

// Esborra els events d'una reserva (busca per extendedProperties.private.gesemReservaId)
async function deleteEventsForReserva({ accessToken, reservaId }) {
  // Buscar events amb aquesta propietat
  const params = new URLSearchParams({
    privateExtendedProperty: 'gesemReservaId=' + reservaId,
    maxResults: '50',
  });
  const listRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + params.toString(), {
    headers: { 'Authorization': 'Bearer ' + accessToken },
  });
  if (!listRes.ok) return { deleted: 0, error: 'List failed: ' + listRes.status };
  const listData = await listRes.json();
  const events = listData.items || [];
  let deleted = 0;
  for (const ev of events) {
    try {
      const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + accessToken },
      });
      if (delRes.ok || delRes.status === 410) deleted++;
    } catch (e) { /* ignore */ }
  }
  return { deleted };
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getValidAccessToken,
  createEventsForReserva,
  deleteEventsForReserva,
};
