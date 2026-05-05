# Backup & Restore

> Back up regularly. The PostgreSQL database and storage files are the only state that can't be re-created automatically.

---

## What to back up

| Data | Location | Method |
|---|---|---|
| All tenant databases | PostgreSQL inside `supabase-db` container | `pg_dumpall` or per-database `pg_dump` |
| Tenant credentials / config | `tenants/*/config.json` | File copy |
| Storage files | `volumes/storage/` | File copy / rsync |
| Global config | `.env` | File copy (store securely) |

The following do **not** need to be backed up — they're regenerated automatically:

- `nginx/conf.d/*.conf` — recreated by `add-tenant.sh`
- `tenants/*/docker-compose.yml` — regenerated from `config.json`
- `.multidb/state.json` — recreated on first login

---

## Backing up databases

### Full cluster backup (all tenants at once)

```bash
docker compose exec db \
  pg_dumpall -U postgres \
  > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Single tenant backup

```bash
TENANT=myapp
docker compose exec db \
  pg_dump -U postgres tenant_${TENANT//-/_} \
  > ${TENANT}-$(date +%Y%m%d-%H%M%S).sql
```

### Compressed backup

```bash
docker compose exec db \
  pg_dump -U postgres -Fc tenant_myapp \
  > myapp-$(date +%Y%m%d).dump
```

`-Fc` produces a custom-format dump that's smaller and supports parallel restore.

---

## Backing up storage files

```bash
tar -czf storage-$(date +%Y%m%d).tar.gz volumes/storage/
```

Or with rsync to a remote server:

```bash
rsync -avz --delete volumes/storage/ user@backup-server:/backups/supafleet/storage/
```

---

## Automated daily backups

Create `/etc/cron.daily/supafleet-backup`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/supafleet"
DATE=$(date +%Y%m%d)
PROJECT_DIR="/path/to/supafleet"   # ← change this

mkdir -p "$BACKUP_DIR"

# Database
cd "$PROJECT_DIR"
docker compose exec -T db \
  pg_dumpall -U postgres \
  | gzip > "$BACKUP_DIR/db-${DATE}.sql.gz"

# Storage
tar -czf "$BACKUP_DIR/storage-${DATE}.tar.gz" volumes/storage/

# Tenant configs
tar -czf "$BACKUP_DIR/tenants-${DATE}.tar.gz" tenants/

# Keep last 14 days
find "$BACKUP_DIR" -name "*.gz" -mtime +14 -delete

echo "Backup complete: $BACKUP_DIR"
```

```bash
sudo chmod +x /etc/cron.daily/supafleet-backup
```

---

## Restoring a full cluster backup

> ⚠️ This replaces all databases. Stop tenant containers first.

```bash
# Stop all tenant containers
for dir in tenants/*/; do
  name=$(basename "$dir")
  [[ "$name" == ".gitkeep" ]] && continue
  docker compose \
    -f "$dir/docker-compose.yml" \
    --project-name "supabase-tenant-${name}" \
    down 2>/dev/null || true
done

# Restore
gunzip -c backup-20240101-120000.sql.gz | \
  docker compose exec -T db psql -U postgres

# Restart tenant containers via the admin UI or CLI
```

---

## Restoring a single tenant

```bash
# Restore to existing database (appends — drop first if needed)
docker compose exec -T db \
  psql -U postgres tenant_myapp \
  < myapp-20240101.sql

# Or restore from custom-format dump
docker compose exec -T db \
  pg_restore -U postgres -d tenant_myapp -c \
  < myapp-20240101.dump
```

To restore storage files for a single tenant:

```bash
tar -xzf storage-20240101.tar.gz volumes/storage/myapp/
```

---

## Migrating to a new server

1. On the **old server**, create a full backup:
   ```bash
   docker compose exec -T db pg_dumpall -U postgres | gzip > full-backup.sql.gz
   tar -czf tenants.tar.gz tenants/
   tar -czf storage.tar.gz volumes/storage/
   ```

2. On the **new server**, install supafleet and run `docker compose up -d db` only (don't open the browser yet).

3. Copy `.env` from the old server.

4. Restore:
   ```bash
   gunzip -c full-backup.sql.gz | docker compose exec -T db psql -U postgres
   tar -xzf tenants.tar.gz
   tar -xzf storage.tar.gz
   ```

5. Start the rest of the stack:
   ```bash
   docker compose up -d
   ```

6. Restart all tenant containers via the admin UI.
