# Dashboard

A read-only web view of the trading bot: performance against benchmarks, the learning
statistics, open positions with their theses, learned rules, and whether the schedule is
actually firing.

TypeScript throughout — Express API + React (Vite) frontend, served by one Node process.

## It is read-only, and that is the security model

There is no endpoint that can place a trade, close a position, or change a rule. The
container mounts `data/` and `strategy/` **read-only** and has no eToro credentials and no
Claude Code. Even a fully compromised session cannot cost money — the worst case is
someone reads your trade history.

Everything else is defence in depth:

- **scrypt** password hash (Node stdlib), never the password itself
- **JWT in an httpOnly, SameSite=Strict, Secure cookie** — page scripts cannot read it,
  and another site cannot replay it
- **Rate limited login** — 10 attempts per 15 minutes per IP
- **helmet** with a strict CSP; no external origins are permitted
- `cap_drop: ALL`, `no-new-privileges`, non-root user, 512 MB cap
- **No published port.** The reverse proxy reaches it over an internal Docker network, so
  this container opens nothing on the host itself.

## Setup

### 1. Secrets

```bash
cp .env.dashboard.example .env.dashboard

# Password hash (12+ characters). Prints saltHex:hashHex — paste that, not the password.
docker compose run --rm --no-deps --entrypoint node dashboard \
  server/dist/hash-password.js 'your dashboard password'

# Cookie signing secret
openssl rand -hex 32
```

Put both in `.env.dashboard`.

> **Why a separate file from `.env`?** Two reasons, both learned the hard way here.
> Docker compose interpolates `$` in env values — a bcrypt hash (`$2b$12$…`) gets
> silently mangled into one that can never match, with no error anywhere. The hash format
> used now contains no `$` at all, so that class of bug is gone. The split also keeps
> `ETORO_USER_KEY` out of the internet-facing container entirely.

### 2. Domain

The container publishes no port. It joins the external `web` Docker network under the
alias **`trading-dashboard`**, and the reverse proxy that already owns `:80/:443` on the
host routes your domain to `trading-dashboard:8080`. TLS terminates on your own box.

1. Create the shared network once per host, if it does not exist:
   `docker network create web`
2. Point an **A record** for the hostname (e.g. `bot.yourdomain.com`) at the VPS IP. If
   the zone is on Cloudflare, keep it **DNS-only** (grey cloud) so the proxy can complete
   its own ACME challenge and see real client IPs.
3. Add a site block to the host's Caddyfile:
   ```caddy
   bot.yourdomain.com {
       encode zstd gzip
       reverse_proxy trading-dashboard:8080
   }
   ```
   An explicit block matters if that Caddy also serves wildcard or on-demand-TLS sites —
   otherwise the hostname falls through to a catch-all that will refuse it a certificate.
4. Reload the proxy, then `docker compose up -d`.

The dashboard is then at `https://bot.yourdomain.com`. The certificate is issued
automatically on the first request; no wildcard and no DNS-01 credentials are involved.

The app sets `trust proxy` to exactly one hop, so the login rate limiter keys on the real
client IP behind that proxy — do not chain a second one in front without adjusting it.

## Local development

```bash
cd dashboard && npm install

export DASHBOARD_PASSWORD_HASH="$(node server/dist/hash-password.js 'local dev password')"
export JWT_SECRET=$(openssl rand -hex 32)
export DATA_DIR=../data STRATEGY_DIR=../strategy

npm run build
npm start                 # http://localhost:8080
npm run dev               # Vite on :5173 proxying the API to :8080
```

`npm run typecheck` covers both workspaces.

## What the numbers mean

The dashboard leads with **rolling 20-trade expectancy in R**, not equity, because equity
going up proves nothing — a rising market lifts a bad strategy. The performance chart
indexes the account and every benchmark to 100 at the first data point, which is what lets
them share a single axis and makes "is this beating the market" answerable at a glance.

Rules show their tier: only `established` (n≥30) may veto a trade, `provisional` (n≥10) may
only tilt ranking, and `hypothesis` (n<10) changes nothing. If the rules list stays full of
`provisional` entries, cohorts are probably fragmenting on inconsistent signal-tag spellings.
