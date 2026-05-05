# supafleet — developer convenience commands
# Usage: make <target> [name=<tenant-name>]

.PHONY: help up down restart logs ps build pull \
        tenant-add tenant-remove tenant-list \
        dev lint backup clean

## ── Help ─────────────────────────────────────────────────────────────────────

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

## ── Stack ────────────────────────────────────────────────────────────────────

up: ## Start the stack (pull images first)
	docker compose pull --quiet
	docker compose up -d

down: ## Stop the stack
	docker compose down

restart: ## Restart all shared services
	docker compose restart

logs: ## Tail logs for all shared services (Ctrl-C to stop)
	docker compose logs -f

ps: ## Show running containers
	docker compose ps
	@echo ""
	@echo "Tenant containers:"
	@docker ps --filter "name=auth-" --filter "name=rest-" --filter "name=storage-" \
	  --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>/dev/null || true

## ── Image ────────────────────────────────────────────────────────────────────

build: ## Build the admin image locally
	docker compose build admin

pull: ## Pull the latest pre-built admin image from GHCR
	docker compose pull admin

## ── Tenants ──────────────────────────────────────────────────────────────────

tenant-add: ## Provision a new tenant  (make tenant-add name=myapp)
ifndef name
	$(error name is required — run: make tenant-add name=<tenant-name>)
endif
	./scripts/add-tenant.sh $(name)

tenant-remove: ## Remove a tenant, keep database  (make tenant-remove name=myapp)
ifndef name
	$(error name is required — run: make tenant-remove name=<tenant-name>)
endif
	./scripts/remove-tenant.sh $(name)

tenant-remove-hard: ## Remove tenant AND database  (make tenant-remove-hard name=myapp)
ifndef name
	$(error name is required — run: make tenant-remove-hard name=<tenant-name>)
endif
	./scripts/remove-tenant.sh $(name) --drop-db

tenant-list: ## List all tenants and container status
	./scripts/list-tenants.sh

## ── Development ──────────────────────────────────────────────────────────────

dev: ## Run admin UI in hot-reload dev mode (stops the container first)
	docker compose stop admin
	cd admin && \
	  POSTGRES_HOST=localhost \
	  POSTGRES_PORT=$${POSTGRES_PORT:-5432} \
	  POSTGRES_PASSWORD=$$(grep POSTGRES_PASSWORD .env | cut -d= -f2) \
	  DOMAIN=$$(grep ^DOMAIN .env | cut -d= -f2) \
	  PROJECT_DIR=$$(pwd) \
	  CONTAINER_NAME=supabase-admin \
	  npm run dev

lint: ## Run all linters
	cd admin && npx tsc --noEmit
	shellcheck -x --severity=warning scripts/*.sh
	cp .env.example .env.lint && docker compose -f docker-compose.yml config --quiet --env-file .env.lint && rm -f .env.lint

## ── Backups ──────────────────────────────────────────────────────────────────

backup: ## Dump all databases and tar storage to ./backups/
	@mkdir -p backups
	@DATE=$$(date +%Y%m%d-%H%M%S); \
	  docker compose exec -T db pg_dumpall -U postgres | gzip > backups/db-$$DATE.sql.gz && \
	  tar -czf backups/storage-$$DATE.tar.gz volumes/storage/ && \
	  echo "Backup complete: backups/db-$$DATE.sql.gz  backups/storage-$$DATE.tar.gz"

## ── Clean ────────────────────────────────────────────────────────────────────

clean: ## Stop the stack and remove all volumes (DESTROYS DATA)
	@echo "WARNING: This will destroy all database data and storage files."
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ]
	docker compose down -v
	rm -rf volumes/db/data volumes/storage/* .multidb/
