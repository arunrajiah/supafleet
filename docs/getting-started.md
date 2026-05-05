# Getting Started

This guide walks you through installing supafleet on any Linux server — a VPS, a cloud VM (AWS EC2, Google Cloud, Hetzner, Linode, etc.), a bare-metal machine, or a local VM — and creating your first tenant database.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Ubuntu / Debian | 22.04+ | Other Linux distros work but instructions below target Ubuntu |
| Docker Engine | 24+ | Installed below |
| Docker Compose | v2 | Bundled with Docker Engine 24+ |
| Python 3 | 3.8+ | Pre-installed on Ubuntu 22.04 |
| Wildcard DNS | — | Point `*.yourdomain.com` → your server IP |

**Minimum server size:** 2 vCPU / 4 GB RAM (handles ~14 tenants).

---

## Step 1 — Install Docker

```bash
# Update package index
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (avoids needing sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version        # Docker version 24.x.x
docker compose version  # Docker Compose version v2.x.x
```

---

## Step 2 — Clone the repository

```bash
git clone https://github.com/arunrajiah/supafleet.git
cd supafleet
```

---

## Step 3 — Configure environment

```bash
cp .env.example .env
nano .env
```

At minimum, set these three values:

```dotenv
POSTGRES_PASSWORD=a-strong-random-password
JWT_SECRET=another-strong-random-string-32-chars-min
DOMAIN=yourdomain.com
```

> **Tip:** Generate secrets with `openssl rand -base64 32`

See [Configuration](configuration.md) for the full variable reference.

---

## Step 4 — Start the stack

```bash
docker compose up -d
```

This starts four shared services:

| Container | Role |
|---|---|
| `supabase-db` | PostgreSQL — all tenant databases live here |
| `supabase-nginx` | Reverse proxy — routes `<tenant>.yourdomain.com` |
| `supabase-admin` | Management UI — `http://your-server-ip` |
| `supabase-imgproxy` | Shared image transformation |

Check they're running:

```bash
docker compose ps
```

---

## Step 5 — First-time setup

Open `http://your-server-ip` in a browser. You'll see the **Setup** page — set an admin password. This password protects the management UI.

After setup, you're redirected to the **Dashboard**.

---

## Step 6 — Create your first tenant

### Via the Web UI

1. Click **New database** in the top-right
2. Enter a name (lowercase, letters/digits/hyphens, 3–30 chars) — e.g. `myapp`
3. Optionally override the site URL (defaults to `http://myapp.yourdomain.com`)
4. Click **Create** — provisioning takes 15–30 seconds

Once done, you'll see the tenant detail page with your API keys and endpoints.

### Via the CLI

```bash
./scripts/add-tenant.sh myapp
```

Both methods produce the same result.

---

## Step 7 — Connect your app

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://myapp.yourdomain.com',
  'YOUR_ANON_KEY'           // shown in the admin UI after creation
)
```

---

## Step 8 — Set up HTTPS (recommended for production)

HTTP is fine for local testing. For production, follow the [HTTPS guide](https.md).

---

## Next steps

- [Managing tenants](managing-tenants.md) — create, inspect, delete
- [Configuration reference](configuration.md) — all `.env` variables
- [Backup & restore](backup-restore.md) — protect your data
- [FAQ](faq.md) — common questions
