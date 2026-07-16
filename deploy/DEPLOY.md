# Déploiement — Bulk sur server13

Convention identique aux autres apps : conteneurs Docker bindés sur `127.0.0.1`,
Caddy natif expose `bulk.cmrabdu.com` par-dessus.

## Prérequis
- DNS : `bulk.cmrabdu.com` -> IP du serveur (fait côté Infomaniak/kDrive).
- Ports `127.0.0.1:8798` (backend) et `127.0.0.1:8799` (frontend) libres.

## 1. Récupérer le code
```bash
cd ~ && git clone https://github.com/cmrabdu/bulk.git && cd bulk
```

## 2. Secrets backend (non commité)
```bash
cp backend/.env.example backend/.env
# éditer backend/.env :
#   SESSION_SECRET=$(openssl rand -hex 32)
#   APP_USERNAME=...
#   APP_PASSWORD=...
```

## 3. Build + run
```bash
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:8798/health   # -> {"status":"ok"}
```

## 4. Caddy
Insérer le contenu de `deploy/Caddyfile.bulk.snippet` dans `/etc/caddy/Caddyfile`
(après un backup), puis :
```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d-%H%M%S)
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Mettre à jour (après un push)
```bash
cd ~/bulk && git pull && docker compose up -d --build
```

## Sauvegarde DB
La base vit dans le volume `bulk-data` (`/app/data/bulk.db`). Backup :
```bash
docker compose exec backend sh -c 'cp /app/data/bulk.db /app/data/bulk.backup.db'
docker cp bulk-backend:/app/data/bulk.backup.db ~/backups/
```
