// ── HMAC SIGNED TOKENS ──────────────────────────────────────────
// Per a links públics segurs (ex: l'email amb Acceptar/Declinar
// que envia el formador). Sense això, qualsevol podria endevinar
// l'ID d'una reserva i acceptar-la per ell mateix.
//
// Format: base64url(payload).hmac
// El payload conté { reservaId, formadorId, exp (timestamp ms) }.
//
// Variables d'entorn:
//   TOKEN_SECRET (cadena llarga, ex: 32+ caràcters hex)
// Si no està definida, en genera una efímera (avís: tokens caducaran al reiniciar).

const crypto = require('crypto');

const SECRET = (() => {
  if (process.env.TOKEN_SECRET && process.env.TOKEN_SECRET.length >= 16) {
    return process.env.TOKEN_SECRET;
  }
  console.warn('[tokens] TOKEN_SECRET no definit · usant un secret efímer (els tokens caducaran al reiniciar)');
  return crypto.randomBytes(32).toString('hex');
})();

// Sign retorna un token en format DATA.SIG
function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}

// Verify retorna el payload o llança Error
function verify(token) {
  if (!token || typeof token !== 'string') throw new Error('Token buit');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Format invàlid');
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  // Comparació constant temps per evitar timing attacks
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Signatura invàlida');
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString()); }
  catch (e) { throw new Error('Payload no és JSON vàlid'); }
  if (payload.exp && Date.now() > payload.exp) throw new Error('Token caducat');
  return payload;
}

// Helper específic per a tokens de reserva (vàlids 60 dies)
function signReservaToken(reservaId, formadorId, action /* 'respond' */ = 'respond') {
  return sign({
    reservaId,
    formadorId,
    action,
    iat: Date.now(),
    exp: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 dies
  });
}

// Token de subscripció webcal per formador · vàlid 5 anys
// L'usuari subscriu el seu calendari a aquesta URL una sola vegada i el seu
// calendari pol·la automàticament cada 1-2h durant els pròxims 5 anys.
function signFormadorSubscriptionToken(formadorId) {
  return sign({
    formadorId,
    action: 'subscribe',
    iat: Date.now(),
    exp: Date.now() + 5 * 365 * 24 * 60 * 60 * 1000, // 5 anys
  });
}

module.exports = { sign, verify, signReservaToken, signFormadorSubscriptionToken };
