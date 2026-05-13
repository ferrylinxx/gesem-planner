# Google Calendar OAuth · Setup Guide

GESEM Planner pot escriure events directament al Google Calendar de cada formador, però només si tens credencials OAuth configurades a Google Cloud Console.

## Pas 1 · Crear un projecte a Google Cloud Console

1. Vés a https://console.cloud.google.com/
2. Crea un projecte nou: "GESEM Planner" (o reutilitza un existent)
3. Selecciona el projecte des del selector superior

## Pas 2 · Activar la Google Calendar API

1. Menú lateral → **APIs & Services** → **Library**
2. Cerca "Google Calendar API"
3. Clica **Enable**

## Pas 3 · Configurar la pantalla de consentiment OAuth

1. Menú lateral → **APIs & Services** → **OAuth consent screen**
2. User Type: **External** (Internal només si tens Google Workspace)
3. Omple:
   - App name: `GESEM Planner`
   - User support email: `comunicacions@gesem.cat`
   - Developer contact: `comunicacions@gesem.cat`
4. **Scopes** → Add or remove scopes → afegeix:
   - `https://www.googleapis.com/auth/calendar.events`
5. **Test users** → afegeix els emails de tots els formadors que vulguis connectar (mentre l'app no estigui verificada per Google, només funcionarà amb test users)
6. Save

## Pas 4 · Crear les credencials OAuth Client ID

1. Menú lateral → **APIs & Services** → **Credentials**
2. **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `GESEM Planner Web`
5. **Authorized redirect URIs** → afegeix:
   ```
   http://192.168.3.208:3001/api/google/callback
   ```
   (Si tens un altre BASE_URL, ajusta-ho)
6. Create
7. Copia el **Client ID** i **Client Secret**

## Pas 5 · Afegir les variables al `.env` del servidor

SSH al servidor i edita `/srv/gesem-planner/.env`:

```bash
GOOGLE_CLIENT_ID=el_teu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=el_teu_client_secret
GOOGLE_REDIRECT_URI=http://192.168.3.208:3001/api/google/callback
```

Reinicia el servei:

```bash
sudo systemctl restart gesem-planner
```

## Pas 6 · Verificar

1. Vés a `/admin` a la web
2. Verifica que apareix "Google OAuth: configurat" a la secció IA / Integracions
3. Vés a `/formadors`, obre un formador, busca el panell "🔗 Google Calendar · 2-way sync"
4. Clica **Connectar Google Calendar** → s'obre la finestra de Google → autoritza
5. Hauria de mostrar "✅ Connectat a Google Calendar"

## Funcionament

- Quan **es confirma una reserva** d'un formador connectat, GESEM crea **un event per sessió** al seu calendari `primary`.
- Els events porten una propietat privada `gesemReservaId` per poder identificar-los i esborrar-los més tard.
- El **token d'accés** caduca cada hora però es renova automàticament amb el `refresh_token` (vàlid indefinidament fins que l'usuari no revoca el permís).
- Si Google OAuth no està configurat o el formador no està connectat, **l'app fa fallback** a la lectura iCal en mode lectura.

## Producció

Per portar l'app a producció pública (no només test users):

1. **OAuth consent screen** → **Publishing status** → **Publish App**
2. Google demanarà verificació en alguns escopes sensibles (calendar.events és no-sensitive, així que no caldria) — però llegeix les seves directrius
3. Afegeix logos, política de privacitat, termes i condicions

## Troubleshooting

- **"redirect_uri_mismatch"**: la URI a Google Cloud Console no coincideix exactament amb la del `.env`. Compte amb `http` vs `https`, ports, slashes finals.
- **"access_denied"**: si l'app no està publicada i l'usuari no és test user, Google bloqueja. Afegeix-lo a test users o publica l'app.
- **"invalid_grant"** al refresh: el refresh token s'ha invalidat (l'usuari el va revocar). Toca tornar a connectar.
