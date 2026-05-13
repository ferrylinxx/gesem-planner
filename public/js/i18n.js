// ── SISTEMA DE TRADUCCIÓ (CA / ES) ───────────────────────────────
// Carregat abans d'app.js i shortcuts.js (a html: <script src="/js/i18n.js"></script>)
//
// Ús a HTML: <element data-i18n="key">text per defecte</element>
// Ús a HTML: <input data-i18n-placeholder="key" placeholder="..."/>
// Ús a JS:   t('key') retorna la traducció a l'idioma actual

const TRANSLATIONS = {
  // ── Navegació (sidebar) ────────────────────────────────────
  'nav.dashboard': { ca: 'Dashboard', es: 'Dashboard' },
  'nav.peticio':   { ca: 'Nova petició', es: 'Nueva petición' },
  'nav.reserves':  { ca: 'Reserves', es: 'Reservas' },
  'nav.canvis':    { ca: 'Canvis', es: 'Cambios' },
  'nav.formadors': { ca: 'Formadors', es: 'Formadores' },
  'nav.entrades':  { ca: 'Entrades', es: 'Entradas' },

  // ── Sidebar footer ─────────────────────────────────────────
  'foot.changelog': { ca: 'Changelog', es: 'Historial' },
  'foot.darkmode':  { ca: 'Mode fosc', es: 'Modo oscuro' },
  'foot.lightmode': { ca: 'Mode clar', es: 'Modo claro' },
  'foot.language':  { ca: 'Idioma', es: 'Idioma' },

  // ── Appbar titles ──────────────────────────────────────────
  'page.dashboard': { ca: 'Dashboard', es: 'Dashboard' },
  'page.peticio':   { ca: 'Nova petició', es: 'Nueva petición' },
  'page.gestio':    { ca: 'Gestió de reserves', es: 'Gestión de reservas' },
  'page.canvis':    { ca: 'Gestió de canvis', es: 'Gestión de cambios' },
  'page.formadors': { ca: 'Formadors', es: 'Formadores' },
  'page.entrades':  { ca: 'Entrades de peticions', es: 'Entradas de peticiones' },
  'page.changelog': { ca: 'Changelog', es: 'Historial de versiones' },

  // ── Dashboard KPIs ─────────────────────────────────────────
  'kpi.active':    { ca: 'Reserves actives',         es: 'Reservas activas' },
  'kpi.pending':   { ca: 'Pendents de confirmar',    es: 'Pendientes de confirmar' },
  'kpi.confirmed': { ca: 'Confirmades',              es: 'Confirmadas' },
  'kpi.revenue':   { ca: 'Facturat (mes actual)',    es: 'Facturado (mes actual)' },
  'kpi.hours':     { ca: 'Hores planificades',       es: 'Horas planificadas' },
  'kpi.formadors': { ca: 'Formadors actius',         es: 'Formadores activos' },
  'kpi.upcoming':  { ca: 'Properes sessions (7 dies)', es: 'Próximas sesiones (7 días)' },
  'kpi.distrib':   { ca: 'Distribució per estat',    es: 'Distribución por estado' },
  'kpi.topf':      { ca: 'Top formadors (per hores)', es: 'Top formadores (por horas)' },
  'kpi.topc':      { ca: 'Top clients (per volum)',  es: 'Top clientes (por volumen)' },
  'kpi.alerts':    { ca: '⚠️ Alertes',               es: '⚠️ Alertas' },
  'kpi.viewall':   { ca: 'Veure tots →',             es: 'Ver todos →' },
  'kpi.empty':     { ca: 'Encara no hi ha dades',    es: 'Aún no hay datos' },
  'kpi.empty7':    { ca: 'Cap sessió els propers 7 dies', es: 'Ninguna sesión los próximos 7 días' },
  'kpi.connerr':   { ca: 'Error de connexió amb el servidor', es: 'Error de conexión con el servidor' },
  'kpi.total':     { ca: 'TOTAL', es: 'TOTAL' },
  'kpi.greet.morning':   { ca: 'Bon dia', es: 'Buenos días' },
  'kpi.greet.afternoon': { ca: 'Bona tarda', es: 'Buenas tardes' },
  'kpi.greet.evening':   { ca: 'Bona vesprada', es: 'Buenas tardes' },
  'kpi.greet.night':     { ca: 'Bona nit', es: 'Buenas noches' },

  // Estats de reserva
  'state.pendent-cli':  { ca: 'Pendent client',     es: 'Pendiente cliente' },
  'state.pendent-form': { ca: 'Pendent formador',   es: 'Pendiente formador' },
  'state.confirmada':   { ca: 'Confirmada',         es: 'Confirmada' },
  'state.cancel':       { ca: 'Cancel·lada',        es: 'Cancelada' },
  'state.vf':           { ca: 'Arxivada (VF)',      es: 'Archivada (VF)' },

  // ── Botons comuns ──────────────────────────────────────────
  'btn.generate':  { ca: 'Generar proposta', es: 'Generar propuesta' },
  'btn.cancel':    { ca: 'Cancel·lar',       es: 'Cancelar' },
  'btn.confirm':   { ca: 'Confirmar',        es: 'Confirmar' },
  'btn.save':      { ca: 'Desar',            es: 'Guardar' },
  'btn.delete':    { ca: 'Eliminar',         es: 'Eliminar' },
  'btn.edit':      { ca: 'Editar',           es: 'Editar' },
  'btn.clear':     { ca: 'Netejar',          es: 'Limpiar' },
  'btn.add':       { ca: 'Afegir',           es: 'Añadir' },
  'btn.copy':      { ca: 'Copiar',           es: 'Copiar' },
  'btn.send':      { ca: 'Enviar',           es: 'Enviar' },
  'btn.back':      { ca: '← Tornar',         es: '← Volver' },
  'btn.next':      { ca: 'Següent →',        es: 'Siguiente →' },

  // ── Petició (formulari) ──────────────────────────────────
  'pet.section.curs':       { ca: 'Dades del curs',          es: 'Datos del curso' },
  'pet.section.preferit':   { ca: 'Formador preferit (opcional)', es: 'Formador preferido (opcional)' },
  'pet.section.agent':      { ca: 'Agent comercial',         es: 'Agente comercial' },
  'pet.section.horari':     { ca: 'Horari',                  es: 'Horario' },
  'pet.section.distrib':    { ca: 'Distribució de dies',     es: 'Distribución de días' },
  'pet.section.preu':       { ca: 'Preu i restriccions',     es: 'Precio y restricciones' },

  'pet.client':         { ca: 'Client',                  es: 'Cliente' },
  'pet.client.ph':      { ca: "Nom de l'empresa client", es: 'Nombre de la empresa cliente' },
  'pet.curs':           { ca: 'Nom del curs',            es: 'Nombre del curso' },
  'pet.curs.ph':        { ca: 'Títol del curs',          es: 'Título del curso' },
  'pet.especialitat':   { ca: 'Especialitat',            es: 'Especialidad' },
  'pet.modalitat':      { ca: 'Modalitat',               es: 'Modalidad' },
  'pet.preferit':       { ca: 'Cap preferència · flux habitual', es: 'Sin preferencia · flujo habitual' },
  'pet.hores':          { ca: 'Hores totals',            es: 'Horas totales' },
  'pet.hsess':          { ca: 'Hores/sessió',            es: 'Horas/sesión' },
  'pet.ssw':            { ca: 'Sess./setm.',             es: 'Ses./sem.' },
  'pet.torn':           { ca: 'Torn preferit',           es: 'Turno preferido' },
  'pet.inici':          { ca: 'Data inici',              es: 'Fecha inicio' },
  'pet.preu':           { ca: 'Preu/hora client (€)',    es: 'Precio/hora cliente (€)' },
  'pet.bloquejats':     { ca: 'Dies bloquejats',         es: 'Días bloqueados' },
  'pet.excloure':       { ca: '+ Excloure',              es: '+ Excluir' },
  'pet.candidats':      { ca: 'Formadors candidats',     es: 'Formadores candidatos' },
  'pet.candidats.empty':{ ca: 'Omple el formulari per veure candidats', es: 'Rellena el formulario para ver candidatos' },

  // ── Reserves (gestió) ────────────────────────────────────
  'res.all':       { ca: 'Totes',          es: 'Todas' },
  'res.confirmed': { ca: 'Confirmades',    es: 'Confirmadas' },
  'res.cancelled': { ca: 'Cancel·lades',   es: 'Canceladas' },
  'res.summary':   { ca: 'Resum per agent', es: 'Resumen por agente' },
  'res.allagents': { ca: 'Tots els agents', es: 'Todos los agentes' },
  'res.bydate':    { ca: 'Per data',       es: 'Por fecha' },
  'res.byagent':   { ca: 'Per agent',      es: 'Por agente' },
  'res.byclient':  { ca: 'Per client',     es: 'Por cliente' },

  // ── Misc ────────────────────────────────────────────────
  'msg.loading':   { ca: 'Carregant GESEM Planner...', es: 'Cargando GESEM Planner...' },
  'msg.404.title': { ca: 'Pàgina no trobada',    es: 'Página no encontrada' },
  'msg.404.desc':  { ca: "No hem trobat aquesta pàgina. Potser hi ha un error a l'URL.", es: 'No hemos encontrado esta página. Puede que haya un error en la URL.' },
  'msg.404.back':  { ca: 'Tornar a Dashboard',   es: 'Volver al Dashboard' },
  'msg.404.prev':  { ca: '← Pàgina anterior',    es: '← Página anterior' },

  // ── Petició: missatges/help ─────────────────────────────────
  'pet.preferit.help':  { ca: "Si el client demana un formador específic, es prioritzarà a la proposta.", es: 'Si el cliente pide un formador específico, se priorizará en la propuesta.' },
  'pet.distrib.help':   { ca: 'Selecciona la distribució:',     es: 'Selecciona la distribución:' },
  'pet.bloquejats.help':{ ca: 'Dies bloquejats:',                es: 'Días bloqueados:' },
  'pet.ssw.1':          { ca: '1/setm',  es: '1/sem' },
  'pet.ssw.2':          { ca: '2/setm',  es: '2/sem' },
  'pet.ssw.3':          { ca: '3/setm',  es: '3/sem' },
  'pet.inici.tag':      { ca: 'orientativa', es: 'orientativa' },
  'pet.candidats.sub':  { ca: 'Omple el formulari per veure candidats', es: 'Rellena el formulario para ver candidatos' },
  'pet.proposta.title': { ca: 'Proposta generada', es: 'Propuesta generada' },
  'pet.agent.new':      { ca: 'Nou agent:', es: 'Nuevo agente:' },
  'pet.agent.placeholder': { ca: 'Nom complet...', es: 'Nombre completo...' },

  // Días de la semana abreviats (per botons distribució i bloquejats)
  'day.mon': { ca: 'Dl', es: 'Lu' },
  'day.tue': { ca: 'Dm', es: 'Ma' },
  'day.wed': { ca: 'Dc', es: 'Mi' },
  'day.thu': { ca: 'Dj', es: 'Ju' },
  'day.fri': { ca: 'Dv', es: 'Vi' },

  // ── Gestió: chips i headers ─────────────────────────────────
  'gest.alert':       { ca: 'Email resum per agent', es: 'Email resumen por agente' },
  'gest.summary':     { ca: 'Resum per agent',       es: 'Resumen por agente' },
  'gest.allagents':   { ca: 'Tots els agents',       es: 'Todos los agentes' },
  'gest.bydate':      { ca: 'Per data',              es: 'Por fecha' },
  'gest.byagent':     { ca: 'Per agent',             es: 'Por agente' },
  'gest.byclient':    { ca: 'Per client',            es: 'Por cliente' },
  'gest.f.all':       { ca: 'Totes',                 es: 'Todas' },
  'gest.f.confirmed': { ca: 'Confirmades',           es: 'Confirmadas' },
  'gest.f.cancel':    { ca: 'Cancel·lades',          es: 'Canceladas' },
  'gest.f.pendcli':   { ca: 'Pendent client',        es: 'Pendiente cliente' },
  'gest.f.pendform':  { ca: 'Pendent formador',      es: 'Pendiente formador' },
  'gest.f.vf':        { ca: 'VF',                    es: 'VF' },

  // ── Canvis: panell esquerre ────────────────────────────────
  'canvis.select':       { ca: 'Selecciona la reserva',          es: 'Selecciona la reserva' },
  'canvis.tipus':        { ca: 'Tipus de canvi sol·licitat',     es: 'Tipo de cambio solicitado' },
  'canvis.t.inici':      { ca: 'Inici més tard',                 es: 'Inicio más tarde' },
  'canvis.t.inici.d':    { ca: "Data d'inici posterior",         es: 'Fecha de inicio posterior' },
  'canvis.t.data':       { ca: 'Canvi data concreta',            es: 'Cambio fecha concreta' },
  'canvis.t.data.d':     { ca: 'Moure sessions concretes',       es: 'Mover sesiones concretas' },
  'canvis.t.horari':     { ca: "Canvi d'horari",                 es: 'Cambio de horario' },
  'canvis.t.horari.d':   { ca: 'Diferent franja horària',        es: 'Diferente franja horaria' },
  'canvis.t.tot':        { ca: 'Reprogramació total',            es: 'Reprogramación total' },
  'canvis.t.tot.d':      { ca: 'Totes les dates de nou',         es: 'Todas las fechas de nuevo' },
  'canvis.motiu':        { ca: 'Motiu del canvi',                es: 'Motivo del cambio' },
  'canvis.motiu.ph':     { ca: "ex: canvi d'agenda del client...", es: 'ej: cambio de agenda del cliente...' },
  'canvis.fopt':         { ca: 'Si el formador no té disponibilitat...', es: 'Si el formador no tiene disponibilidad...' },
  'canvis.fopt.no':      { ca: 'Mantenir el mateix formador · altres dates', es: 'Mantener el mismo formador · otras fechas' },
  'canvis.fopt.si':      { ca: 'Permetre canvi de formador si cal', es: 'Permitir cambio de formador si es necesario' },
  'canvis.fopt.prio':    { ca: 'Prioritzar disponibilitat · qualsevol formador', es: 'Priorizar disponibilidad · cualquier formador' },
  'canvis.gen':          { ca: 'Generar proposta amb IA',        es: 'Generar propuesta con IA' },
  'canvis.empty.title':  { ca: 'Gestió de canvis de dates',      es: 'Gestión de cambios de fechas' },
  'canvis.empty.desc':   { ca: "Selecciona una reserva i el tipus de canvi. La IA analitzarà totes les opcions i generarà una proposta per al client i el comercial.", es: 'Selecciona una reserva y el tipo de cambio. La IA analizará todas las opciones y generará una propuesta para el cliente y el comercial.' },
  'canvis.tab.prop':     { ca: 'Proposta IA',                    es: 'Propuesta IA' },
  'canvis.tab.email':    { ca: 'Email generat',                  es: 'Email generado' },
  'canvis.tab.hist':     { ca: 'Historial',                      es: 'Historial' },

  // ── Formadors ──────────────────────────────────────────────
  'form.search':       { ca: 'Cerca per nom o especialitat...',     es: 'Buscar por nombre o especialidad...' },
  'form.allTypes':     { ca: 'Tots',                                es: 'Todos' },
  'form.intern':       { ca: 'Interns',                             es: 'Internos' },
  'form.extern':       { ca: 'Externs',                             es: 'Externos' },
  'form.byname':       { ca: 'Per nom',                             es: 'Por nombre' },
  'form.byvolume':     { ca: 'Per volum GESEM',                     es: 'Por volumen GESEM' },
  'form.bydisp':       { ca: 'Per disponibilitat',                  es: 'Por disponibilidad' },
  'form.byrating':     { ca: 'Per valoració',                       es: 'Por valoración' },
  'form.new':          { ca: '+ Nou formador',                      es: '+ Nuevo formador' },
  'form.specialty':    { ca: 'Especialitat:',                       es: 'Especialidad:' },
  'form.allSpecs':     { ca: 'Totes',                               es: 'Todas' },
  'form.dispYear':     { ca: 'Disponibilitat anual',                es: 'Disponibilidad anual' },
  'form.dispYearSub':  { ca: 'Hores lliures estimades',             es: 'Horas libres estimadas' },
  'form.volumeGesem':  { ca: 'Volum amb GESEM',                     es: 'Volumen con GESEM' },
  'form.volumeSub':    { ca: 'Hores facturades',                    es: 'Horas facturadas' },

  // ── Entrades ───────────────────────────────────────────────
  'ent.title':           { ca: 'Entrades de peticions',                  es: 'Entradas de peticiones' },
  'ent.sub':             { ca: 'Tres canals per introduir peticions al sistema', es: 'Tres canales para introducir peticiones al sistema' },
  'ent.tab.manual':      { ca: 'Manual',                                es: 'Manual' },
  'ent.tab.email':       { ca: 'Email comercial',                       es: 'Email comercial' },
  'ent.tab.massiu':      { ca: 'Càrrega massiva',                       es: 'Carga masiva' },
  'ent.manual.title':    { ca: 'Petició manual',                        es: 'Petición manual' },
  'ent.manual.desc':     { ca: 'Utilitza el formulari complet de la pestanya Petició per introduir manualment un curs amb tots els criteris.', es: 'Utiliza el formulario completo de la pestaña Petición para introducir manualmente un curso con todos los criterios.' },
  'ent.manual.go':       { ca: 'Anar a Petició →',                      es: 'Ir a Petición →' },
  'ent.email.title':     { ca: 'Cos del missatge del comercial',        es: 'Cuerpo del mensaje del comercial' },
  'ent.email.go':        { ca: 'Analitzar amb IA',                      es: 'Analizar con IA' },
  'ent.massiu.title':    { ca: 'Càrrega massiva de cursos',             es: 'Carga masiva de cursos' },
  'ent.massiu.sub':      { ca: 'Enganxa una taula (Excel/CSV) o escriu manualment', es: 'Pega una tabla (Excel/CSV) o escribe manualmente' },
  'ent.massiu.go':       { ca: 'Assignar calendaris amb IA',            es: 'Asignar calendarios con IA' },
  'ent.massiu.upload':   { ca: '📎 Pujar fitxer CSV/Excel',             es: '📎 Subir archivo CSV/Excel' },
  'ent.archive.title':   { ca: 'Arxiu de cursos finalitzats',           es: 'Archivo de cursos finalizados' },
  'ent.archive.sub':     { ca: 'Cursos marcats com a VF · Tancats i arxivats', es: 'Cursos marcados como VF · Cerrados y archivados' },

  // ── Toast messages (app.js) ────────────────────────────────
  'toast.netejada':      { ca: 'Petició netejada',                      es: 'Petición limpiada' },
  'toast.afegit':        { ca: 'Afegit',                                es: 'Añadido' },
  'toast.eliminat':      { ca: 'Eliminat',                              es: 'Eliminado' },
  'toast.actualitzat':   { ca: 'Actualitzat',                           es: 'Actualizado' },
  'toast.confirmada':    { ca: '✓ Confirmada',                          es: '✓ Confirmada' },
  'toast.cancelada':     { ca: 'Cancel·lada · dates alliberades',       es: 'Cancelada · fechas liberadas' },
  'toast.copiat':        { ca: 'Text copiat',                           es: 'Texto copiado' },
  'toast.guardat':       { ca: 'Esborrany guardat',                     es: 'Borrador guardado' },
  'toast.draft.restored':{ ca: 'Esborrany restaurat',                   es: 'Borrador restaurado' },
  'toast.draft.discard': { ca: 'Esborrany descartat',                   es: 'Borrador descartado' },
  'toast.alt.applied':   { ca: 'Alternativa aplicada',                  es: 'Alternativa aplicada' },
  'toast.empty':         { ca: 'Buit',                                  es: 'Vacío' },
  'toast.exists':        { ca: 'Ja existeix',                           es: 'Ya existe' },
  'toast.minim':         { ca: 'Mínim 1',                               es: 'Mínimo 1' },
  'toast.write_name':    { ca: 'Escriu el nom',                         es: 'Escribe el nombre' },
  'toast.agent_added':   { ca: 'Agent afegit',                          es: 'Agente añadido' },
  'toast.email_marked':  { ca: 'Marcat com a enviat',                   es: 'Marcado como enviado' },
  'toast.reserva.created': { ca: 'Reserva creada · ',                   es: 'Reserva creada · ' },
  'toast.cal.synced':    { ca: ' calendari sincronitzat',               es: ' calendario sincronizado' },
  'toast.cal.synced.s':  { ca: ' calendaris sincronitzats',             es: ' calendarios sincronizados' },

  // ── Confirm dialogs ────────────────────────────────────────
  'confirm.delete':      { ca: 'Eliminar de la llista?',                es: '¿Eliminar de la lista?' },
  'confirm.delete.msg':  { ca: 'Vols eliminar <strong>{item}</strong> de {cat}?', es: '¿Quieres eliminar <strong>{item}</strong> de {cat}?' },
  'confirm.cancel':      { ca: 'Cancel·lar reserva?',                   es: '¿Cancelar reserva?' },
  'confirm.cancel.msg':  { ca: '<strong>{client}</strong> · {curs}<br>Les {n} sessions s\'alliberaran. Aquesta acció es pot revertir canviant l\'estat a "Pendent".', es: '<strong>{client}</strong> · {curs}<br>Las {n} sesiones se liberarán. Esta acción se puede revertir cambiando el estado a "Pendiente".' },
  'confirm.cancel.btn':  { ca: 'Sí, cancel·lar',                        es: 'Sí, cancelar' },

  // ── Dashboard "Avui és..." ─────────────────────────────────
  'dash.today':          { ca: 'Avui és',                               es: 'Hoy es' },
};

