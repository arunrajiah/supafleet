#!/usr/bin/env bash
# list-tenants.sh — show all provisioned tenants and their container status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

TENANTS_DIR="$PROJECT_DIR/tenants"
count=0

printf "%-20s %-15s %-15s %-15s %s\n" "TENANT" "rest" "auth" "storage" "SITE_URL"
printf "%-20s %-15s %-15s %-15s %s\n" "------" "----" "----" "-------" "--------"

for dir in "$TENANTS_DIR"/*/; do
  [[ -d "$dir" ]] || continue
  name=$(basename "$dir")
  [[ "$name" == ".gitkeep" ]] && continue

  site_url="n/a"
  [[ -f "$dir/.env" ]] && site_url=$(grep '^SITE_URL=' "$dir/.env" 2>/dev/null | cut -d= -f2-)

  rest_status=$(docker inspect --format='{{.State.Status}}' "rest-${name}" 2>/dev/null || echo "stopped")
  auth_status=$(docker inspect --format='{{.State.Status}}' "auth-${name}" 2>/dev/null || echo "stopped")
  storage_status=$(docker inspect --format='{{.State.Status}}' "storage-${name}" 2>/dev/null || echo "stopped")

  printf "%-20s %-15s %-15s %-15s %s\n" "$name" "$rest_status" "$auth_status" "$storage_status" "$site_url"
  ((count++))
done

echo ""
echo "Total: $count tenant(s)"
