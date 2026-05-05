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

- **API URL** — the base URL for client libraries
- **Anon key** — public key for browser/mobile clients
- **Service role key** — privileged key for server-side code (keep secret)
- **Database name** — PostgreSQL database name (`tenant_<name>`)
- **Container status** — live status of the `auth`, `rest`, `storage` containers

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

Containers restart automatically (`restart: unless-stopped`). To manually restart:

```bash
docker restart auth-myapp rest-myapp storage-myapp
```

Or stop and start via Compose:

```bash
docker compose \
  -f tenants/myapp/docker-compose.yml \
  --project-name supabase-tenant-myapp \
  restart
```

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
