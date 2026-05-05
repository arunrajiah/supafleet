# Frequently Asked Questions

---

## General

### Is this affiliated with Supabase, Inc.?

No. supafleet is an independent community project. Supabase is a trademark of Supabase, Inc. This project uses Supabase's open-source components (licensed under Apache 2.0) but is not endorsed or supported by Supabase.

### How is supafleet different from the official Supabase self-hosted setup?

The official setup gives you **one** project per server. supafleet runs **many isolated projects** on a single server, each with its own database, auth, and storage — all managed from a single web UI.

### What does "isolated" mean exactly?

Each tenant has:
- A **separate PostgreSQL database** — queries in one tenant cannot access another's data
- Its **own JWT secret** — tokens issued for one tenant cannot authenticate against another
- **Separate containers** for Auth, REST, and Storage
- **Separate file storage** directory

The shared PostgreSQL instance is the only resource that isn't completely isolated, but databases inside Postgres are fully separated.

### Can I use the Supabase client library with supafleet?

Yes. Each tenant exposes the same API surface as official Supabase:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://myapp.yourdomain.com', 'YOUR_ANON_KEY')
```

All standard Supabase features work: auth, database queries, storage, realtime (if enabled).

---

## Deployment

### What's the minimum server size?

A **2 vCPU / 4 GB RAM** server comfortably handles ~14 tenants.

| Server | RAM | ~Max tenants |
|---|---|---|
| 2 vCPU / 2 GB | 2 GB | ~6 |
| 2 vCPU / 4 GB | 4 GB | ~14 |
| 4 vCPU / 8 GB | 8 GB | ~30 |

Each tenant uses ~250 MB RAM. Shared services use ~300 MB base.

### Can I run supafleet on a Raspberry Pi or ARM server?

Yes, if the Docker images support ARM. Most Supabase images publish `linux/arm64` manifests. Check the image tags in `versions.json` against Docker Hub if you encounter issues.

### Can I use supafleet without a domain name?

Yes, for local development or testing. Set `DOMAIN=localhost` and access tenants at `http://<name>.localhost`. Some browsers resolve `*.localhost` to `127.0.0.1` natively; others may need `/etc/hosts` entries.

---

## Tenants

### How many tenants can I have?

There's no hard limit. The practical limit is your server's RAM and CPU. See the capacity table above.

### Can two tenants share a database?

No. Each tenant gets its own database. This is by design for isolation.

### What happens to a tenant's database if I delete the tenant?

By default, deleting a tenant **keeps** the PostgreSQL database. The containers and nginx config are removed, but `tenant_<name>` database stays intact.

To also drop the database, use `--drop-db` in the CLI or check the box in the UI. **This is irreversible.**

### Can I rename a tenant?

Not currently. The workaround is to:
1. Back up the database: `pg_dump -U postgres tenant_oldname > backup.sql`
2. Delete the old tenant (keep the database)
3. Create a new tenant with the new name
4. Restore the database into the new tenant's database

### Can I move a tenant to a different server?

Yes — see [Backup & Restore: Migrating to a new server](backup-restore.md#migrating-to-a-new-server).

---

## Security

### Is the admin UI exposed to the internet?

Yes, by default — it's the default vhost on port 80. It's protected by a password, but you should put it behind HTTPS for production. See the [HTTPS guide](https.md).

### Why does the admin container need the Docker socket?

The admin UI manages tenant containers directly via the Docker API (creating, starting, stopping, inspecting containers). This effectively grants root on the host — protect the admin UI accordingly.

### Can tenants access each other's data?

No, assuming the PostgreSQL role permissions are set up correctly (which `init-tenant.sql` does). Each tenant's database user can only access their own database.

### How do I rotate a tenant's JWT secret?

This is not yet supported in the UI. Rotating the secret invalidates all existing tokens. This feature is planned for a future release.

---

## Updates & Maintenance

### How do I upgrade Supabase component versions?

Update the image tags in `versions.json`. New tenants will use the new images. Existing containers continue running the old images until recreated.

To recreate all tenant containers:
```bash
for name in tenants/*/; do
  name=$(basename "$name")
  [[ "$name" == ".gitkeep" ]] && continue
  docker restart "auth-$name" "rest-$name" "storage-$name"
done
```

### How do I update supafleet itself?

```bash
git pull origin main
docker compose pull    # pull updated shared images
docker compose up -d   # restart updated services
```

### How do I know when upstream Supabase changes something important?

A weekly GitHub Action (`upstream-sync.yml`) checks whether the init SQL files (`volumes/db/*.sql`) have changed upstream and opens an issue if they have.

Additionally, subscribe to [supabase/supabase releases](https://github.com/supabase/supabase/releases) and [Renovate](https://docs.renovatebot.com/) bot will open PRs automatically when new Docker image tags are published.
