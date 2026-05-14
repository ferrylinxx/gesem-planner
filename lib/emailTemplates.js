// ── PLANTILLES HTML · email al formador + pàgina de resposta ──

// Escapa per HTML
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Treu blocs "CALENDARI...─...Sessió X..." del cos perquè no es dupliquin amb la taula HTML
function stripCalendarBlock(text) {
  if (!text) return '';
  // Patró: línia amb "CALENDARI" seguida de línies amb "Sessió" fins arribar a salt doble
  // Eliminarem des de "CALENDARI" (o "CALENDARI PROPOSAT") fins després de l'última "Sessió"
  const lines = text.split('\n');
  const out = [];
  let skipping = false;
  let consumedSep = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!skipping && /^\s*CALENDARI(\s+PROPOSAT.*)?\s*$/i.test(l.trim())) {
      skipping = true;
      consumedSep = false;
      continue;
    }
    if (skipping) {
      // Saltar la línia de separació amb ─ o -
      if (!consumedSep && /^[\s─\-=]+$/.test(l.trim())) {
        consumedSep = true;
        continue;
      }
      // Saltar línies que comencen amb "Sessió"
      if (/^\s*Sessió\s+\d+/i.test(l)) continue;
      // Saltar línies buides immediatament després
      if (l.trim() === '') continue;
      // Si trobem qualsevol altre contingut, sortim del bloc
      skipping = false;
      out.push(l);
    } else {
      out.push(l);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// SVG inline del logo (compatible amb la majoria de clients de correu)
const LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <rect x="8" y="14" width="36" height="10" rx="2" fill="#A7F3D0" transform="rotate(-4 26 19)"/>
  <rect x="10" y="22" width="36" height="10" rx="2" fill="#34D399"/>
  <rect x="12" y="32" width="36" height="10" rx="2" fill="#059669" transform="rotate(3 30 37)"/>
</svg>`;

// Email HTML enviat al formador amb botons Acceptar / Declinar
function formadorEmailHtml({ reserva, plainBody, baseUrl, token }) {
  const acceptUrl  = `${baseUrl}/r/${token}?a=accept`;
  const declineUrl = `${baseUrl}/r/${token}?a=decline`;

  const sessionsHtml = (reserva.dates || []).map((d, i) => {
    const [y, m, day] = d.split('-');
    const dt = new Date(+y, +m - 1, +day);
    const dl = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'][dt.getDay()];
    const trBg = i % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
    return `<tr style="background:${trBg}">
      <td style="padding:10px 14px;border-bottom:1px solid #E7E5E4;font-size:13px;color:#71717A;width:36px;text-align:right;font-variant-numeric:tabular-nums">${i + 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E7E5E4;font-size:13.5px;color:#18181B"><b>${dl}</b> <span style="color:#71717A">·</span> ${day}/${m}/${y}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E7E5E4;font-size:13px;color:#52525B;text-align:right;white-space:nowrap">${escapeHtml(reserva.torn || '')} <span style="color:#A1A1AA">·</span> ${escapeHtml(String(reserva.hs || 2))}h</td>
    </tr>`;
  }).join('');

  // Treure el bloc CALENDARI duplicat del cos d'usuari
  const cleanBody = stripCalendarBlock(plainBody);
  const bodyHtml = escapeHtml(cleanBody).replace(/\n/g, '<br>');

  // Calcular hores totals
  const totalHores = (reserva.dates || []).length * (parseFloat(reserva.hs) || 2);

  return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Reserva de formació · GESEM</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">

<!-- Preheader (text breu visible a la safata) -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#FAFAF7">
  Reserva de ${escapeHtml(reserva.curs || 'formació')} per al client ${escapeHtml(reserva.client || '')} · ${(reserva.dates || []).length} sessions · ${totalHores}h
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF7;padding:24px 16px">
<tr><td align="center">

  <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#FFFFFF;border-radius:16px;border:1px solid #E7E5E4;overflow:hidden">

    <!-- Header -->
    <tr><td style="padding:28px 36px 4px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:10px">${LOGO_SVG}</td>
          <td style="vertical-align:middle">
            <div style="font-size:15px;font-weight:600;color:#18181B;line-height:1">GESEM <span style="color:#71717A;font-weight:500;font-size:13px">Planner</span></div>
            <div style="font-size:11.5px;color:#A1A1AA;margin-top:2px">Reserva de formació</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Title -->
    <tr><td style="padding:18px 36px 0">
      <h1 style="font-size:22px;font-weight:700;color:#18181B;margin:0 0 4px;letter-spacing:-0.01em">${escapeHtml(reserva.curs || 'Curs')}</h1>
      <div style="font-size:14px;color:#71717A;margin-bottom:4px">Client · <b style="color:#18181B">${escapeHtml(reserva.client || '')}</b></div>
    </td></tr>

    <!-- Body text from user -->
    <tr><td style="padding:18px 36px;font-size:14.5px;color:#3F3F46;line-height:1.65">
      ${bodyHtml}
    </td></tr>

    <!-- Resum cards -->
    <tr><td style="padding:0 36px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px">
        <tr>
          <td width="33%" style="padding:14px 16px;background:#ECFDF5;border-radius:10px;text-align:center;vertical-align:top">
            <div style="font-size:24px;font-weight:700;color:#065F46;letter-spacing:-0.02em;line-height:1.1">${(reserva.dates || []).length}</div>
            <div style="font-size:10.5px;color:#059669;font-weight:500;letter-spacing:.04em;text-transform:uppercase;margin-top:4px">Sessions</div>
          </td>
          <td width="6"></td>
          <td width="33%" style="padding:14px 16px;background:#EFF6FF;border-radius:10px;text-align:center;vertical-align:top">
            <div style="font-size:24px;font-weight:700;color:#1E40AF;letter-spacing:-0.02em;line-height:1.1">${totalHores}h</div>
            <div style="font-size:10.5px;color:#2563EB;font-weight:500;letter-spacing:.04em;text-transform:uppercase;margin-top:4px">Total hores</div>
          </td>
          <td width="6"></td>
          <td width="33%" style="padding:14px 16px;background:#F5F3FF;border-radius:10px;text-align:center;vertical-align:top">
            <div style="font-size:14px;font-weight:600;color:#5B21B6;line-height:1.2;margin-top:6px">${escapeHtml(reserva.torn || '—')}</div>
            <div style="font-size:10.5px;color:#7C3AED;font-weight:500;letter-spacing:.04em;text-transform:uppercase;margin-top:4px">Torn</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Sessions table -->
    <tr><td style="padding:18px 36px 0">
      <div style="font-size:11px;color:#71717A;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Calendari proposat</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E7E5E4;border-radius:10px;overflow:hidden">
        <thead><tr style="background:#F5F5F2">
          <th style="padding:9px 14px;font-size:10.5px;font-weight:600;color:#71717A;text-transform:uppercase;letter-spacing:.05em;text-align:right;width:36px;border-bottom:1px solid #E7E5E4">#</th>
          <th style="padding:9px 14px;font-size:10.5px;font-weight:600;color:#71717A;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid #E7E5E4">Data</th>
          <th style="padding:9px 14px;font-size:10.5px;font-weight:600;color:#71717A;text-transform:uppercase;letter-spacing:.05em;text-align:right;border-bottom:1px solid #E7E5E4">Horari</th>
        </tr></thead>
        <tbody>${sessionsHtml}</tbody>
      </table>
    </td></tr>

    <!-- CTA buttons -->
    <tr><td style="padding:30px 36px 6px;text-align:center">
      <div style="font-size:13.5px;color:#18181B;font-weight:500;margin-bottom:14px">Confirma la teva disponibilitat amb un sol clic:</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
        <tr>
          <td style="padding:0 4px">
            <a href="${acceptUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14.5px;padding:13px 26px;border-radius:9px;letter-spacing:.01em">✓ Acceptar les dates</a>
          </td>
          <td style="padding:0 4px">
            <a href="${declineUrl}" style="display:inline-block;background:#ffffff;color:#DC2626;text-decoration:none;font-weight:600;font-size:14.5px;padding:12px 22px;border-radius:9px;border:1px solid #FCA5A5">✕ Declinar / proposar canvis</a>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ICS note -->
    <tr><td style="padding:18px 36px 6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F5F2;border-radius:10px">
        <tr><td style="padding:13px 16px;font-size:12.5px;color:#52525B;line-height:1.55">
          <b style="color:#18181B">📎 Adjunt:</b> aquest email inclou un fitxer <code style="background:#fff;padding:1px 6px;border-radius:4px;font-size:11.5px;border:1px solid #E7E5E4">.ics</code> que pots obrir per afegir totes les sessions automàticament al teu calendari (Google, Outlook, Apple Calendar).
        </td></tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 36px 28px;text-align:center;font-size:11.5px;color:#A1A1AA;line-height:1.7;border-top:1px solid #F4F4F1;margin-top:18px">
      Equip de gestió docent · GESEM digital &amp; SoftSkills<br>
      <span style="color:#D6D3D1">·</span><br>
      Si els botons no funcionen, copia aquest enllaç al navegador:<br>
      <a href="${acceptUrl}" style="color:#71717A;word-break:break-all">${acceptUrl}</a>
    </td></tr>

  </table>

</td></tr>
</table>

</body></html>`;
}

// Helper: construeix un Google Calendar "Add Event" URL per una data concreta
// (Google només suporta 1 event per URL · multi-event s'ha de fer amb .ics)
function googleCalendarUrl(reserva, sessionIdx) {
  const d = reserva.dates[sessionIdx];
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  // Parsejar el torn per obtenir hora d'inici i fi
  const torn = String(reserva.torn || '9:00–11:00h');
  const tornMatch = torn.match(/(\d{1,2})[:.h]?(\d{2})?\s*[-–]\s*(\d{1,2})[:.h]?(\d{2})?/);
  const sh = tornMatch ? parseInt(tornMatch[1]) || 9 : 9;
  const sm = tornMatch ? parseInt(tornMatch[2]) || 0 : 0;
  const eh = tornMatch ? parseInt(tornMatch[3]) || 11 : 11;
  const em = tornMatch ? parseInt(tornMatch[4]) || 0 : 0;
  // Google Calendar usa format YYYYMMDDTHHMMSS (local, sense timezone) o YYYYMMDDTHHMMSSZ (UTC)
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${y}${pad(m)}${pad(day)}T${pad(sh)}${pad(sm)}00`;
  const end = `${y}${pad(m)}${pad(day)}T${pad(eh)}${pad(em)}00`;
  const title = `GESEM · ${reserva.curs || 'Curs'} · ${reserva.client || ''}`;
  const details = `Sessió ${sessionIdx + 1} de ${reserva.dates.length}\nClient: ${reserva.client}\nCurs: ${reserva.curs}\nFormador: ${reserva.formador}\nReserva ID: ${reserva.id}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: details,
    ctz: 'Europe/Madrid',
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

// Helper: construeix un Outlook Web "Add Event" deeplink per una data concreta
function outlookCalendarUrl(reserva, sessionIdx) {
  const d = reserva.dates[sessionIdx];
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  const torn = String(reserva.torn || '9:00–11:00h');
  const tornMatch = torn.match(/(\d{1,2})[:.h]?(\d{2})?\s*[-–]\s*(\d{1,2})[:.h]?(\d{2})?/);
  const sh = tornMatch ? parseInt(tornMatch[1]) || 9 : 9;
  const sm = tornMatch ? parseInt(tornMatch[2]) || 0 : 0;
  const eh = tornMatch ? parseInt(tornMatch[3]) || 11 : 11;
  const em = tornMatch ? parseInt(tornMatch[4]) || 0 : 0;
  const pad = (n) => String(n).padStart(2, '0');
  const isoStart = `${y}-${pad(m)}-${pad(day)}T${pad(sh)}:${pad(sm)}:00`;
  const isoEnd = `${y}-${pad(m)}-${pad(day)}T${pad(eh)}:${pad(em)}:00`;
  const title = `GESEM · ${reserva.curs || 'Curs'} · ${reserva.client || ''}`;
  const body = `Sessió ${sessionIdx + 1} de ${reserva.dates.length}. Client: ${reserva.client}. Formador: ${reserva.formador}.`;
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    body: body,
    startdt: isoStart,
    enddt: isoEnd,
  });
  return 'https://outlook.office.com/calendar/0/deeplink/compose?' + params.toString();
}

