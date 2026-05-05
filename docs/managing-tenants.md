# Managing Tenants

A **tenant** is a fully isolated Supabase-compatible project: its own PostgreSQL database, JWT secret, PostgREST, GoTrue (Auth), and Storage API containers.

---

## Creating a tenant

### Web UI

1. Log in to the admin UI (`http://your-server-ip`)
2. Click **New database**
3. Fill in:
   - **Name** — lowercase, letters/digits/hyphens, 3–30 characters (e.g. `myapp`, `client-acme`)
   - **Site URL** *(optional)* — overrides the default `http://<name>.<DOMAIN>`
4. Click **Create**

Provisioning takes 15–30 seconds. You'll be redirected to the tenant detail page.

### CLI

```bash
# With default URL (http://myapp.yourdomain.com)
./scripts/add-tenant.sh myapp

# With a custom URL
./scripts/add-tenant.sh myapp https://myapp.yourdomain.com
```

---

## Viewing tenant details

### Web UI

Click any tenant on the dashboard. The detail page shows:

- **Services** — live status tiles for `auth`, `rest`, and `storage` containers, including the running image version tag.  The **Actions** panel below lets you restart individual services or upgrade all containers to the latest images.
- **API endpoints** — REST, Auth, Storage, and GraphQL URLs
- **Anon key** — public key for browser/mobile clients
- **Service role key** — privileged key for server-side code (keep secret)
- **Database name** — PostgreSQL database name (`tenant_<name>`)
- **Quick start** — copy-ready `createClient` snippet

### CLI

```bash
# List all tenants with container status
./scripts/list-tenants.sh
```

Example output:
```
TENANT               rest            auth            storage         SITE_URL
------               ----            ----            -------         --------
myapp                running         running         running         https://myapp.example.com
client-acme          running         running         running         https://client-acme.example.com
```

### API

```bash
# Get tenant config + container status
curl -s http://your-server-ip/api/tenants/myapp \
  -H "Cookie: smdb_session=<token>"
```

---

## Connecting your app

Each tenant exposes a standard Supabase-compatible API surface:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://myapp.yourdomain.com',   // API URL
  'YOUR_ANON_KEY'                   // Anon key from the admin UI
)
```

| Endpoint | Path |
|---|---|
| REST API (PostgREST) | `/rest/v1/` |
| Auth (GoTrue) | `/auth/v1/` |
| Storage | `/storage/v1/` |
| GraphQL | `/graphql/v1` |

---

## Deleting a tenant

> ⚠️ Container and nginx removal is immediate. Database/storage deletion is irreversible.

### Web UI

1. Open the tenant detail page
2. Click **Delete tenant**
3. In the confirmation modal, type the tenant name exactly
4. Optionally check **"Also delete database and all storage files"**
5. Click **Delete**

### CLI

```bash
# Remove containers and nginx config, keep the database (safe)
./scripts/remove-tenant.sh myapp

# Remove everything including the database and storage files (irreversible)
./scripts/remove-tenant.sh myapp --drop-db
```

When `--drop-db` is **not** passed, the PostgreSQL database (`tenant_myapp`) is left intact — useful if you want to re-provision the tenant later or migrate the data.

---

## Restarting tenant containers

Containers restart automatically on crash (`restart: unless-stopped`). To manually restart:

### Web UI

1. Open the tenant detail page
2. Scroll to the **Services** section — the **Actions** panel is below the status tiles
3. Choose one of:
   - **Restart all** — restarts the `auth`, `rest`, and `storage` containers in one click.  
     The button is highlighted amber when any container is not running.
   - **Restart Auth / REST / Storage** — restarts a single service without touching the others.

A spinner appears during the operation; a green ✓ confirms success. The page refreshes automatically once Docker has settled.

### CLI

```bash
docker restart auth-myapp rest-myapp storage-myapp
```

---

## Upgrading service images

When a new version of GoTrue, PostgREST, or the Storage API is released, you can upgrade a tenant's containers without touching its database or storage files.

### Web UI

1. Update the image tags in [`versions.json`](../versions.json) at the repo root (or wait for a Renovate PR to land)
2. Open the tenant detail page → **Services → Actions**
3. Click **↑ Upgrade services**

The admin UI will:
1. Force-pull the new images defined in `versions.json`
2. Stop and remove the old containers
3. Recreate them with the new images and the same credentials

Data is preserved — the PostgreSQL database and storage files are never modified during an upgrade.

### CLI (batch upgrade all tenants)

```bash
# Pull new images first
docker pull supabase/gotrue:NEW_TAG
docker pull postgrest/postgrest:NEW_TAG
docker pull supabase/storage-api:NEW_TAG

# Recreate containers for each tenant
for name in tenants/*/; do
  name=$(basename "$name")
  docker rm -f "auth-$name" "rest-$name" "storage-$name" 2>/dev/null || true
done
# Then re-provision via the UI or run add-tenant.sh for each tenant
```

> **Tip:** A safer approach for bulk upgrades is to use the UI one tenant at a time so you can verify each one before proceeding.

---

## Tenant file layout

After provisioning, the following files are created:

```
tenants/myapp/
├── config.json          # Credentials and settings (never commit this)
└── docker-compose.yml   # Tenant service stack (values baked in)

volumes/storage/myapp/   # File storage for this tenant
nginx/conf.d/myapp.conf  # Nginx subdomain routing rule
```

---

## Tenant naming rules

| Rule | Detail |
|---|---|
| Length | 3–30 characters |
| Characters | Lowercase letters, digits, hyphens only |
| Start | Must start with a letter |
| Uniqueness | Names must be globally unique on the server |

Valid examples: `myapp`, `client-acme`, `project123`

Invalid examples: `MyApp` (uppercase), `123app` (starts with digit), `a` (too short)
