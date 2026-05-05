# Architecture

A deep dive into how supafleet works internally.

---

## Overview

```
Internet
    │
    ▼
supabase-nginx  (port 80/443)
    │
    ├── default vhost ──────────────────► supabase-admin:3000
    │                                       (Next.js management UI)
    │
    ├── myapp.domain.com ───────────────► rest-myapp:3000  (PostgREST)
    │   /auth/v1/  ─────────────────────► auth-myapp:9999  (GoTrue)
    │   /storage/v1/ ───────────────────► storage-myapp:5000
    │   /storage/v1/render/ ────────────► supabase-imgproxy:5001
    │
    └── client2.domain.com ─────────────► rest-client2:3000
        ...
                                           ▲        ▲        ▲
                                           └────────┴────────┘
                                                    │
                                           supabase-db:5432  (PostgreSQL)
                                           ┌──────────────────────┐
                                           │  postgres (default)  │
                                           │  tenant_myapp        │
                                           │  tenant_client2      │
                                           │  ...                 │
                                           └──────────────────────┘
```

---

## Shared infrastructure

These services run once and are shared by all tenants.

### `supabase-db` (PostgreSQL)

The single PostgreSQL instance hosts all tenant databases. Each database is isolated at the PostgreSQL database level — a connection to `tenant_myapp` cannot access `tenant_client2`.

Standard Supabase roles (`authenticator`, `anon`, `authenticated`, `service_role`, `supabase_auth_admin`, `supabase_storage_admin`, etc.) are created **once** by the `supabase/postgres` image init scripts and are available to all databases. Per-database configuration (JWT secret, extensions, schemas) is applied by `scripts/init-tenant.sql` during tenant provisioning.

### `supabase-nginx`

Routes inbound requests to the correct tenant containers using subdomain matching. Configuration is split:

- `nginx/nginx.conf` — main config, Docker DNS resolver (`127.0.0.11`), default vhost
- `nginx/conf.d/<name>.conf` — per-tenant config, added dynamically

**Dynamic upstream resolution:** Nginx uses the Docker embedded DNS resolver with `set $upstream http://rest-<name>:3000` pattern. This defers DNS resolution to request time so Nginx starts successfully even when tenant containers don't yet exist.

### `supabase-admin`

Next.js 14 (App Router) management UI. Runs inside Docker with:
- The Docker socket mounted (`/var/run/docker.sock`) — allows managing tenant containers via the Docker API
- The project directory mounted as `/project` — allows reading/writing tenant config files

In addition to provisioning and deleting tenants, the admin UI exposes a **container management** panel on each tenant's detail page:

- **Restart all / restart single service** — issues a Docker `restart` signal to one or all three containers in-place (no image change, typically completes in a few seconds)
- **Upgrade** — force-pulls the image tags defined in `versions.json`, then stops and recreates the containers with the new images; the database and storage files are untouched

### `supabase-imgproxy`

Shared image transformation service. All tenants' Storage APIs proxy image transformation requests to this single instance.

---

## Per-tenant services

For each tenant, three containers are created and joined to `supabase-net`:

| Container | Image | Port | Role |
|---|---|---|---|
| `auth-<name>` | `supabase/gotrue` | 9999 | Auth (signup, login, JWT issuance) |
| `rest-<name>` | `postgrest/postgrest` | 3000 | Auto-generated REST API from DB schema |
| `storage-<name>` | `supabase/storage-api` | 5000 | File storage (local filesystem) |

All three connect to the same PostgreSQL instance but to an isolated database.

---

## JWT isolation

Each tenant has a unique random JWT secret (`TENANT_JWT_SECRET`). The `ANON_KEY` and `SERVICE_ROLE_KEY` are 20-year JWTs signed with that secret.

Because secrets are per-tenant, a compromised anon key for one tenant cannot be used to authenticate against another tenant's database.

```
Tenant A secret: abc...   →  anon key A   (valid only for auth-A / rest-A)
Tenant B secret: xyz...   →  anon key B   (valid only for auth-B / rest-B)
```

---

