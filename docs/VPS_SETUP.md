# VPS-Setup — Contabo, Ubuntu 24.04 (manuell, Schritt für Schritt)

> Jeder Schritt: erst Befehl, dann **Check** — erst weitermachen, wenn der Check passt.
> Platzhalter: `<IP>` = VPS-IP, `workout.example.com` = deine Subdomain.

## 0. Voraussetzungen

- Contabo VPS mit Ubuntu 24.04 LTS installiert (Contabo-Panel), Root-Passwort notiert.
- Eine Domain, bei der du DNS-Records setzen kannst.
- SSH-Key auf dem Mac: `ls ~/.ssh/id_ed25519.pub` — falls keiner existiert:
  `ssh-keygen -t ed25519`.

## 1. Erstzugang & Admin-User

```bash
ssh root@<IP>
apt update && apt upgrade -y
# Falls Kernel-Update dabei war:
reboot   # danach neu einloggen

adduser tuncay          # Passwort setzen, Rest leer lassen
usermod -aG sudo tuncay
```

Vom **Mac** aus:

```bash
ssh-copy-id tuncay@<IP>
ssh tuncay@<IP>
sudo whoami
```

**Check:** Login als `tuncay` ohne Passwortabfrage (Key), `sudo whoami` → `root`.
Erst dann weiter.

## 2. SSH härten

Als `tuncay` auf dem VPS:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF
sudo systemctl restart ssh
```

**Wichtig:** Aktuelle SSH-Session offen lassen! In einem **zweiten** Terminal testen:

```bash
ssh tuncay@<IP>                      # muss gehen (Key)
ssh root@<IP>                        # muss abgelehnt werden
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password tuncay@<IP>
                                     # muss "Permission denied" geben
```

**Check:** alle drei Ergebnisse wie beschrieben.

## 3. Firewall, fail2ban, Auto-Updates

```bash
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable                      # Warnung bestätigen (y)
sudo dpkg-reconfigure -plow unattended-upgrades   # "Yes" wählen
```

**Check:** `sudo ufw status verbose` zeigt deny incoming + die 3 Regeln.
`sudo systemctl status fail2ban` → active. Neues Terminal: SSH-Login geht noch.

> Hinweis: Docker umgeht ufw für explizit gemappte Ports. In unserem Compose mappt nur
> Caddy 80/443 — genau die sind eh offen. Die API mappt keinen Port nach außen.

## 4. Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker tuncay
exit
```

Neu einloggen (`ssh tuncay@<IP>`), dann:

**Check:** `docker ps` läuft ohne sudo · `docker compose version` zeigt v2.x.

## 5. DNS

Beim DNS-Anbieter: **A-Record** `workout` → `<IP>` (TTL egal, 300–3600).

**Check (vom Mac):**

```bash
dig +short workout.example.com
```

→ muss `<IP>` liefern. Erst weitermachen, wenn das stimmt — sonst schlägt Caddys
TLS-Zertifikat fehl.

## 6. Deploy-Struktur & Repo

```bash
sudo mkdir -p /opt/workout
sudo chown tuncay:tuncay /opt/workout
cd /opt/workout
git clone <REPO-URL> app
mkdir -p data backups frontend-dist
cp app/deploy/compose.yml .
cp app/deploy/Caddyfile .
```

`Caddyfile` editieren: `workout.example.com` durch echte Domain ersetzen.

`.env` anlegen:

```bash
cp app/deploy/.env.example .env
chmod 600 .env
```

Dann `.env` befüllen:

```
NODE_ENV=production
DATABASE_PATH=/data/app.db
SESSION_SECRET=<openssl rand -hex 32>
GEMINI_API_KEY=<dein Key>
SEED_USER1_NAME=tuncay
SEED_USER1_PASSWORD=<Passwort 1>
SEED_USER2_NAME=Kim
SEED_USER2_PASSWORD=<Passwort 2>
SEED_USER3_NAME=Noam
SEED_USER3_PASSWORD=<Passwort 3>
```

Weitere Nutzer: `SEED_USER4_NAME`/`SEED_USER4_PASSWORD` usw. anhängen — das Seed-Skript
liest fortlaufend, bis eine Nummer fehlt.

**Check:** `ls -la /opt/workout` zeigt compose.yml, Caddyfile, .env (Rechte `-rw-------`),
data/, backups/, frontend-dist/, app/.

## 7. Erststart

```bash
cd /opt/workout
./app/deploy/deploy.sh          # baut Frontend, startet Container
docker compose ps               # beide Container "running"
docker compose logs caddy       # "certificate obtained" für die Domain
docker compose exec api node seed.js    # Nutzer anlegen (einmalig)
```

**Check (vom Mac):**

```bash
curl -I https://workout.example.com          # 200, gültiges TLS
curl https://workout.example.com/api/healthz # {"ok":true}
```

Browser: Login mit Seed-Credentials → funktioniert.
iPhone: Safari → Seite öffnen → Teilen → „Zum Home-Bildschirm".

## 8. Backups

```bash
sudo apt install -y sqlite3
crontab -e
```

Zeile hinzufügen (täglich 03:30):

```
30 3 * * * sqlite3 /opt/workout/data/app.db ".backup /opt/workout/backups/app-$(date +\%F).db" && find /opt/workout/backups -name 'app-*.db' -mtime +30 -delete
```

**Check:** Cron-Zeile einmal manuell als Befehl ausführen → Backup-Datei existiert.
**Restore-Test einmal durchspielen:**

```bash
sqlite3 /opt/workout/backups/app-<datum>.db "SELECT count(*) FROM users;"   # → 2
```

Optional später: `backups/` per rclone/restic extern sichern.

## 9. Updates deployen

```bash
cd /opt/workout/app && git pull && ./deploy/deploy.sh
```

Sessions bleiben erhalten (auth_sessions in SQLite), niemand wird ausgeloggt.

## 10. Troubleshooting

| Symptom | Ursache / Fix |
|---|---|
| Caddy-Log: TLS/ACME-Fehler | DNS zeigt nicht auf `<IP>` (`dig` prüfen) oder Port 80/443 zu (`sudo ufw status`). Nach Fix: `docker compose restart caddy`. |
| 502 auf `/api/*` | API-Container down: `docker compose logs api`. Meist ENV-Fehler in `.env`. |
| Login geht nicht | Seed gelaufen? `docker compose exec api node seed.js`. |
| Auswertung immer „failed" | `GEMINI_API_KEY` in `.env` prüfen, dann `docker compose up -d api` (ENV neu laden). |
| Platte voll | alte Backups/Docker-Images: `docker system prune -a`, `du -sh /opt/workout/backups`. |
| Ausgesperrt (SSH) | Contabo-Panel → VNC-Konsole, dort `99-hardening.conf` prüfen/entschärfen. |
