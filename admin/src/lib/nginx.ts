import fs from 'fs'
import path from 'path'

const CONF_DIR = path.join(process.env.PROJECT_DIR ?? '/project', 'nginx', 'conf.d')

export function writeTenantNginxConf(tenantName: string, domain: string): void {
  const conf = `server {
    listen 80;
    server_name ${tenantName}.${domain};

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
