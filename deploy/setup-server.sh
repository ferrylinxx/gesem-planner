#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────
# GESEM Planner · Setup script per al servidor Ubuntu
# Executar com a fgarola (té sudo).
# Ús: bash setup-server.sh
# ───────────────────────────────────────────────────────────────────
set -e

APP_DIR="/opt/gesem-planner"
APP_USER="fgarola"
NODE_VERSION="22"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  GESEM Planner · Setup automàtic del servidor"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Instal·lar Node.js 22 (LTS) si no hi és ────────────────────
if ! command -v node &> /dev/null || [[ ! "$(node -v)" =~ ^v$NODE_VERSION ]]; then
  echo "→ Instal·lant Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "✓ Node.js $(node -v) ja instal·lat"
fi

# ── 2. Crear directori app i moure-hi els fitxers ─────────────────
echo "→ Preparant $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo chown -R $APP_USER:$APP_USER "$APP_DIR"

# Si l'usuari ha extret a ~/gesem-planner-deploy/, copiem
if [ -d "$HOME/gesem-planner-deploy" ]; then
  echo "→ Copiant fitxers des de ~/gesem-planner-deploy/..."
  cp -r "$HOME/gesem-planner-deploy/"* "$APP_DIR/"
fi

# ── 3. Instal·lar dependències npm ────────────────────────────────
echo "→ Instal·lant dependències npm..."
cd "$APP_DIR"
npm install --production --no-audit --no-fund

# ── 4. Crear directoris data/ i backups/ ──────────────────────────
mkdir -p "$APP_DIR/data" "$APP_DIR/backups"

# ── 5. Migrar JSON → SQLite (només si encara no hi ha DB) ────────
if [ ! -f "$APP_DIR/data/gesem.db" ] && [ -f "$APP_DIR/scripts/migrate.js" ]; then
  echo "→ Executant migració inicial JSON → SQLite..."
  node scripts/migrate.js || echo "  (sense JSON per migrar — la DB es crearà a la primera arrencada)"
fi

# ── 6. Instal·lar el servei systemd ────────────────────────────────
echo "→ Instal·lant servei systemd..."
sudo cp "$APP_DIR/deploy/gesem-planner.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gesem-planner

# ── 7. Configurar cron per al backup diari ────────────────────────
echo "→ Configurant backup diari (03:00)..."
( sudo crontab -u $APP_USER -l 2>/dev/null | grep -v "gesem-planner.*backup.js" ; \
  echo "0 3 * * * cd $APP_DIR && /usr/bin/node scripts/backup.js >> /var/log/gesem-backup.log 2>&1" ) \
  | sudo crontab -u $APP_USER -

# ── 8. Configurar firewall (UFW) si està actiu ────────────────────
if sudo ufw status | grep -q "Status: active"; then
  echo "→ Obrint port 3001 al firewall..."
  sudo ufw allow 3001/tcp
fi

# ── 9. Arrencar el servei ──────────────────────────────────────────
echo "→ Arrencant el servei..."
sudo systemctl restart gesem-planner
sleep 2
sudo systemctl status gesem-planner --no-pager -l | head -15

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✓ Deploy completat!"
echo ""
echo "  URL local:    http://localhost:3001"
echo "  URL xarxa:    http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "  Comandes útils:"
echo "    sudo systemctl status gesem-planner    # estat"
echo "    sudo systemctl restart gesem-planner   # reiniciar"
echo "    sudo journalctl -u gesem-planner -f    # logs en viu"
echo "    sudo systemctl stop gesem-planner      # aturar"
echo "═══════════════════════════════════════════════════════"
