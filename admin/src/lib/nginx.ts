import fs from 'fs'
import path from 'path'

const CONF_DIR = path.join(process.env.PROJECT_DIR ?? '/project', 'nginx', 'conf.d')

/**
 * Security headers shared by every tenant virtual host.
 *
 * Notes:
 * - `server_tokens off` is set globally in nginx.conf; these headers add the
 *   application-layer hardening.
 * - The CSP for tenant API servers is intentionally restrictive — they serve
 *   JSON APIs, not HTML, so we block everything and let callers supply the
 *   right CORS headers via PostgREST / GoTrue.
 */
const SECURITY_HEADERS = `
    add_header X-Content-Type-Options   "nosniff"                         always;
    add_header X-Frame-Options          "DENY"                            always;
    add_header X-XSS-Protection         "1; mode=block"                   always;
    add_header Referrer-Policy          "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy       "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy  "default-src 'none';"             always;`

export function writeTenantNginxConf(tenantName: string, domain: string): void {
  const conf = `server {
    listen 80;
    server_name ${tenantName}.${domain};
${SECURITY_HEADERS}

    location /rest/v1/ {
        set $up_rest http://rest-${tenantName}:3000;
        proxy_pass $up_rest/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /graphql/v1 {
        set $up_rest http://rest-${tenantName}:3000;
        proxy_pass $up_rest/rpc/graphql;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header Content-Profile   graphql_public;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/v1/ {
        set $up_auth http://auth-${tenantName}:9999;
        proxy_pass $up_auth/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage/v1/ {
        set $up_storage http://storage-${tenantName}:5000;
        proxy_pass $up_storage/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location / {
        return 404 '{"error":"not found"}';
        add_header Content-Type application/json;
    }
}
`
  fs.mkdirSync(CONF_DIR, { recursive: true })
  fs.writeFileSync(path.join(CONF_DIR, `${tenantName}.conf`), conf)
}

export function removeTenantNginxConf(tenantName: string): void {
  const p = path.join(CONF_DIR, `${tenantName}.conf`)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
