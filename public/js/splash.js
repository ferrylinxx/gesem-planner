// ── SPLASH SCREEN · 2 segons al primer accés ──────────────────
// Mostra una pantalla de presentació amb el logo GESEM la primera vegada
// que l'usuari obre l'app en una sessió. No es repeteix en cada navegació
// dins de l'app (sessionStorage), per no fer-se pesat.
//
// Durada: ~2.2s total (incloent fade in + fade out)
// Si l'usuari refresca la pestanya, es torna a mostrar.
// Si navega entre pàgines de l'app (peticio → gestio), NO es mostra.

(function splash() {
  // Saltar si ja s'ha mostrat aquesta sessió o estem a /login, /maintenance,
  // /r/:token (resposta formador) o dins de Teams (millor sense splash)
  try {
    if (sessionStorage.getItem('gesem.splashShown') === '1') return;
    const p = window.location.pathname;
    if (p === '/login' || p === '/maintenance' || p.startsWith('/r/')) return;
    // Si estem dins d'un iframe (Teams), saltem el splash per millor UX
    if (window.self !== window.top) return;
  } catch (e) { /* sessionStorage pot fallar en privat — segueix igual */ }

  // Marcar com a mostrat de seguida perquè redireccions no el repeteixin
  try { sessionStorage.setItem('gesem.splashShown', '1'); } catch (e) {}

  // Injectar CSS
  const style = document.createElement('style');
  style.id = 'gesem-splash-style';
  style.textContent = `
    #gesem-splash {
      position: fixed; inset: 0; z-index: 99999;
      background: linear-gradient(135deg, #ECFDF5 0%, #FAFAF7 50%, #F0FDF4 100%);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column;
      overflow: hidden;
      animation: splashEnter 0.35s ease-out;
    }
    #gesem-splash.out { animation: splashExit 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }

    @keyframes splashEnter {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes splashExit {
      0%   { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.04); visibility: hidden; }
    }

    /* Blobs decoratius animats */
    #gesem-splash::before,
    #gesem-splash::after {
      content: ''; position: absolute; border-radius: 50%;
      filter: blur(70px); opacity: 0.5; pointer-events: none;
    }
    #gesem-splash::before {
      width: 480px; height: 480px; background: #A7F3D0;
      top: -120px; left: -100px;
      animation: splashFloat1 6s ease-in-out infinite;
    }
    #gesem-splash::after {
      width: 380px; height: 380px; background: #34D399;
      bottom: -100px; right: -80px;
      animation: splashFloat2 7s ease-in-out infinite;
    }
    @keyframes splashFloat1 {
      0%,100% { transform: translate(0,0); }
      50%     { transform: translate(30px, 40px); }
    }
    @keyframes splashFloat2 {
      0%,100% { transform: translate(0,0); }
      50%     { transform: translate(-30px, -40px); }
    }

    .gs-logo-wrap {
      position: relative; z-index: 1;
      animation: gsLogoIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both;
    }
    @keyframes gsLogoIn {
      0%   { opacity: 0; transform: scale(0.7) translateY(20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    .gs-logo-box {
      width: 96px; height: 96px;
      background: linear-gradient(135deg, #ECFDF5, #D1FAE5);
      border-radius: 24px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 22px;
      box-shadow: 0 10px 32px rgba(5, 150, 105, 0.18),
                  0 2px 6px rgba(5, 150, 105, 0.08);
    }
    .gs-logo-box svg {
      animation: gsLogoPulse 2s ease-in-out infinite;
    }
    @keyframes gsLogoPulse {
      0%,100% { transform: scale(1); }
      50%     { transform: scale(1.06); }
    }

    .gs-brand {
      position: relative; z-index: 1; text-align: center;
      animation: gsTextIn 0.6s ease-out 0.25s both;
    }
    @keyframes gsTextIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .gs-brand-name {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 28px; font-weight: 700;
      letter-spacing: -0.02em; color: #18181B;
      margin-bottom: 6px;
    }
    .gs-brand-name span { color: #059669; }
    .gs-brand-sub {
      font-family: 'Inter', sans-serif;
      font-size: 13px; color: #71717A; font-weight: 500;
      letter-spacing: 0.01em;
    }

    /* Loading bar minimalista a sota */
    .gs-loader {
      position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%);
      width: 180px; height: 2.5px;
      background: rgba(5, 150, 105, 0.12);
      border-radius: 2px; overflow: hidden;
      z-index: 1;
      animation: gsTextIn 0.6s ease-out 0.4s both;
    }
    .gs-loader::before {
      content: ''; display: block;
      height: 100%; width: 30%;
      background: linear-gradient(90deg, transparent, #059669, transparent);
      animation: gsLoaderSlide 1.4s ease-in-out infinite;
    }
    @keyframes gsLoaderSlide {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }

    /* No-scroll mentre el splash està visible */
    html.gs-splash-on, body.gs-splash-on { overflow: hidden !important; }

    /* En mode fosc · gradient diferent */
    html.dark #gesem-splash {
      background: linear-gradient(135deg, #0a1a13 0%, #111827 50%, #0c1f17 100%);
    }
    html.dark .gs-brand-name { color: #F4F4F5; }
    html.dark .gs-brand-sub { color: #A1A1AA; }
    html.dark .gs-logo-box {
      background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08));
      box-shadow: 0 10px 32px rgba(0,0,0,0.4);
    }
  `;
  document.head.appendChild(style);

  // Injectar HTML
  const splash = document.createElement('div');
  splash.id = 'gesem-splash';
  splash.setAttribute('aria-hidden', 'true');
  splash.innerHTML = `
    <div class="gs-logo-wrap">
      <div class="gs-logo-box">
        <svg width="58" height="58" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="14" width="36" height="10" rx="2" fill="#A7F3D0" transform="rotate(-4 26 19)"/>
          <rect x="10" y="22" width="36" height="10" rx="2" fill="#34D399"/>
          <rect x="12" y="32" width="36" height="10" rx="2" fill="#059669" transform="rotate(3 30 37)"/>
        </svg>
      </div>
      <div class="gs-brand">
        <div class="gs-brand-name">GESEM <span>Planner</span></div>
        <div class="gs-brand-sub">Gestió de reserves de formació</div>
      </div>
    </div>
    <div class="gs-loader" aria-hidden="true"></div>
  `;

  // Afegir-ho el més aviat possible (incloent abans del DOM ready si cal)
  const insert = () => {
    if (document.body) {
      document.body.appendChild(splash);
      document.documentElement.classList.add('gs-splash-on');
      document.body.classList.add('gs-splash-on');
    } else {
      // DOM encara no llest, reintenta al pròxim tick
      requestAnimationFrame(insert);
    }
  };
  insert();

  // Esborrar després de 2s · fade out 0.5s · destrucció total
  setTimeout(() => {
    if (!splash.parentNode) return;
    splash.classList.add('out');
    splash.addEventListener('animationend', () => {
      try {
        splash.remove();
        style.remove();
        document.documentElement.classList.remove('gs-splash-on');
        document.body.classList.remove('gs-splash-on');
      } catch (e) {}
    }, { once: true });
  }, 2000);
})();
