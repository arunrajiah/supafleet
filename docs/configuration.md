# Configuration Reference

All configuration is done through the `.env` file in the project root. Copy `.env.example` to `.env` before starting.

---

## Required variables

These **must** be set before running `docker compose up` for the first time.

| Variable | Example | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `s3cr3t-pg-pass` | Master password for the PostgreSQL superuser. Used by all services to connect to the database. |
| `JWT_SECRET` | `my-32-char-secret` | JWT secret for the admin/shared database. **Each tenant gets its own JWT secret** — this one is only used by shared infrastructure. Must be at least 32 characters. |
| `DOMAIN` | `example.com` | Base domain. Tenants are reachable at `<name>.$DOMAIN`. |

> **Tip:** Generate strong secrets with:
> ```bash
> openssl rand -base64 32
> ```

---

## Optional variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PORT` | `5432` | Port PostgreSQL listens on inside Docker. Change only if you have a port conflict. |
| `JWT_EXPIRY` | `3600` | JWT token TTL in seconds. Applied to all tenants. |
| `ENABLE_EMAIL_AUTOCONFIRM` | `false` | Set to `true` to skip email verification for new signups (useful in development). |

---

## SMTP variables

All tenants share a single SMTP configuration for sending auth emails (confirmations, password resets, invitations).

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | *(empty)* | SMTP server hostname. Leave empty to disable email. |
| `SMTP_PORT` | `587` | SMTP port. Common values: `587` (STARTTLS), `465` (SSL), `25` (unencrypted). |
| `SMTP_USER` | *(empty)* | SMTP username / email address. |
| `SMTP_PASS` | *(empty)* | SMTP password. |
| `SMTP_ADMIN_EMAIL` | `admin@example.com` | "From" address for outgoing auth emails. |
| `SMTP_SENDER_NAME` | `Supabase` | Display name shown in the "From" field. |

**Recommended SMTP providers:** Resend, Postmark, AWS SES, Mailgun, SendGrid.

---

## Per-tenant values (auto-generated)

These are **never set manually** — they're generated automatically when a tenant is provisioned.

| Value | Where stored | Description |
|---|---|---|
| `TENANT_JWT_SECRET` | `tenants/<name>/config.json` | Unique HS256 secret per tenant. |
| `TENANT_ANON_KEY` | `tenants/<name>/config.json` | 20-year JWT signed with the tenant secret, role `anon`. |
| `TENANT_SERVICE_ROLE_KEY` | `tenants/<name>/config.json` | 20-year JWT signed with the tenant secret, role `service_role`. |
| `TENANT_S3_KEY` / `TENANT_S3_SECRET` | `tenants/<name>/config.json` | S3-compatible keys for the storage API. |

---

## Docker image versions (`versions.json`)

All Docker image tags are centralised in `versions.json` at the project root:

```json
{
  "postgres":   "supabase/postgres:15.8.1.085",
  "gotrue":     "supabase/gotrue:v2.186.0",
  "postgrest":  "postgrest/postgrest:v14.8",
  "storage":    "supabase/storage-api:v1.48.26",
  "imgproxy":   "darthsim/imgproxy:v3.30.1",
  "nginx":      "nginx:alpine"
}
```

To upgrade a service, change the tag here. Existing running tenant containers are **not** affected until they are recreated.

[Renovate](https://docs.renovatebot.com/) is pre-configured to open automated PRs when new image versions are released.

---

## Admin UI state

The admin UI stores its state in `.multidb/state.json` (gitignored):

```json
{
  "setupComplete": true,
  "adminPasswordHash": "<bcrypt>",
  "sessionSecret": "<hex>"
}
```

This file is created automatically on first setup. Do not edit it manually. To reset the admin password, delete the file and restart the `supabase-admin` container — you'll be prompted to set a new password.
