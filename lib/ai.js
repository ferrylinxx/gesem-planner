// ── IA: PARSER D'EMAILS COMERCIALS ─────────────────────────────
// Utilitza Groq (compatible OpenAI API) amb Llama 3.3 70B.
// Free tier: 14.400 req/dia, ~500 tok/s.
//
// Variables d'entorn:
//   GROQ_API_KEY    (la clau de console.groq.com)
//   GROQ_MODEL      (per defecte: llama-3.3-70b-versatile)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function isConfigured() {
  return !!process.env.GROQ_API_KEY;
}

function getModel() {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

// Truca a Groq amb un prompt i retorna la resposta
async function callGroq(prompt, { jsonMode = true, maxTokens = 800, temperature = 0.1 } = {}) {
  if (!isConfigured()) throw new Error('GROQ_API_KEY no configurat');
  const body = {
    model: getModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API ${res.status}: ${errText.substring(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Resposta buida de Groq');
  return { content, usage: data.usage };
}

// ── PARSER D'EMAILS COMERCIALS ─────────────────────────────────
async function parseCommercialEmail(text, context = {}) {
  const especialitats = (context.especialitats || []).join(' / ');
  const modalitats    = (context.modalitats    || []).join(' / ');
  const torns         = (context.torns         || []).join(' / ');
  const agents        = (context.agents        || []).join(' / ');

  const prompt = `Ets un assistent de GESEM Planner que extreu dades estructurades d'emails de comercials sobre noves peticions de cursos de formació professional. Respon en català.

EMAIL REBUT:
"""
${text.substring(0, 3000)}
"""

LLISTES OFICIALS DE L'APP (utilitza EXACTAMENT aquestes opcions, o null si no es pot inferir):
- Especialitats: ${especialitats}
- Modalitats: ${modalitats}
- Torns possibles: ${torns}
- Agents comercials existents: ${agents}

Tasca: Extreu els camps següents en JSON. Si un camp no està clar a l'email, posa null (no inventis).

Esquema JSON esperat:
{
  "client": string|null,
  "curs": string|null,
  "especialitat": string|null,
  "modalitat": string|null,
  "hores": number|null,
  "hsess": number|null,
  "ssw": number|null,
  "torn": string|null,
  "data_inici": string|null,
  "agent_comercial": string|null,
  "distribucio_dies": string[]|null,
  "preu_hora": number|null,
  "confianca": number,
  "notes": string
}

Regles:
- "data_inici" en format YYYY-MM-DD. Si l'email diu "passada la Setmana Santa 2026", calcula (Pasqua 2026 = 5 abril, així Setmana Santa 6-12 abril, "passada" → 13 abril). L'any actual és 2026.
- "distribucio_dies": array dels noms dels dies en català (Dilluns, Dimarts, Dimecres, Dijous, Divendres). Si no hi ha info, null.
- "agent_comercial": busca al text noms o referències a "Marc", "Jordi", etc., i match exacte amb la llista oficial.
- "confianca": 0-100 segons claredat de l'email.
- "notes": una frase curta amb què és ambigu o què falta. Si tot clar, posa "Tots els camps detectats correctament."

RESPON NOMÉS amb el JSON, sense codi block ni text addicional.`;

  const { content, usage } = await callGroq(prompt, { jsonMode: true, maxTokens: 800 });
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('JSON invàlid retornat per la IA: ' + content.substring(0, 200));
  }

  // Validar tipus bàsics
  if (typeof parsed.confianca !== 'number') parsed.confianca = 50;
  if (parsed.hores != null && typeof parsed.hores !== 'number') parsed.hores = parseInt(parsed.hores) || null;

  return { parsed, usage, model: getModel() };
}

// ── PROPOSTES DE CANVI per a /canvis ───────────────────────────
// Donada una reserva existent + tipus de canvi sol·licitat, retorna 3
// propostes alternatives. L'IA considera: motiu, dates ocupades, formadors
// alternatius, distribució possible.
async function suggestChanges({ reserva, tipus, motiu, formadorActual, formadorsAlternatius, allReservaDates, festius }) {
  const prompt = `Ets un assistent de planificació de cursos a GESEM. Has de proposar 3 ALTERNATIVES per a un canvi sol·licitat sobre una reserva existent. Respon en JSON.

RESERVA ACTUAL:
- Client: ${reserva.client}
- Curs: ${reserva.curs}
- Formador actual: ${formadorActual ? formadorActual.nom + ' (especialitats: ' + (formadorActual.specs || []).join(', ') + ')' : 'desconegut'}
- Hores totals: ${reserva.h}h, ${reserva.ns} sessions de ${reserva.hs}h
- Torn: ${reserva.torn}
- Dates actuals: ${(reserva.dates || []).join(', ')}
- Estat: ${reserva.estat}

TIPUS DE CANVI SOL·LICITAT: ${tipus}
- 'inici' = inici més tard (proposar nova data inici)
- 'data' = canvi de data concreta (moure sessions específiques)
- 'horari' = canvi de torn/franja horària
- 'tot' = reprogramació total

MOTIU: ${motiu || 'no especificat'}

CONTEXT:
- Dates ja ocupades per altres reserves GESEM (NO reutilitzar): ${[...allReservaDates].slice(0, 50).join(', ')}
- Festius Catalunya: ${festius.slice(0, 20).join(', ')}
- Formadors alternatius disponibles: ${(formadorsAlternatius || []).map(f => f.nom + ' (' + (f.specs || []).join(', ') + ', rating ' + f.rating + ', ' + f.disp + ')').slice(0, 10).join(' | ')}

Genera 3 propostes en JSON amb aquesta forma EXACTA:
{
  "propostes": [
    {
      "label": "string curt (ex: 'Mateix formador · noves dates')",
      "sublabel": "string més descriptiu",
      "score": 1-100 (compatibilitat amb la sol·licitud),
      "color": "best" | "opt2" | "opt3" | "opt-alt",
      "formadorNom": "nom del formador suggerit (o null si manté l'actual)",
      "novesDates": ["YYYY-MM-DD", ...] (les noves dates proposades),
      "nouTorn": "string (o null si manté)",
      "canviForm": true|false,
      "canviTorn": true|false,
      "canviDates": true|false,
      "desc": "explicació curta del per què",
      "raonament": "anàlisi més detallada (50-100 paraules)"
    }
  ]
}

Regles:
- Les noves dates HAN DE evitar les "Dates ja ocupades" i els festius
- Mantenir el mateix nombre de sessions i hores
- Respectar dilluns-divendres (no caps de setmana)
- La 1a proposta ha de ser la millor recomanada (color "best")
- Si el motiu menciona dates específiques a evitar, prioritzar evitar-les

RESPON NOMÉS amb el JSON, sense codi block.`;

  const { content, usage } = await callGroq(prompt, { jsonMode: true, maxTokens: 1500, temperature: 0.2 });
  try {
    const parsed = JSON.parse(content);
    return { parsed, usage, model: getModel() };
  } catch (e) {
    throw new Error('JSON invàlid de la IA: ' + content.substring(0, 200));
  }
}

// ── SUGGERIR FORMADOR ÒPTIM per a una nova petició ─────────────
// Considera: especialitat, històric amb el client, ratings, marge de cost,
// disponibilitat declarada
async function suggestFormador({ peticio, formadors, reservesPrevies }) {
  // Construir el context d'històric per client
  const historicClient = reservesPrevies
    .filter(r => r.client === peticio.client && r.estat !== 'cancel')
    .map(r => ({
      curs: r.curs,
      formador: r.formador,
      dates: r.dates?.length || 0,
    }));

  const formadorsCompactes = formadors.slice(0, 20).map(f => ({
    id: f.id,
    nom: f.nom,
    specs: f.specs,
    rating: f.rating,
    disp: f.disp,
    preu_hora: f.preu_hora,
    tipus: f.tipus,
    cursos: f.cursos,
  }));

  const prompt = `Ets un assistent de gestió de cursos a GESEM. Has de suggerir el formador òptim per a una petició nova.

NOVA PETICIÓ:
- Client: ${peticio.client}
- Curs: ${peticio.curs}
- Especialitat: ${peticio.especialitat}
- Modalitat: ${peticio.modalitat || ''}
- Hores: ${peticio.hores}h
- Preu/hora client: ${peticio.preuHora}€

HISTÒRIC AMB AQUEST CLIENT:
${historicClient.length ? JSON.stringify(historicClient, null, 0) : '(cap reserva anterior)'}

FORMADORS DISPONIBLES (max 20):
${JSON.stringify(formadorsCompactes, null, 0)}

Genera el TOP 3 de formadors recomanats amb aquesta forma EXACTA:
{
  "top3": [
    {
      "formadorId": number,
      "nom": "string",
      "score": 0-100,
      "rao_principal": "frase curta (ex: 'Ja ha fet 4 cursos amb aquest client')",
      "raons": ["array de 2-3 raons curtes"],
      "marge_pct": number (% marge si fas servir el seu preu_hora · pot ser negatiu)
    }
  ],
  "resum": "frase curta amb la recomanació final"
}

Regles per puntuar (de més pes a menys):
1. Continuïtat amb client (ha fet cursos abans amb aquest client) → +25 punts
2. Match d'especialitat exacte → +20 punts
3. Disponibilitat 'alta' → +15 punts; 'parcial' → +5; 'baixa' → -10
4. Rating alt (≥4.5) → +10
5. Marge ≥40% → +10; ≥25% → +5; <15% → -5
6. Tipus 'intern' → +5 (preu més controlat)

RESPON NOMÉS amb el JSON, sense codi block.`;

  const { content, usage } = await callGroq(prompt, { jsonMode: true, maxTokens: 700, temperature: 0.1 });
  try {
    const parsed = JSON.parse(content);
    return { parsed, usage, model: getModel() };
  } catch (e) {
    throw new Error('JSON invàlid de la IA: ' + content.substring(0, 200));
  }
}

// ── VERIFY connection ──────────────────────────────────────────
async function verifyConnection() {
  // Fa una crida senzilla per validar credencials.
  // Nota: Groq exigeix la paraula "json" explícita al prompt si s'usa response_format=json_object
  const { content } = await callGroq('Respon en format JSON amb la clau "ok" valor true.', { jsonMode: true, maxTokens: 20 });
  return { ok: true, response: content };
}

module.exports = {
  isConfigured,
  parseCommercialEmail,
  suggestChanges,
  suggestFormador,
  verifyConnection,
  getModel,
};
