#!/usr/bin/env bash
# add-tenant.sh — provision a new Supabase tenant on this droplet
#
# Usage: ./scripts/add-tenant.sh <tenant-name> [site-url]
#   tenant-name : lowercase, letters/digits/hyphens, 3-30 chars
#   site-url    : optional override (default: http://<name>.<DOMAIN>)
#
# Creates:
#   tenants/<name>/docker-compose.yml  — PostgREST + Auth + Storage stack
#   tenants/<name>/.env                — tenant credentials
#   nginx/conf.d/<name>.conf           — subdomain routing rule
#   volumes/storage/<name>/            — file storage directory
#   PostgreSQL database: tenant_<name> (hyphens → underscores)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Load global env ──────────────────────────────────────────────────────────
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "Error: $PROJECT_DIR/.env not found. Copy .env.example to .env first."
  exit 1
fi
set -a; source "$PROJECT_DIR/.env"; set +a

# ── Args ─────────────────────────────────────────────────────────────────────
TENANT_NAME="${1:-}"
if [[ -z "$TENANT_NAME" ]]; then
  echo "Usage: $0 <tenant-name> [site-url]"
  exit 1
fi

if ! [[ "$TENANT_NAME" =~ ^[a-z][a-z0-9-]{2,29}$ ]]; then
  echo "Error: tenant-name must be 3–30 chars, start with a letter, lowercase alphanumeric/hyphens only."
  exit 1
fi

TENANT_DB="tenant_${TENANT_NAME//-/_}"
TENANT_DIR="$PROJECT_DIR/tenants/$TENANT_NAME"
SITE_URL="${2:-http://${TENANT_NAME}.${DOMAIN:-localhost}}"

if [[ -d "$TENANT_DIR" ]]; then
  echo "Error: tenant '$TENANT_NAME' already exists at $TENANT_DIR"
  exit 1
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║  Provisioning tenant: $TENANT_NAME"
echo "║  Database:   $TENANT_DB"
echo "║  URL:        $SITE_URL"
echo "╚══════════════════════════════════════════════════╝"

# ── Generate secrets ─────────────────────────────────────────────────────────
TENANT_JWT_SECRET=$(openssl rand -base64 40 | tr -d '\n/+=')
TENANT_ANON_KEY=$(python3 "$SCRIPT_DIR/gen-jwt.py" "$TENANT_JWT_SECRET" anon)
TENANT_SERVICE_ROLE_KEY=$(python3 "$SCRIPT_DIR/gen-jwt.py" "$TENANT_JWT_SECRET" service_role)
TENANT_S3_KEY=$(openssl rand -hex 16)
TENANT_S3_SECRET=$(openssl rand -hex 32)

PG_PASS="${POSTGRES_PASSWORD}"
JWT_EXP="${JWT_EXPIRY:-3600}"
SMTP_HOST_VAL="${SMTP_HOST:-}"
SMTP_PORT_VAL="${SMTP_PORT:-587}"
SMTP_USER_VAL="${SMTP_USER:-}"
SMTP_PASS_VAL="${SMTP_PASS:-}"
SMTP_SENDER="${SMTP_SENDER_NAME:-$TENANT_NAME}"
EMAIL_AUTOCONFIRM="${ENABLE_EMAIL_AUTOCONFIRM:-false}"
SMTP_ADMIN="${SMTP_ADMIN_EMAIL:-admin@example.com}"

# ── Create PostgreSQL database ────────────────────────────────────────────────
echo "[1/5] Creating database '$TENANT_DB'..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T db \
  psql -U postgres -c "CREATE DATABASE \"$TENANT_DB\";"

# ── Init tenant DB schemas ────────────────────────────────────────────────────
echo "[2/5] Initialising schemas..."
sed \
  -e "s|{{JWT_SECRET}}|$TENANT_JWT_SECRET|g" \
  -e "s|{{JWT_EXP}}|$JWT_EXP|g" \
  "$SCRIPT_DIR/init-tenant.sql" | \
  docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T db \
  psql -U postgres -d "$TENANT_DB"

# ── Create storage directory ──────────────────────────────────────────────────
echo "[3/5] Creating storage directory..."
mkdir -p "$PROJECT_DIR/volumes/storage/$TENANT_NAME"

# ── Generate tenant docker-compose ───────────────────────────────────────────
echo "[4/5] Generating configuration..."
mkdir -p "$TENANT_DIR"

# Credentials file
cat > "$TENANT_DIR/.env" << ENVEOF
TENANT_NAME=$TENANT_NAME
TENANT_DB=$TENANT_DB
TENANT_JWT_SECRET=$TENANT_JWT_SECRET
TENANT_ANON_KEY=$TENANT_ANON_KEY
TENANT_SERVICE_ROLE_KEY=$TENANT_SERVICE_ROLE_KEY
TENANT_S3_KEY=$TENANT_S3_KEY
TENANT_S3_SECRET=$TENANT_S3_SECRET
SITE_URL=$SITE_URL
ENVEOF

# Docker Compose stack for this tenant (all values baked in)
cat > "$TENANT_DIR/docker-compose.yml" << COMPOSEEOF
name: supabase-tenant-${TENANT_NAME}

x-restart: &restart
  restart: unless-stopped