// ── Estat de l'idioma ────────────────────────────────────────
function getLang() {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ca' || saved === 'es') return saved;
  } catch (e) {}
  // Per defecte CA, però si el navegador és ES la fem ES
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('es')) return 'es';
  return 'ca';
}

function setLang(lang) {
  if (lang !== 'ca' && lang !== 'es') return;
  try { localStorage.setItem('lang', lang); } catch (e) {}
  window._currentLang = lang;
  document.documentElement.lang = lang;
  applyTranslations();
  // Notificar que ha canviat (pages dinàmiques poden re-renderitzar)
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

window._currentLang = getLang();

function t(key, fallback) {
  const lang = window._currentLang || 'ca';
  const entry = TRANSLATIONS[key];
  if (!entry) return fallback || key;
  return entry[lang] || entry.ca || key;
}

function applyTranslations() {
  // Text content via data-i18n="key"
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const tr = t(key);
    if (tr) el.textContent = tr;
  });
  // Placeholders via data-i18n-placeholder="key"
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const tr = t(key);
    if (tr) el.placeholder = tr;
  });
  // Aria-label via data-i18n-aria="key"
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.dataset.i18nAria;
    const tr = t(key);
    if (tr) el.setAttribute('aria-label', tr);
  });
  // Title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    const tr = t(key);
    if (tr) el.title = tr;
  });
}

