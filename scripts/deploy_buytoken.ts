#!/usr/bin/env bun
/**
 * Deploy buytoken to clawos.cc server
 * Usage: bun run scripts/deploy_buytoken.ts [--skip-ssh] [--skip-nginx] [--dry-run]
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOMAIN = "buytoken.clawos.cc";
const PORT = 26450;
const PROXY_TARGET = `127.0.0.1:${PORT}`;
const PM2_APP = "buytoken";
const OPENRESTY_CONTAINER = "1Panel-openresty-IZie";
const BASE_URL = process.env.BASE_URL || `https://${DOMAIN}`;

// Load env from clawos/.env
const clawosEnvPath = resolve(__dirname, "..", ".env");
const clawosEnv: Record<string, string> = {};
try {
  for (const line of readFileSync(clawosEnvPath, "utf-8").split("\n")) {
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      clawosEnv[m[1]] = v;
    }
  }
} catch {}

// --- SSH helpers ---
const SSH_KEY = resolve(__dirname, "..", "ssh", "id_ed25519_1panel");

async function ssh(cmd: string, timeout = 30000): Promise<string> {
  const { execSync } = await import("node:child_process");
  const fullCmd = `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=60 root@clawos.cc ${JSON.stringify(cmd)}`;
  try {
    return execSync(fullCmd, { encoding: "utf-8", timeout });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; stderr?: string };
    if (e.status !== 0) return e.stderr || String(err);
    return (err as { stdout?: string }).stdout || "";
  }
}

async function sshNoFail(cmd: string, timeout = 30000): Promise<string> {
  const { execSync } = await import("node:child_process");
  const fullCmd = `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=60 root@clawos.cc ${JSON.stringify(cmd)}`;
  try {
    return execSync(fullCmd, { encoding: "utf-8", timeout });
  } catch (err: unknown) {
    return (err as { stderr?: string }).stderr || (err as { stdout?: string }).stdout || "";
  }
}

// --- Package & Deploy ---
async function stepPackage(): Promise<void> {
  console.log("[deploy] packaging buytoken...");
  const { execSync } = await import("node:child_process");
  const tmpTar = "/tmp/buytoken-deploy.tar.gz";
  execSync(`tar czf "${tmpTar}" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='data' \
    --exclude='logs' \
    --exclude='.env' \
    -C "${resolve(__dirname, "..", "buytoken")}" .`, { encoding: "utf-8" });
  console.log("[deploy] packaged: " + tmpTar);
}

async function stepUpload(): Promise<void> {
  const { execSync } = await import("node:child_process");
  const tmpTar = "/tmp/buytoken-deploy.tar.gz";
  execSync(`scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${tmpTar}" root@clawos.cc:/root/buytoken.tar.gz`, { encoding: "utf-8", timeout: 60000 });
  console.log("[deploy] uploaded");
}

async function stepServerDeploy(): Promise<void> {
  console.log("[deploy] deploying on server...");
  await ssh(`
    set -e
    echo "[1/5] Backup..."
    test -d /root/buytoken && cp -r /root/buytoken /root/buytoken_backup_$(date +%Y%m%d_%H%M%S) || true

    echo "[2/5] Extract..."
    rm -rf /root/buytoken_new
    mkdir -p /root/buytoken_new
    tar xzf /root/buytoken.tar.gz -C /root/buytoken_new --strip-components=1

    echo "[3/5] Install deps..."
    export PATH="$HOME/.bun/bin:$PATH"
    cd /root/buytoken_new
    bun install 2>&1 | tail -3

    echo "[4/5] Write .env..."
    cat > /root/buytoken_new/.env << 'ENVEOF'
PORT=${PORT}
NODE_ENV=production
BASE_URL=${BASE_URL}
ONEPAY_NOTIFY_URL=${BASE_URL}/api/notify
NEWAPI_ACCESS_TOKEN=Fnzzd8OghB74fPugHFUXZ57aFYxXb+AW
ENVEOF

    echo "[5/5] Switch & PM2..."
    rm -rf /root/buytoken_old_backup 2>/dev/null || true
    test -d /root/buytoken && mv /root/buytoken /root/buytoken_old_backup || true
    mv /root/buytoken_new /root/buytoken
    cd /root/buytoken
    mkdir -p logs
    pm2 delete ${PM2_APP} 2>/dev/null || true
    pm2 start ecosystem.config.json
    sleep 3
    pm2 list
  `);
  console.log("[deploy] server deploy done");
}

async function stepNginxConfig(): Promise<void> {
  console.log("[deploy] configuring nginx...");

  // Check if site config already exists
  const existing = await sshNoFail(`docker exec ${OPENRESTY_CONTAINER} test -f /www/sites/${DOMAIN}/proxy/root.conf && echo EXISTS || echo MISSING`);

  if (existing.trim() === "EXISTS") {
    console.log("[deploy] nginx config already exists, skipping");
    await ssh(`
      docker exec ${OPENRESTY_CONTAINER} nginx -t && docker exec ${OPENRESTY_CONTAINER} nginx -s reload
      echo "nginx reloaded"
    `);
    return;
  }

  await ssh(`
    set -e

    # Create directories
    mkdir -p /opt/1panel/www/sites/${DOMAIN}/proxy
    mkdir -p /opt/1panel/www/sites/${DOMAIN}/ssl
    mkdir -p /opt/1panel/www/sites/${DOMAIN}/log

    # Copy SSL certs from regou.app (or any existing site)
    cp /opt/1panel/www/sites/regou.app/ssl/fullchain.pem /opt/1panel/www/sites/${DOMAIN}/ssl/ 2>/dev/null || true
    cp /opt/1panel/www/sites/regou.app/ssl/privkey.pem /opt/1panel/www/sites/${DOMAIN}/ssl/ 2>/dev/null || true

    # Create site config
    cat > /opt/1panel/www/conf.d/${DOMAIN}.conf << 'NGINXCONF'
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN};
    index index.php index.html index.htm default.php default.htm default.html;
    access_log /www/sites/${DOMAIN}/log/access.log main;
    error_log /www/sites/${DOMAIN}/log/error.log;
    location ~ ^/(\\..*) { return 404; }
    location ^~ /.well-known/acme-challenge { allow all; root /usr/share/nginx/html; }
    root /www/sites/${DOMAIN}/index;
    http2 on;
    ssl_certificate /www/sites/${DOMAIN}/ssl/fullchain.pem;
    ssl_certificate_key /www/sites/${DOMAIN}/ssl/privkey.pem;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:!aNULL:!eNULL:!EXPORT:!DSS:!DES:!3DES:!MD5:!PSK;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    error_page 497 https://$host$request_uri;
    proxy_set_header X-Forwarded-Proto https;
    add_header Strict-Transport-Security "max-age=31536000";
    include /www/sites/${DOMAIN}/proxy/*.conf;
}
NGINXCONF

    # Create proxy config
    cat > /opt/1panel/www/sites/${DOMAIN}/proxy/root.conf << 'PROXYCONF'
location ^~ / {
    proxy_pass http://${PROXY_TARGET};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    add_header X-Cache $upstream_cache_status;
    add_header Cache-Control no-cache;
    proxy_ssl_server_name off;
}
PROXYCONF

    # Test & reload nginx
    docker exec ${OPENRESTY_CONTAINER} nginx -t
    docker exec ${OPENRESTY_CONTAINER} nginx -s reload
    echo "nginx config done"
  `);
  console.log("[deploy] nginx config done");
}

async function stepVerify(): Promise<void> {
  await ssh(`
    echo "PM2 status:"
    pm2 list ${PM2_APP}
    echo "Port listening:"
    ss -tlnp | grep ${PORT}
    echo "HTTPS check:"
    curl -sko https://${DOMAIN}/health
    echo ""
  `);
  console.log("[deploy] verify done");
}

async function main(): Promise<void> {
  const skipSsh = process.argv.includes("--skip-ssh");
  const skipNginx = process.argv.includes("--skip-nginx");
  const dryRun = process.argv.includes("--dry-run");

  console.log(`[deploy] ${DOMAIN} -> ${PROXY_TARGET}`);
  console.log(`[deploy] skip-ssh=${skipSsh} skip-nginx=${skipNginx} dry-run=${dryRun}`);

  if (dryRun) {
    console.log("[deploy] dry-run mode - no actual changes");
    return;
  }

  if (!skipSsh) {
    await stepPackage();
    await stepUpload();
    await stepServerDeploy();
  }

  if (!skipNginx) {
    await stepNginxConfig();
  }

  await stepVerify();
  console.log("[deploy] all done!");
}

main().catch(err => {
  console.error("[deploy] ERROR:", err.message);
  process.exit(1);
});
