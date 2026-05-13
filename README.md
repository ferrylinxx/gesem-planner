# GESEM Planner

Aplicació de planificació i gestió de cursos de formació professional per a **GESEM digital & SoftSkills**.

> **Stack**: Node.js + Express + better-sqlite3 + vanilla JS
> **Producció**: https://planner.gesem.es
> **Versió actual**: v29

---

## ✨ Característiques

- 📋 **Gestió de reserves** — pipeline complet de petició → confirmació → finalització
- 👥 **Catàleg de formadors** amb especialitats, ratings, disponibilitat, fotos
- 📅 **Sincronització iCal** amb calendaris de Google/Outlook (lectura)
- 🔗 **Google Calendar 2-way OAuth** — escriu events automàticament al confirmar
- 🤖 **IA integrada** (Groq · Llama 3.3 70B):
  - Parser d'emails comercials
  - Propostes intel·ligents de canvis a reserves
  - Suggeridor automàtic del formador òptim
- 📧 **SMTP amb tokens HMAC** — emails de confirmació amb botons accept/decline signats
- 🏛️ **Festius oficials** ES + CAT + BCN calculats dinàmicament (Pasqua mòbil)
- 🌙 **Mode fosc** + sistema d'idiomes CA/ES
- 💾 **Backup automàtic diari** + cache persistent de calendaris
- 🛡️ **Mode manteniment** amb pàgina dedicada

---

## 🚀 Setup local

### Requisits
- Node.js ≥ 18
- npm

### Instal·lació

```bash
git clone https://github.com/ferrylinxx/gesem-planner.git
cd gesem-planner
npm install
cp .env.example .env
# Edita .env amb les credencials reals
npm start
```

L'app estarà disponible a `http://localhost:3001`.

---

## 📂 Estructura

```
.
├── server.js                # Servidor Express + rutes API
├── db.js                    # Wrapper SQLite (better-sqlite3 + WAL)
├── lib/
│   ├── ai.js                # Groq · Llama 3.3 70B
│   ├── email.js             # nodemailer wrapper
│   ├── emailTemplates.js    # HTML templates emails
│   ├── festius.js           # Càlcul automàtic festius ES/CAT/BCN
│   ├── google.js            # Google Calendar OAuth 2.0
│   ├── ics.js               # Parser i generador iCal RFC 5545
│   └── tokens.js            # HMAC SHA-256 per respostes públiques
├── public/
│   ├── *.html               # Pàgines: peticio, gestio, canvis, formadors, entrades, admin, etc.
│   ├── css/styles.css
│   └── js/app.js            # Lògica de client (~3300 línies)
├── scripts/
│   └── backup.js            # Backup diari de gesem.db
└── deploy/                  # Documentació deploy + systemd unit
```

---

## 🔐 Variables d'entorn

Veure `.env.example`. Variables principals:

| Variable | Obligatòria | Descripció |
|---|---|---|
| `PORT` | sí | Port del servidor (default 3001) |
| `BASE_URL` | sí | URL pública (per a OAuth callbacks i emails) |
| `SMTP_*` | sí | Credencials per a enviament d'emails |
| `TOKEN_SECRET` | sí | Clau HMAC per a tokens públics |
| `GROQ_API_KEY` | recomanada | Per a les funcions d'IA |
| `GOOGLE_CLIENT_ID/SECRET` | opcional | Google Calendar 2-way sync |

---

## 🚢 Deploy

L'app es desplega a un servidor Ubuntu propi amb:
- **Nginx** com a reverse proxy + HTTPS (Let's Encrypt)
- **systemd** per a gestió del procés
- **Auto-deploy** via GitHub Actions (push a `main` → SSH al servidor)

Veure `deploy/README.md` per al setup inicial.

---

## 📜 Llicència

Propietari · ús intern de GESEM digital & SoftSkills

---

## 📝 Changelog

Veure `/changelog` dins l'app o el codi a `public/changelog.html`.