## Admin UI — host path resolution

When the admin UI creates a Storage container for a new tenant, Docker needs **host-side paths** for volume binds — not container-side paths. The admin container resolves this by self-inspecting its own mounts:

```typescript
// admin/src/lib/docker.ts
export async function resolveHostPath(containerPath: string): Promise<string> {
  const info = await docker.getContainer('supabase-admin').inspect()
  const mount = info.Mounts.find((m) => m.Destination === '/project')
  if (mount?.Source) {
    return containerPath.replace('/project', mount.Source)
  }
  return containerPath
}
```

This works regardless of where the project is cloned on the host.

---

## Tenant provisioning flow

When a tenant is created (UI or CLI), the following steps happen in order:

```
1. Validate name (regex /^[a-z][a-z0-9-]{2,29}$/)
2. Generate secrets
   ├── TENANT_JWT_SECRET (openssl rand)
   ├── TENANT_ANON_KEY   (HS256 JWT, role=anon, exp=20y)
   ├── TENANT_SERVICE_ROLE_KEY (HS256 JWT, role=service_role, exp=20y)
   └── TENANT_S3_KEY / TENANT_S3_SECRET (random hex)
3. Create PostgreSQL database (CREATE DATABASE tenant_<name>)
4. Run init-tenant.sql
   ├── Create extensions schema, graphql_public, _realtime schemas
   ├── Create supabase_realtime publication
   ├── Create supabase_functions schema + tables
   ├── Set public schema grants
   ├── Create pgbouncer.get_auth() function
   └── Set app.settings.jwt_secret on the database
5. Create storage directory (volumes/storage/<name>/)
6. Save config.json (tenants/<name>/config.json)
7. Start Docker containers (auth, rest, storage)
   └── Pull images if not already cached
8. Write nginx config (nginx/conf.d/<name>.conf)
9. Reload nginx (docker exec supabase-nginx nginx -s reload)
```

---

## Network

All containers join the `supabase-net` Docker bridge network. This gives them internal DNS resolution using container names (e.g. `db`, `rest-myapp`, `supabase-imgproxy`).

The network is declared as `external: false` (managed by Compose) and named `supafleet_supabase-net` by Docker.

---

## Security hardening

### Login rate limiting

The `POST /api/auth/login` endpoint is protected by an in-memory sliding-window rate limiter (`admin/src/lib/rate-limit.ts`):

- **Threshold:** 5 failed attempts within any rolling 15-minute window, tracked per source IP
- **Response:** HTTP 429 with a `Retry-After` header indicating seconds until the oldest blocking attempt expires
- **Pre-flight check:** blocked IPs are rejected before bcrypt runs, preventing CPU exhaustion from repeated attempts
- **Auto-clear:** the counter resets on successful login so legitimate users who previously mistyped their password aren't penalised
- **Storage:** module-level `Map` — no Redis required; resets on process restart

### HTTP security headers

Every response from nginx carries a standard set of security headers. They are defined in `nginx/nginx.conf` (admin vhost) and injected into every generated tenant config by `admin/src/lib/nginx.ts`.

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` (admin) / `DENY` (tenants) | Clickjacking protection |
| `X-XSS-Protection` | `1; mode=block` | Legacy browser XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | camera, mic, geolocation blocked | Disable unused browser APIs |
| `Content-Security-Policy` | `self` + `unsafe-inline` (admin) / `default-src 'none'` (tenants) | Restrict resource origins |

`server_tokens off` is also set globally so nginx's version is not advertised in `Server` headers or error pages.

---

## Data persistence

| Data | Persisted via | Survives `docker compose down`? |
|---|---|---|
| PostgreSQL data | `./volumes/db/data:/var/lib/postgresql/data` | ✅ Yes |
| Storage files | `./volumes/storage/<name>` | ✅ Yes |
| Tenant config | `./tenants/<name>/config.json` | ✅ Yes |
| Admin state | `./.multidb/state.json` | ✅ Yes |
| Tenant containers | Docker containers (recreated by Compose) | ❌ Recreated |
