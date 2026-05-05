# Local Development

This guide explains how to set up a development environment for working on supafleet itself.

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Node.js 20+
- Python 3.8+
- Git

---

## Repository structure

```
supafleet/
├── admin/                  # Next.js 14 management UI
│   ├── src/
│   │   ├── app/            # Pages and API routes (App Router)
│   │   │   ├── api/        # REST API handlers
│   │   │   ├── (auth)/     # Login / setup pages
│   │   │   └── tenants/    # Tenant list and detail pages
│   │   ├── components/     # Shared React components
│   │   └── lib/            # Backend logic
│   │       ├── auth.ts     # Session cookies, password hashing
│   │       ├── db.ts       # PostgreSQL queries (node-postgres)
│   │       ├── docker.ts   # Docker API client (dockerode)
│   │       ├── jwt-gen.ts  # JWT generation for tenant keys
│   │       ├── nginx.ts    # nginx config file writing
│   │       ├── state.ts    # Admin UI state file (.multidb/state.json)
│   │       └── tenant.ts   # Tenant lifecycle orchestration
│   ├── Dockerfile
│   └── package.json
├── scripts/                # CLI shell scripts
│   ├── add-tenant.sh       # Provision a new tenant
│   ├── remove-tenant.sh    # Tear down a tenant
│   ├── list-tenants.sh     # Show all tenants + container status
│   ├── gen-jwt.py          # Generate anon/service_role JWTs
│   └── init-tenant.sql     # Per-tenant DB init ({{JWT_SECRET}} placeholder)
├── volumes/db/             # PostgreSQL init SQL (mounted at startup)
│   ├── jwt.sql             # JWT settings
│   ├── roles.sql           # Supabase roles
│   ├── webhooks.sql        # Webhook tables
│   ├── logs.sql            # Logging tables
│   ├── pooler.sql          # PgBouncer auth function
│   └── realtime.sql        # Realtime publication
├── nginx/                  # Nginx config
│   ├── nginx.conf          # Main config with Docker DNS resolver
│   └── conf.d/             # Per-tenant vhost configs (auto-generated)
├── docker-compose.yml      # Shared infrastructure
├── versions.json           # Docker image tags (single source of truth)
└── .env.example            # Environment template
```

---

## Running the full stack locally

### 1. Clone and configure

```bash
git clone https://github.com/arunrajiah/supafleet.git
cd supafleet
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, DOMAIN=localhost
```

### 2. Start shared infrastructure

```bash
docker compose up -d
```

Visit `http://localhost` → complete the setup wizard.

### 3. Install admin UI dependencies

```bash
cd admin
npm install
```

### 4. Run the admin UI in dev mode

Stop the `supabase-admin` container (to free port 3000) and run Next.js directly:

```bash
docker compose stop admin

cd admin
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_PASSWORD=your-password \
DOMAIN=localhost \
PROJECT_DIR=$(dirname $PWD) \
CONTAINER_NAME=supabase-admin \
npm run dev
```

Open `http://localhost:3000`. Hot reload is enabled — changes to `src/` take effect immediately.

> **Note:** `CONTAINER_NAME=supabase-admin` is needed so the dev server can find the correct Docker container when resolving host paths for volume mounts.

---

## Admin API

All API routes are under `admin/src/app/api/`. They use Next.js Route Handlers.

### Authentication

All tenant API routes require a valid session cookie (`smdb_session`). The setup and login routes are public.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/setup` | Public | First-run: set admin password, create session |
| `POST` | `/api/auth/login` | Public | Verify password, create session cookie |
| `POST` | `/api/auth/logout` | — | Clear session cookie |
| `GET` | `/api/tenants` | Required | List all tenants |
| `POST` | `/api/tenants` | Required | Create a new tenant |
| `GET` | `/api/tenants/:name` | Required | Get tenant config + container status |
| `DELETE` | `/api/tenants/:name` | Required | Delete a tenant |

#### `POST /api/tenants`

Request body:
```json
{
  "name": "myapp",
  "siteUrl": "https://myapp.example.com"   // optional
}
```

Response `201`:
```json
{
  "name": "myapp",
  "dbName": "tenant_myapp",
  "siteUrl": "https://myapp.example.com",
  "jwtSecret": "...",
  "anonKey": "eyJ...",
  "serviceRoleKey": "eyJ...",
  "s3Key": "...",
  "s3Secret": "...",
  "createdAt": "2025-05-05T12:00:00.000Z"
}
```

#### `DELETE /api/tenants/:name`

Request body:
```json
{
  "dropDb": false   // set to true to also drop the PostgreSQL database
}
```

---

## Running tests and linters

```bash
# TypeScript type-check
cd admin && npx tsc --noEmit

# Shell script linting
shellcheck -x --severity=warning scripts/*.sh

# Validate docker-compose
cp .env.example .env
docker compose config --quiet
```

These are the same checks run by the CI workflow.

---

## Making changes to the admin UI

### Adding a new page

Create a new directory under `admin/src/app/` following the Next.js 14 App Router conventions.

For pages that need authentication:
```typescript
// admin/src/app/my-page/page.tsx
import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'

export default async function MyPage() {
  if (!(await isAuthenticated())) redirect('/login')
  // ...
}
```

### Adding a new API route

Create `admin/src/app/api/<route>/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // your logic here
  return NextResponse.json({ data: 'hello' })
}
```

### Adding a new CLI script

1. Create `scripts/my-script.sh` with `#!/usr/bin/env bash` and `set -euo pipefail`
2. It will be picked up automatically by `shellcheck scripts/*.sh` in CI

---

## Common issues

### "Cannot connect to Docker daemon"

The admin UI uses the Docker socket. Make sure you're either:
- Running inside the Docker container (production mode), **or**
- Your user has Docker socket access: `sudo usermod -aG docker $USER`

### "Project directory not found"

Set `PROJECT_DIR` to the absolute path of the repo root when running in dev mode.

### Changes to `volumes/db/` don't take effect

These SQL files are only run when PostgreSQL initialises for the first time. To apply changes to an existing instance, execute the SQL manually:

```bash
docker compose exec db psql -U postgres -f /docker-entrypoint-initdb.d/roles.sql
```

Or destroy and recreate the database volume (loses all data):

```bash
docker compose down -v
docker compose up -d
```