// Toggle entre CA i ES
function toggleLang() {
  setLang(getLang() === 'ca' ? 'es' : 'ca');
  updateLangButton();
  closeLangMenu();
}

// Selecciona un idioma específic (des del popover)
function selectLang(lang) {
  setLang(lang);
  updateLangButton();
  closeLangMenu();
}

// Sincronitza el botó d'idioma a la sidebar (flag + label)
function updateLangButton() {
  const lang = getLang();
  const flag = document.querySelector('.lang-flag');
  const label = document.getElementById('sb-lang-current');
  if (flag) flag.textContent = lang === 'ca' ? '🇨🇦' : '🇪🇸';
  if (label) label.textContent = (lang === 'ca' ? 'Català' : 'Español');
  // Refrescar tics de la versió actual al popover
  document.querySelectorAll('.lang-pop-item').forEach(it => {
    it.classList.toggle('active', it.dataset.lang === lang);
  });
}

// ── Popover del selector d'idioma ─────────────────────────────
function openLangMenu(btn) {
  closeLangMenu();
  const pop = document.createElement('div');
  pop.id = 'lang-pop';
  pop.className = 'lang-pop';
  pop.innerHTML = `
    <button class="lang-pop-item" data-lang="ca" onclick="selectLang('ca')">
      <span class="lang-pop-flag">🇨🇦</span>
      <span class="lang-pop-name">Català</span>
      <svg class="lang-pop-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="lang-pop-item" data-lang="es" onclick="selectLang('es')">
      <span class="lang-pop-flag">🇪🇸</span>
      <span class="lang-pop-name">Español</span>
      <svg class="lang-pop-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
  `;
  // Posicionar respecte el botó (sortint per la dreta de la sidebar)
  // Ancorat pel BOTTOM perquè el botó està a baix de la sidebar i no es talli
  const r = btn.getBoundingClientRect();
  pop.style.left = (r.right + 6) + 'px';
  pop.style.bottom = (window.innerHeight - r.bottom) + 'px';
  document.body.appendChild(pop);
  // Marcar l'actiu
  pop.querySelectorAll('.lang-pop-item').forEach(it => {
    it.classList.toggle('active', it.dataset.lang === getLang());
  });
  // Tancar al fer clic fora
  setTimeout(() => {
    document.addEventListener('click', _langOutsideClick, { once: true });
  }, 50);
}
function closeLangMenu() {
  document.getElementById('lang-pop')?.remove();
}
function _langOutsideClick(e) {
  const pop = document.getElementById('lang-pop');
  if (pop && !pop.contains(e.target)) closeLangMenu();
}

