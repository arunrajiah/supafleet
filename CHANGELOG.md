# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0](https://github.com/arunrajiah/supafleet/compare/v0.1.0...v0.2.0) (2026-07-05)


### Features

* initial release of supabase-multidb v0.1.0 ([412baf9](https://github.com/arunrajiah/supafleet/commit/412baf9649ca7987a746cf83147978134cd1c5e0))
* publish admin image to GHCR, add Makefile, harden compose ([a3126f9](https://github.com/arunrajiah/supafleet/commit/a3126f9e8b9aab73fc5cff27f819dd0e8c49af56))
* **security:** add in-memory rate limiting to admin login endpoint ([4a3508f](https://github.com/arunrajiah/supafleet/commit/4a3508fdaafb59e3d244e4522e718b3f668e4f66))
* **security:** add security headers to nginx admin and tenant configs ([b9071d4](https://github.com/arunrajiah/supafleet/commit/b9071d40604c9fed794f6c8e3312a2107518e6b6))
* **ui:** add container management UI — restart and upgrade services per tenant ([7e009db](https://github.com/arunrajiah/supafleet/commit/7e009db7f7d3eb93782ad778e622b27e70a39175))


### Bug Fixes

* **ci:** fix shellcheck SC1091 and release-please manifest filename ([385961e](https://github.com/arunrajiah/supafleet/commit/385961eb128e93a31770cf0b31401b5e5e42735f))
* **ci:** resolve three CI failures ([a03cbd5](https://github.com/arunrajiah/supafleet/commit/a03cbd543e022eba41f1a4dad54b7802f59e8f2f))
* **ci:** use --severity=warning for shellcheck, enable Actions PR creation ([b10d784](https://github.com/arunrajiah/supafleet/commit/b10d784aad751ae4571ebed5140a12ec3b414f96))
* **docker:** create admin/public directory required by Dockerfile COPY step ([54f58a7](https://github.com/arunrajiah/supafleet/commit/54f58a720ac10d6f0d2c9deae2462fb7dd5cee0b))
* **docker:** rename next.config.ts → next.config.mjs for Next.js 14 compatibility ([a1a5a1d](https://github.com/arunrajiah/supafleet/commit/a1a5a1db6a77e68899d011332efa0516e80689a5))


### Documentation

* add full user and developer documentation ([1cc2038](https://github.com/arunrajiah/supafleet/commit/1cc20382baf742f75fa3453a178098bbc05cd543))
* replace provider-specific terms with generic server language ([0d4dfe9](https://github.com/arunrajiah/supafleet/commit/0d4dfe9bd633339d498bd35850c1b1f0918d0746))
* update documentation for rate limiting, security headers, and container management UI ([6ddcf09](https://github.com/arunrajiah/supafleet/commit/6ddcf0946b810400bfb7cfc65c0dcac04fe395fb))


### CI / Workflows

* add "Run tests" step to lint-admin job (after type-check) ([70a948f](https://github.com/arunrajiah/supafleet/commit/70a948f3c1b6fab56e0802287ba08e5ee9f71f14))
* add full OSS workflow suite ([0c9e784](https://github.com/arunrajiah/supafleet/commit/0c9e7842f69ecf911a9fdb79d7725aebca74b35c))

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
