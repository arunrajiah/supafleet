# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main`  | ✅ Yes    |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a vulnerability, open a [GitHub Security Advisory](https://github.com/arunrajiah/supabase-multidb/security/advisories/new) (private by default). Include:

1. A description of the vulnerability
2. Steps to reproduce
3. The potential impact
4. Any suggested mitigations (optional)

You can expect an acknowledgement within **72 hours** and a status update within **7 days**.

## Security considerations for self-hosted deployments

- **Never expose the Postgres port** (5432) to the internet — use Supavisor or connect via Docker network only.
- **Always set a strong `POSTGRES_PASSWORD`** in `.env`.
- **Protect the admin UI** — put it behind HTTPS and a strong admin password. The admin UI has access to the Docker socket, which effectively grants root on the host.
- **Keep Docker images updated** — subscribe to upstream Supabase release notes.
- **Rotate JWT secrets** periodically — use the admin UI to generate new credentials.
- **Wildcard DNS** — if using `*.yourdomain.com`, be aware that any subdomain resolves to your server. Ensure nginx returns 404 for unknown subdomains.