services:

  auth:
    container_name: auth-${TENANT_NAME}
    image: supabase/gotrue:v2.186.0
    <<: *restart
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9999/health"]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: ${SITE_URL}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${PG_PASS}@db:5432/${TENANT_DB}
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_URI_ALLOW_LIST: ""
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: ${JWT_EXP}
      GOTRUE_JWT_SECRET: ${TENANT_JWT_SECRET}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "${EMAIL_AUTOCONFIRM}"
      GOTRUE_SMTP_ADMIN_EMAIL: ${SMTP_ADMIN}
      GOTRUE_SMTP_HOST: ${SMTP_HOST_VAL}
      GOTRUE_SMTP_PORT: ${SMTP_PORT_VAL}
      GOTRUE_SMTP_USER: ${SMTP_USER_VAL}
      GOTRUE_SMTP_PASS: ${SMTP_PASS_VAL}
      GOTRUE_SMTP_SENDER_NAME: ${SMTP_SENDER}
      GOTRUE_MAILER_URLPATHS_INVITE: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_RECOVERY: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: /auth/v1/verify
      GOTRUE_EXTERNAL_PHONE_ENABLED: "false"
      GOTRUE_SMS_AUTOCONFIRM: "true"
    networks:
      - supabase-net

  rest:
    container_name: rest-${TENANT_NAME}
    image: postgrest/postgrest:v14.8
    <<: *restart
    depends_on:
      auth:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${PG_PASS}@db:5432/${TENANT_DB}
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${TENANT_JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: ${TENANT_JWT_SECRET}
      PGRST_APP_SETTINGS_JWT_EXP: ${JWT_EXP}
    command: ["postgrest"]
    networks:
      - supabase-net

  storage:
    container_name: storage-${TENANT_NAME}
    image: supabase/storage-api:v1.48.26
    <<: *restart
    depends_on:
      auth:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/status"]
      timeout: 5s
      interval: 5s
      retries: 3
      start_period: 10s
    environment:
      ANON_KEY: ${TENANT_ANON_KEY}
      SERVICE_KEY: ${TENANT_SERVICE_ROLE_KEY}
      POSTGREST_URL: http://rest-${TENANT_NAME}:3000
      AUTH_JWT_SECRET: ${TENANT_JWT_SECRET}
      DATABASE_URL: postgres://supabase_storage_admin:${PG_PASS}@db:5432/${TENANT_DB}
      STORAGE_PUBLIC_URL: ${SITE_URL}/storage/v1
      REQUEST_ALLOW_X_FORWARDED_PATH: "true"
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      GLOBAL_S3_BUCKET: ${TENANT_NAME}
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: ${TENANT_NAME}
      REGION: local
      ENABLE_IMAGE_TRANSFORMATION: "true"
      IMGPROXY_URL: http://imgproxy:5001
      S3_PROTOCOL_ACCESS_KEY_ID: ${TENANT_S3_KEY}
      S3_PROTOCOL_ACCESS_KEY_SECRET: ${TENANT_S3_SECRET}
    volumes:
      - ../../volumes/storage/${TENANT_NAME}:/var/lib/storage:z
    networks:
      - supabase-net

networks:
  supabase-net:
    external: true
COMPOSEEOF

# Nginx vhost for this tenant
cat > "$PROJECT_DIR/nginx/conf.d/${TENANT_NAME}.conf" << NGINXEOF
server {
    listen 80;
    server_name ${TENANT_NAME}.${DOMAIN:-localhost};

    # ── REST API ─────────────────────────────────────────
    location /rest/v1/ {
        set \$up_rest http://rest-${TENANT_NAME}:3000;
        proxy_pass \$up_rest/;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ── GraphQL ──────────────────────────────────────────
    location /graphql/v1 {
        set \$up_rest http://rest-${TENANT_NAME}:3000;
        proxy_pass \$up_rest/rpc/graphql;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header Content-Profile   graphql_public;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ── Auth ─────────────────────────────────────────────
    location /auth/v1/ {
        set \$up_auth http://auth-${TENANT_NAME}:9999;
        proxy_pass \$up_auth/;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ── Storage ──────────────────────────────────────────
    location /storage/v1/ {
        set \$up_storage http://storage-${TENANT_NAME}:5000;
        proxy_pass \$up_storage/;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50m;
    }

    location / {
        return 404 '{"error":"not found"}';
        add_header Content-Type application/json;
    }
}
NGINXEOF

# ── Start tenant stack ────────────────────────────────────────────────────────
echo "[5/5] Starting tenant services..."
docker compose \
  -f "$TENANT_DIR/docker-compose.yml" \
  --project-name "supabase-tenant-${TENANT_NAME}" \
  up -d

echo "      Reloading nginx..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec nginx nginx -s reload

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Tenant '${TENANT_NAME}' is ready!"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  REST API   : ${SITE_URL}/rest/v1/"
echo "║  Auth API   : ${SITE_URL}/auth/v1/"
echo "║  Storage API: ${SITE_URL}/storage/v1/"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  ANON KEY   : ${TENANT_ANON_KEY}"
echo "║  SERVICE KEY: ${TENANT_SERVICE_ROLE_KEY}"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Credentials saved to: tenants/${TENANT_NAME}/.env"
echo "╚══════════════════════════════════════════════════════════════════╝"
