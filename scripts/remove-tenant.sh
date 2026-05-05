#!/usr/bin/env bash
# remove-tenant.sh — tear down a tenant completely
#
# Usage: ./scripts/remove-tenant.sh <tenant-name> [--drop-db]
#   --drop-db : also DROP the PostgreSQL database (irreversible!)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

TENANT_NAME="${1:-}"
DROP_DB=false
[[ "${2:-}" == "--drop-db" ]] && DROP_DB=true

if [[ -z "$TENANT_NAME" ]]; then
  echo "Usage: $0 <tenant-name> [--drop-db]"
  exit 1
fi

TENANT_DB="tenant_${TENANT_NAME//-/_}"
TENANT_DIR="$PROJECT_DIR/tenants/$TENANT_NAME"

if [[ ! -d "$TENANT_DIR" ]]; then
  echo "Error: tenant '$TENANT_NAME' not found at $TENANT_DIR"
  exit 1
fi

echo "Stopping tenant services for '$TENANT_NAME'..."
docker compose \
  -f "$TENANT_DIR/docker-compose.yml" \
  --project-name "supabase-tenant-${TENANT_NAME}" \
  down --remove-orphans 2>/dev/null || true

echo "Removing nginx config..."
rm -f "$PROJECT_DIR/nginx/conf.d/${TENANT_NAME}.conf"

echo "Removing tenant directory..."
rm -rf "$TENANT_DIR"

if $DROP_DB; then
  echo "WARNING: Dropping database '$TENANT_DB'..."
  set -a; source "$PROJECT_DIR/.env"; set +a
  docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T db \
    psql -U postgres -c "DROP DATABASE IF EXISTS \"$TENANT_DB\";"
  echo "Database dropped."
  echo "Removing storage files..."
  rm -rf "$PROJECT_DIR/volumes/storage/$TENANT_NAME"
else
  echo "Note: database '$TENANT_DB' and storage files preserved."
  echo "      Re-run with --drop-db to delete them."
fi

echo "Reloading nginx..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec nginx nginx -s reload 2>/dev/null || true

echo "Tenant '$TENANT_NAME' removed."