// Estils del popover (injectats una sola vegada)
const _langStyle = document.createElement('style');
_langStyle.textContent = `
.lang-pop{
  position:fixed;z-index:300;
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:10px;
  padding:5px;min-width:180px;
  box-shadow:var(--shadow-lg);
  animation:langPopIn .16s cubic-bezier(.4,0,.2,1);
  transform-origin:bottom left;
}
@keyframes langPopIn{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.lang-pop-item{
  display:flex;align-items:center;gap:10px;
  padding:8px 11px;width:100%;
  border:none;background:transparent;
  color:var(--text);cursor:pointer;
  font-size:13px;font-weight:500;
  font-family:inherit;text-align:left;
  border-radius:7px;
  transition:background 120ms;
}
.lang-pop-item:hover{background:var(--bg-muted)}
.lang-pop-item.active{background:var(--primary-soft);color:var(--primary-soft-text);font-weight:600}
.lang-pop-flag{font-size:18px;flex-shrink:0;line-height:1}
.lang-pop-name{flex:1}
.lang-pop-check{width:16px;height:16px;color:var(--primary);opacity:0;flex-shrink:0}
.lang-pop-item.active .lang-pop-check{opacity:1}
`;
document.head.appendChild(_langStyle);

// Aplicar quan el DOM està carregat (i sempre que s'afegeixi contingut nou via t())
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = window._currentLang;
  applyTranslations();
  updateLangButton();
});

// Exportar global
window.t = t;
window.setLang = setLang;
window.getLang = getLang;
window.toggleLang = toggleLang;
window.selectLang = selectLang;
window.openLangMenu = openLangMenu;
window.closeLangMenu = closeLangMenu;
window.updateLangButton = updateLangButton;
window.applyTranslations = applyTranslations;
