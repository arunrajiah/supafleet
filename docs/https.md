# HTTPS / TLS Setup

For production deployments, all traffic should be served over HTTPS. This guide covers two approaches: **Caddy** (recommended — automatic certificates) and **Nginx + Certbot**.

---

## Option A — Caddy (recommended)

[Caddy](https://caddyserver.com/) automatically provisions and renews TLS certificates via Let's Encrypt. It's the simplest option.

### 1. Add Caddy to `docker-compose.yml`

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: supabase-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - supabase-net

volumes:
  caddy_data:
  caddy_config:
```

> Remove the `ports` section from the `supabase-nginx` service (Caddy will proxy to it).

### 2. Create `caddy/Caddyfile`

```
*.yourdomain.com {
    reverse_proxy supabase-nginx:80
    tls {
        dns <your-dns-provider>
    }
}

yourdomain.com {
    reverse_proxy supabase-nginx:80
}
```

For wildcard certificates, Caddy needs DNS challenge. See [Caddy DNS providers](https://caddyserver.com/docs/automatic-https#dns-challenge) for the right plugin for your registrar (Cloudflare, Route53, etc.).

**If you don't need wildcard** (tenants on a subdomain of a subdomain, or you add each tenant manually), you can use HTTP challenge instead:

```
myapp.yourdomain.com {
    reverse_proxy supabase-nginx:80
}
```

### 3. Start

```bash
docker compose up -d caddy
```

Caddy will obtain certificates automatically on first request.

---

## Option B — Nginx + Certbot

If you prefer to manage certificates manually or use an existing Nginx setup on the host.

### 1. Install Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 2. Obtain a wildcard certificate

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "*.yourdomain.com" \
  -d "yourdomain.com"
```

Follow the prompts to add a DNS TXT record. This requires manual renewal every 90 days unless you use a DNS plugin.

### 3. Configure host Nginx

Create `/etc/nginx/sites-available/supafleet`:

```nginx
server {
    listen 80;
    server_name *.yourdomain.com yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name *.yourdomain.com yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:80;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/supafleet /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Auto-renewal

```bash
sudo crontab -e
# Add:
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## Updating tenant site URLs

After enabling HTTPS, update each tenant's site URL so auth redirects work correctly.

Currently this requires re-creating the tenant. A future release will add a "change site URL" feature in the admin UI.

For now, if you provisioned tenants before enabling HTTPS:

```bash
# Remove and re-create with the https:// URL
./scripts/remove-tenant.sh myapp          # keeps the database
./scripts/add-tenant.sh myapp https://myapp.yourdomain.com
```

The database is preserved when `--drop-db` is not passed, so no data is lost.

---

## DNS setup

Point a wildcard DNS A record at your server:

| Record | Type | Value |
|---|---|---|
| `*.yourdomain.com` | A | `<your-server-ip>` |
| `yourdomain.com` | A | `<your-server-ip>` |

DNS propagation can take up to 48 hours, but typically completes in minutes with major providers.
