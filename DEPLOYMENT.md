# Deployment — mirprotocol.net

Production runs as a single Node process under PM2, behind nginx, on the same host as the other MIR sibling sites (mirassertions, mircapture, mirresolve, mirregistry). Not Dockerized.

## Topology

- **Process manager:** PM2 (config: `ecosystem.config.cjs`)
- **Reverse proxy:** nginx (terminates TLS, proxies to `127.0.0.1:3700`)
- **Logs:** `/var/log/mir-shared/mirprotocol.log` (PM2 captures stdout). The mir.org consolidated log viewer tails this directory.
- **Bind:** `127.0.0.1` only — never directly exposed.

## Environment

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `PORT` | no | `3700` | Must be integer 1-65535. App fails fast on invalid values. |
| `NODE_ENV` | no | `development` | Warns if unset. Set to `production` via PM2's `env_production` block. |

Copy `.env.example` to `.env` if you need to override.

## Commands

```bash
# First-time install
npm ci

# Start under PM2 (production env)
pm2 start ecosystem.config.cjs --env production

# Restart after code change
pm2 restart mirprotocol

# Tail logs (single process)
pm2 logs mirprotocol

# Tail consolidated log (all 5 sibling sites)
tail -F /var/log/mir-shared/*.log

# Save PM2 process list (survives reboot if pm2 startup configured)
pm2 save
```

## Deploy procedure

1. `git pull` on the production host.
2. `npm ci` if `package.json` changed.
3. `pm2 restart mirprotocol`.
4. Verify: `curl -s http://127.0.0.1:3700/health` should return `{"ok":true,"ts":"..."}`.
5. Spot-check public URL: `curl -sI https://mirprotocol.net/ | head -5`.

## Health check

`GET /health` returns `{"ok":true,"ts":"<iso8601>"}`. Use for load balancer probes and uptime monitoring.

## Security headers

Set by Helmet middleware in `app.js`. CSP is intentionally relaxed to allow inline styles/scripts already present in the EJS views. If you add external script/style sources, extend the CSP directives in `app.js`.

## Logs

- **Stdout only.** Morgan writes a single line per non-static request to stdout. PM2 captures stdout → `/var/log/mir-shared/mirprotocol.log`.
- **Format:** `<real-ip> - [<mst-date>] "<method> <url>" <status> "<user-agent>"`
- **Static files are skipped** in the morgan format (no log noise from CSS/images/fonts).
- **No local `logs/` directory.** Earlier versions wrote `logs/visitors.log` redundantly; removed.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `EADDRINUSE` on start | Another process already on `PORT`. Check `lsof -i :3700`. |
| 502 from nginx | Process down or wrong upstream port. `pm2 list`, `pm2 logs mirprotocol`. |
| 500 on a spec page | Likely malformed markdown or missing file. Error logged via global handler — check `/var/log/mir-shared/mirprotocol.log`. |
| Test-vector page shows empty | One or more vector JSON files are malformed. Parser logs `[test-vectors] failed to parse <dir>` and skips. |
| Consolidated log viewer missing mirprotocol entries | PM2 not capturing stdout to `/var/log/mir-shared/mirprotocol.log`. Check `out_file` / `error_file` in `ecosystem.config.cjs`. |

