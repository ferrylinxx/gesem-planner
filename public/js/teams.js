// ── MICROSOFT TEAMS SDK · inicialització ─────────────────────
// S'executa quan l'app carrega dins una pestanya de Teams (i és inofensiu
// fora de Teams: si no es detecta el SDK, no fa res).
//
// Què fa:
//   1) Carrega el SDK des de CDN (cache-friendly)
//   2) Crida microsoftTeams.app.initialize() perquè Teams sàpiga que la
//      pestanya ha carregat correctament i pugui mostrar-la
//   3) Aplica subtils ajustos visuals quan corre dins Teams
//
// Sense això, Teams mostra una pantalla en blanc + timeout de càrrega.
(function loadTeamsSDK() {
  // Heurística: estem en un iframe + ref sembla d'office/teams?
  const inIframe = window !== window.top;
  const ref = document.referrer || '';
  const looksLikeTeams = /teams\.microsoft\.com|office\.com|officeapps\.live|sharepoint\.com|skype\.com/i.test(ref);

  if (!inIframe && !looksLikeTeams) return; // ni en iframe ni de Teams → no cal

  const script = document.createElement('script');
  script.src = 'https://res.cdn.office.net/teams-js/2.34.0/js/MicrosoftTeams.min.js';
  script.async = true;
  script.onload = function () {
    try {
      const Teams = window.microsoftTeams;
      if (!Teams || !Teams.app) return;
      Teams.app.initialize().then(function () {
        document.documentElement.classList.add('in-teams');
        // Notifica que la càrrega ha anat bé
        if (Teams.app.notifySuccess) Teams.app.notifySuccess();
      }).catch(function (e) {
        console.warn('[Teams SDK] init failed:', e);
      });
    } catch (e) {
      console.warn('[Teams SDK] runtime error:', e);
    }
  };
  script.onerror = function () {
    console.warn('[Teams SDK] no s\'ha pogut carregar des de CDN');
  };
  document.head.appendChild(script);
})();
