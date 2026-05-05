# Contributing to supafleet

Thank you for taking the time to contribute! This document covers everything you need to get started.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating you agree to uphold it.

---

## Ways to contribute

- **Bug reports** — open an issue using the bug report template
- **Feature requests** — open an issue using the feature request template
- **Code** — fix a bug or implement a feature (see below)
- **Documentation** — improve the README, add guides to `docs/`
- **Testing** — add or improve test coverage

---

## Development setup

### Prerequisites

- Docker Engine 24+
- Docker Compose v2
- Node.js 20+ (for the admin UI)
- Python 3 (for CLI scripts)

### Clone and install

```bash
git clone https://github.com/arunrajiah/supafleet.git
cd supafleet

# Install admin UI dependencies
cd admin && npm install && cd ..
```

### Run the admin UI locally

```bash
# Start shared infrastructure (db, nginx, imgproxy)
cp .env.example .env   # fill in values
docker compose up -d db imgproxy

# Run the admin UI in dev mode
cd admin
POSTGRES_HOST=localhost \
POSTGRES_PASSWORD=your-password \
DOMAIN=localhost \
PROJECT_DIR=$(dirname $PWD) \
npm run dev
# → http://localhost:3000
```

---

## Submitting changes

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b fix/my-bug-fix
   ```

2. **Make your changes.** Keep commits focused and atomic.

3. **Follow the code style:**
   - TypeScript strict mode — no `any` casts without justification
   - No unused imports or variables
   - Prefer `async/await` over raw Promises
   - Shell scripts: `set -euo pipefail`, quote all variables

4. **Test your changes** against a real Docker environment before opening a PR.

5. **Update documentation** — if you change behaviour, update the README or add a doc.

6. **Open a Pull Request** using the PR template. Link to the issue it resolves.

---

## Commit message format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`

Examples:
```
feat(admin): add tenant restart button
fix(docker): resolve host path for storage volume mounts
docs: add HTTPS setup guide
```

---

## Project structure

```
supafleet/
├── admin/              # Next.js management UI
│   ├── src/
│   │   ├── app/        # Pages and API routes
│   │   ├── components/ # Shared React components
│   │   └── lib/        # Backend logic (docker, db, nginx, tenant)
│   └── Dockerfile
├── scripts/            # CLI scripts for tenant management
├── volumes/db/         # Postgres init SQL (mounted at container start)
├── nginx/              # Nginx config templates
├── docker-compose.yml  # Shared infrastructure
└── .env.example        # Configuration template
```

---

## Reporting bugs

Please use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Your OS and Docker version
- Steps to reproduce
- Expected vs actual behaviour
- Relevant logs (`docker compose logs <service>`)

---

## Questions?

Open a [discussion](https://github.com/arunrajiah/supafleet/discussions) — issues are for bugs and feature requests only.

