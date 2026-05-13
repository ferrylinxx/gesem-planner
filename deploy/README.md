# GESEM Planner · Guia de deploy

Servidor: Ubuntu, IP `192.168.3.208`, usuari `fgarola` amb sudo.

## 1. Preparar el paquet local (Windows)

Des de PowerShell, al directori del projecte:

```powershell
# Crear ZIP sense node_modules ni data privades
Compress-Archive -Path `
  server.js, db.js, package.json, package-lock.json, `
  public, scripts, deploy, arrancar.bat, instal·lar.bat `
  -DestinationPath gesem-planner-deploy.zip -Force
```

## 2. Transferir al servidor

```powershell
# Copia el ZIP al home del servidor
scp gesem-planner-deploy.zip fgarola@192.168.3.208:~/

# Connectar per SSH
ssh fgarola@192.168.3.208
```

## 3. Al servidor (sessió SSH)

```bash
# Descomprimir
mkdir -p ~/gesem-planner-deploy
cd ~/gesem-planner-deploy
unzip -o ~/gesem-planner-deploy.zip

# Executar el setup automàtic
bash deploy/setup-server.sh
```

El script s'ocupa de tot:
- Instal·la Node.js 22 LTS
- Crea `/opt/gesem-planner/`
- Instal·la dependències npm
- Migra JSON → SQLite si cal
- Configura systemd (auto-start)
- Programa el backup diari a les 03:00
- Obre port 3000 al firewall

## 4. Verificar

```bash
sudo systemctl status gesem-planner
curl http://localhost:3000/api/agents
```

Des d'un altre PC de la xarxa: **http://192.168.3.208:3000**

## 5. Comandes útils

| Què | Comanda |
|-----|---------|
| Estat del servei | `sudo systemctl status gesem-planner` |
| Logs en viu | `sudo journalctl -u gesem-planner -f` |
| Reiniciar | `sudo systemctl restart gesem-planner` |
| Aturar | `sudo systemctl stop gesem-planner` |
| Tornar arrencar | `sudo systemctl start gesem-planner` |
| Backup manual | `cd /opt/gesem-planner && node scripts/backup.js` |

## 6. Actualitzar (futur)

Quan facis canvis al codi:

```powershell
# Local: rebuild ZIP
Compress-Archive -Path server.js, public, scripts -DestinationPath gesem-update.zip -Force
scp gesem-update.zip fgarola@192.168.3.208:~/
```

```bash
# Servidor: aplicar canvis
ssh fgarola@192.168.3.208
unzip -o ~/gesem-update.zip -d /opt/gesem-planner/
sudo systemctl restart gesem-planner
```

## Seguretat

- ✋ **Canvia la contrasenya SSH** un cop el deploy estigui fet
- ✋ **Genera SSH keys** per evitar contrasenya cada cop
- ⚠️ Sense HTTPS, no exposis el port 3000 a Internet
- ⚠️ Sense auth, qualsevol a la LAN pot llegir/modificar reserves
