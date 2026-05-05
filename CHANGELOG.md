# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Pre-built Docker image published to GHCR (`ghcr.io/arunrajiah/supafleet/admin`) — no local build required
- `Makefile` with convenience targets: `up`, `down`, `logs`, `ps`, `build`, `pull`, `tenant-add/remove/list`, `dev`, `lint`, `backup`, `clean`
- `GET /api/health` endpoint for Docker healthcheck liveness probe
- `docker-publish.yml` workflow: builds and pushes multi-arch image (`amd64` + `arm64`) to GHCR on every push to `main` and on release tags

### Changed
- `docker-compose.yml`: admin service now uses pre-built GHCR image by default; added healthcheck; nginx waits for admin to be healthy
- `docker-compose.yml`: renamed Compose project from `supabase-multidb` → `supafleet`

### Fixed
- Removed all provider-specific references (DigitalOcean, "droplet", plan names) from docs and README

---

## [0.1.0] — 2025-05-05

### Added
- Initial release
- Shared Docker infrastructure: PostgreSQL 15, Nginx, imgproxy
- Per-tenant services: PostgREST v14.8, GoTrue v2.186.0, Storage API v1.48.26
- **Admin UI** (Next.js 14): setup wizard, dashboard, create/delete tenants
- Subdomain routing via Nginx (`<name>.<domain>`)
- Per-tenant JWT secret isolation
- CLI scripts: `add-tenant.sh`, `remove-tenant.sh`, `list-tenants.sh`
- OSS repository standards: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates, CI workflow
