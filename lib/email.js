// ── SMTP MAILER ─────────────────────────────────────────────────
// Llegeix la configuració des de variables d'entorn (.env)
// Mai guarda la contrasenya en codi.
//
// Variables esperades:
//   SMTP_HOST    (ex: mail.gesem.cat)
//   SMTP_PORT    (ex: 465)
//   SMTP_SECURE  ('true' per SSL, 'false' per STARTTLS)
//   SMTP_USER    (ex: comunicacions@gesem.cat)
//   SMTP_PASS    (la contrasenya)
//   SMTP_FROM    (ex: "GESEM <comunicacions@gesem.cat>")

const nodemailer = require('nodemailer');

let _transporter = null;
let _config = null;

function getConfig() {
  return {
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    user:   process.env.SMTP_USER,
    pass:   process.env.SMTP_PASS,
    from:   process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

function isConfigured() {
  const c = getConfig();
  return !!(c.host && c.user && c.pass);
}

function getTransporter() {
  if (_transporter) return _transporter;
  if (!isConfigured()) return null;
  const c = getConfig();
  _config = c;
  _transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  return _transporter;
}

async function verifyConnection() {
  const t = getTransporter();
  if (!t) throw new Error('SMTP no configurat (falten variables d\'entorn)');
  await t.verify();
  return true;
}

async function sendMail({ to, subject, text, html, replyTo, cc, bcc, attachments, icalEvent }) {
  const t = getTransporter();
  if (!t) throw new Error('SMTP no configurat');
  if (!to || !subject) throw new Error('to i subject són obligatoris');
  const c = _config || getConfig();
  const info = await t.sendMail({
    from: c.from,
    to,
    subject,
    text: text || (html ? undefined : ''),
    html,
    replyTo,
    cc,
    bcc,
    attachments, // [{ filename, content, contentType }]
    icalEvent,   // { method, content } — fa que el missatge es marqui com a invitació nativa
  });
  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

module.exports = {
  isConfigured,
  verifyConnection,
  sendMail,
  getConfig: () => {
    const c = getConfig();
    return { ...c, pass: c.pass ? '***' : null }; // mai retornar la contrasenya
  },
};