// Pàgina pública de resposta (carregada quan el formador clica un botó)
function responsePage({ reserva, action, token, baseUrl, message, error, googleConnected, justAccepted }) {
  const sessionsHtml = (reserva?.dates || []).map((d, i) => {
    const [y, m, day] = d.split('-');
    const dt = new Date(+y, +m - 1, +day);
    const dl = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'][dt.getDay()];
    return `<tr><td>${i+1}</td><td><b>${dl}</b> ${day}/${m}/${y}</td><td>${escapeHtml(reserva.torn || '')}</td></tr>`;
  }).join('');

  let content = '';
  if (error) {
    content = `<div class="card error"><div class="big-icon">⚠️</div><h2>Error</h2><p>${escapeHtml(error)}</p></div>`;
  } else if (action === 'accept' && message) {
    const icsUrl = `${baseUrl}/r/${token}/ics`;
    const n = reserva.dates?.length || 0;
    // Bloc de "ja afegit al calendari" si el formador té Google Calendar OAuth connectat
    const autoAddedHtml = googleConnected ? `
      <div class="card" style="background:#ECFDF5;border-color:#A7F3D0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="width:32px;height:32px;border-radius:8px;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px">📅</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:#065F46">Ja afegit al teu Google Calendar</div>
            <div style="font-size:12px;color:#047857">${n} sessions sincronitzades automàticament</div>
          </div>
        </div>
        <p style="font-size:12px;color:#065F46;margin-top:8px">Si no veus els events, obre <a href="https://calendar.google.com" target="_blank" style="color:#065F46;text-decoration:underline">calendar.google.com</a> i refresca.</p>
      </div>` : '';

    // Per a múltiples sessions, mostrem un sol botó .ics (recomanat) + opció avançada per session-by-session
    // Per a 1 sola sessió, mostrem els enllaços directes a Google/Outlook
    const singleSession = n === 1;
    let addToCalendarHtml = '';
    if (singleSession) {
      const gUrl = googleCalendarUrl(reserva, 0);
      const oUrl = outlookCalendarUrl(reserva, 0);
      addToCalendarHtml = `
        <a class="btn primary" href="${gUrl}" target="_blank" rel="noopener" style="background:#4285F4;border-color:#4285F4">📅 Afegir a Google Calendar</a>
        <a class="btn primary" href="${oUrl}" target="_blank" rel="noopener" style="background:#0078D4;border-color:#0078D4">📧 Afegir a Outlook</a>
        <a class="btn" href="${icsUrl}" download>📎 Descarregar .ics</a>
      `;
    } else {
      addToCalendarHtml = `
        <a class="btn primary" href="${icsUrl}" download>📎 Descarregar fitxer .ics · ${n} sessions</a>
        <p style="color:#71717A;font-size:12px;margin-top:10px">Aquest fitxer afegeix totes les ${n} sessions al teu calendari (Google, Outlook, Apple, Thunderbird) en un sol pas.</p>
        <details style="margin-top:14px">
          <summary style="cursor:pointer;font-size:13px;color:#52525B;font-weight:500">Prefereixo afegir-les una per una</summary>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
            ${(reserva.dates || []).map((d, i) => {
              const [y, m, day] = d.split('-');
              return `<div style="display:flex;gap:6px;align-items:center;padding:6px 0;border-bottom:0.5px solid #E7E5E4;font-size:12px">
                <span style="flex:1">Sessió ${i+1}: ${day}/${m}/${y}</span>
                <a href="${googleCalendarUrl(reserva, i)}" target="_blank" rel="noopener" style="color:#4285F4;text-decoration:none;font-size:11px">→ Google</a>
                <a href="${outlookCalendarUrl(reserva, i)}" target="_blank" rel="noopener" style="color:#0078D4;text-decoration:none;font-size:11px">→ Outlook</a>
              </div>`;
            }).join('')}
          </div>
        </details>
      `;
    }

    // Bloc de subscripció webcal · un cop subscrit, totes les futures reserves
    // GESEM apareixen automàticament al calendari del formador sense fer res
    const subscriptionHtml = `
      <div class="card" style="background:#FAF5FF;border-color:#D8B4FE">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div style="width:36px;height:36px;border-radius:9px;background:#7C3AED;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🔔</div>
          <div>
            <div style="font-size:15px;font-weight:600;color:#5B21B6">Subscriu el teu calendari · una sola vegada</div>
            <div style="font-size:12.5px;color:#6B21A8;line-height:1.5;margin-top:3px">A partir d'ara, totes les futures formacions de GESEM apareixeran automàticament al teu calendari. <b>No cal fer res més</b> · es sincronitza sol cada 1-2 hores.</div>
          </div>
        </div>
        <div id="sub-buttons" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px"></div>
        <details style="margin-top:10px">
          <summary style="cursor:pointer;font-size:12px;color:#6B21A8">Veure URL manual per a Apple Calendar / altres</summary>
          <input id="sub-url" type="text" readonly style="width:100%;margin-top:8px;padding:7px 10px;font-family:ui-monospace,monospace;font-size:11px;border:0.5px solid #D8B4FE;border-radius:6px;background:#fff" placeholder="Carregant URL..."/>
          <p style="font-size:11px;color:#71717A;margin-top:6px">A Apple Calendar: <b>Fitxer → Subscripció nova</b> i enganxa aquesta URL.</p>
        </details>
      </div>
      <script>
        // Genera l'URL de subscripció via API (pega el token actual)
        fetch('${baseUrl}/r/${token}/subscribe-url').then(r => r.json()).then(d => {
          if (!d.ok) return;
          const httpsUrl = d.httpsUrl;
          const webcalUrl = d.webcalUrl;
          // Per a Google Calendar Web: és més fàcil pegar l'URL HTTPS dins el "From URL"
          const googleAddUrl = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=' + encodeURIComponent(httpsUrl);
          document.getElementById('sub-buttons').innerHTML =
            '<a class="btn primary" href="' + webcalUrl + '" style="background:#7C3AED;border-color:#7C3AED">📲 Subscriure (auto-detecta)</a>' +
            '<a class="btn" href="' + googleAddUrl + '" target="_blank" rel="noopener" style="background:#fff;border-color:#4285F4;color:#4285F4">📅 Google Calendar Web</a>';
          document.getElementById('sub-url').value = httpsUrl;
        }).catch(() => {});
      </script>`;

    content = `
      <div class="card success">
        <div class="big-icon">✓</div>
        <h2>Gràcies! Has acceptat les dates</h2>
        <p>Hem rebut la teva confirmació per al curs <b>${escapeHtml(reserva.curs)}</b> del client <b>${escapeHtml(reserva.client)}</b>.</p>
        <p>L'equip de gestió docent ja n'està informat.</p>
      </div>
      ${autoAddedHtml}
      <div class="card">
        <h3 style="margin-top:0">${googleConnected ? 'També pots afegir a un altre calendari' : 'Afegir aquesta reserva al calendari'}</h3>
        <p style="color:#52525B;font-size:14px;margin:8px 0 18px">${n === 1 ? 'Tria el teu calendari preferit:' : `Tens ${n} sessions per afegir:`}</p>
        ${addToCalendarHtml}
      </div>
      ${subscriptionHtml}`;
  } else if (action === 'decline' && message) {
    content = `
      <div class="card info">
        <div class="big-icon">📨</div>
        <h2>Resposta enviada</h2>
        <p>Hem rebut la teva resposta. L'equip de gestió docent es posarà en contacte amb tu per buscar dates alternatives.</p>
      </div>`;
  } else if (action === 'decline') {
    content = `
      <div class="card">
        <h2>Declinar reserva</h2>
        <p style="color:#52525B;font-size:14px">Curs: <b>${escapeHtml(reserva.curs)}</b> · Client: <b>${escapeHtml(reserva.client)}</b></p>
        <form method="POST" action="${baseUrl}/r/${token}/decline">
          <label style="display:block;font-size:13px;color:#52525B;margin-bottom:6px">Motiu (opcional, ajuda l'equip a entendre què cal):</label>
          <textarea name="reason" rows="4" placeholder="Ex: tinc un altre compromís el dimarts 14, podem moure aquesta sessió a una altra data?" style="width:100%;padding:10px;border:1px solid #E7E5E4;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical"></textarea>
          <button type="submit" class="btn danger" style="margin-top:14px">✕ Confirmar declinació</button>
          <a href="${baseUrl}/r/${token}" class="btn" style="margin-left:8px">Cancel·lar</a>
        </form>
      </div>`;
  } else {
    const acceptUrl = `${baseUrl}/r/${token}?a=accept`;
    const declineUrl = `${baseUrl}/r/${token}?a=decline`;
    const stateBadge = reserva.formadorAccepted === true
      ? '<span class="badge ok">✓ Ja has acceptat</span>'
      : reserva.formadorAccepted === false
      ? '<span class="badge ko">✕ Ja has declinat</span>'
      : '<span class="badge wait">⏳ Pendent de la teva resposta</span>';
    content = `
      <div class="card">
        <h2>Reserva de formació</h2>
        <p style="color:#52525B;font-size:14px;margin-bottom:6px">Hola <b>${escapeHtml(reserva.formador)}</b>,</p>
        <p style="color:#52525B;font-size:14px">Aquesta és la teva reserva pendent de confirmació:</p>
        ${stateBadge}
        <table class="sessions-table">
          <thead><tr><th>#</th><th>Data</th><th>Horari</th></tr></thead>
          <tbody>${sessionsHtml}</tbody>
        </table>
        <div style="font-size:13px;color:#52525B"><b>Curs:</b> ${escapeHtml(reserva.curs)} · <b>Client:</b> ${escapeHtml(reserva.client)} · <b>Total:</b> ${reserva.h || 0}h</div>
      </div>
      ${reserva.formadorAccepted == null ? `
      <div class="card">
        <h3 style="margin-top:0">Què vols fer?</h3>
        <a class="btn primary" href="${acceptUrl}">✓ Acceptar totes les dates</a>
        <a class="btn danger" href="${declineUrl}">✕ Declinar / proposar canvis</a>
      </div>` : ''}`;
  }

  return `<!DOCTYPE html>
<html lang="ca"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>GESEM Planner · Resposta</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAFAF7;color:#18181B;padding:24px;min-height:100vh;-webkit-font-smoothing:antialiased}
.wrap{max-width:600px;margin:0 auto}
.logo{display:flex;align-items:center;gap:9px;margin-bottom:24px;justify-content:center}
.brand{font-size:15px;font-weight:600}
.brand span{color:#71717A;font-weight:500;font-size:12px}
.card{background:#fff;border:1px solid #E7E5E4;border-radius:14px;padding:28px 26px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.card.success{background:#ECFDF5;border-color:#A7F3D0;text-align:center}
.card.error{background:#FEF2F2;border-color:#FCA5A5;text-align:center;color:#991B1B}
.card.info{background:#EFF6FF;border-color:#BFDBFE;text-align:center;color:#1E40AF}
.big-icon{font-size:48px;line-height:1;margin-bottom:10px}
h2{font-size:22px;font-weight:600;margin-bottom:10px;letter-spacing:-0.01em}
h3{font-size:16px;font-weight:600;margin-bottom:8px}
p{font-size:14px;color:#52525B;line-height:1.55;margin-bottom:8px}
.btn{display:inline-block;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;background:#fff;color:#18181B;border:1px solid #E7E5E4;cursor:pointer;font-family:inherit;margin-right:6px}
.btn.primary{background:#059669;color:#fff;border-color:#059669}
.btn.danger{background:#fff;color:#DC2626;border-color:#FCA5A5}
.btn:hover{filter:brightness(0.95)}
.badge{display:inline-block;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:500;margin-bottom:14px}
.badge.ok{background:#ECFDF5;color:#065F46}
.badge.ko{background:#FEF2F2;color:#991B1B}
.badge.wait{background:#FEF3C7;color:#92400E}
.sessions-table{width:100%;border-collapse:collapse;margin:14px 0;border:1px solid #E7E5E4;border-radius:8px;overflow:hidden;font-size:13px}
.sessions-table th{background:#F5F5F2;padding:8px 12px;font-size:11px;color:#71717A;text-transform:uppercase;letter-spacing:0.05em;text-align:left;font-weight:600}
.sessions-table td{padding:8px 12px;border-top:1px solid #E7E5E4;color:#18181B}
.foot{text-align:center;color:#A1A1AA;font-size:12px;padding:18px 0}
</style></head>
<body>
<div class="wrap">
  <div class="logo">${LOGO_SVG}<span class="brand">GESEM <span>Planner</span></span></div>
  ${content}
  <div class="foot">GESEM digital &amp; SoftSkills</div>
</div>
</body></html>`;
}

module.exports = { formadorEmailHtml, responsePage, stripCalendarBlock };
