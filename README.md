# eToro demo trading bot

An autonomous, self-improving trading bot for an eToro **demo** account. Scheduled `launchd`
jobs invoke Claude Code headless on a cycle; each run researches, trades, and records what it
did in a form later runs can learn from.

## Why this exists

The previous version ran as a claude.ai routine for over two months and made **zero trades** —
the demo portfolio was empty and trade history returned `[]`. Four causes, all addressed here:

1. **The approval gate was unsatisfiable.** The eToro skill requires explicit human approval per
   trade; a headless run has nobody to ask, so every run ended by asking. `CLAUDE.md` §1 now
   carries a standing pre-authorization scoped to demo routes.
2. **Context blowups.** `/market-data/search` without a `fields` param returns 321,000
   characters. `bin/etoro` shapes every read.
3. **No memory between runs.** Positions now carry a recorded thesis (`data/positions.json`).
4. **No forcing function.** `CLAUDE.md` §2 requires a trade when under target, and a "no trade"
   outcome must name a specific guardrail.

## Safety

The API credentials carry `trade.demo:write` but **not** `trade.real:write`. Real-money trading
is structurally impossible, not merely discouraged. Keep it that way.

## Layout

```
CLAUDE.md              mandate + standing authorization — loaded into every run
config/universe.txt    the tradable universe, editable
bin/etoro              read/analysis helper (all API access, all statistics)
bin/trade-cycle.sh     runs one cycle
bin/install-schedule.sh generates/loads the launchd jobs
prompts/               one per cycle
strategy/rules.md      learned rules — written by the bot, loaded every run
strategy/hypotheses.md patterns not yet supported by sample size
data/                  append-only logs + derived snapshots (the dashboard contract)
dashboard/             read-only web dashboard (TypeScript, Express + React)
docker/                bot container image and its schedule
```

## Getting started

```bash
bin/etoro universe --refresh      # build the instrument cache (~2 min)
bin/etoro portfolio               # confirm credentials work
bin/trade-cycle.sh overnight      # run one cycle by hand and watch it

bin/install-schedule.sh generate  # write the launchd jobs (schedules nothing)
bin/install-schedule.sh install   # load them — THIS STARTS LIVE DEMO TRADING
bin/install-schedule.sh status
bin/install-schedule.sh uninstall
```

Credentials come from the `x-user-key` on the `etoro-public-api` MCP entry in `~/.claude.json`,
or from `ETORO_USER_KEY`. **No key is stored in this repo.**

## Deploying to a server (recommended)

launchd only fires while the Mac is awake, so a laptop that sleeps through the US session
simply misses those cycles. For unattended running, deploy the container to an always-on host.

The bot is an autonomous agent with shell access, running unattended on input it does not
control (market data, web search results). On a host that runs anything else, **isolate it** —
the container exists for blast radius, not for packaging convenience. It gets `cap_drop: ALL`,
`no-new-privileges`, a 2 GB memory cap so a spike cannot get a neighbouring container
OOM-killed, and only this repo mounted.

```bash
git clone <this repo> /opt/trading-bot && cd /opt/trading-bot
cp .env.example .env && $EDITOR .env      # paste ETORO_USER_KEY, set TZ

# The container runs as uid 1000 and must be able to write data/ and strategy/.
sudo chown -R 1000:1000 /opt/trading-bot

docker compose build
docker compose run --rm bot claude login  # once; token persists in the claude-home volume
docker compose run --rm bot bin/etoro universe --refresh   # ~2 min
docker compose run --rm bot bin/etoro portfolio            # confirm credentials

docker compose run --rm bot bin/trade-cycle.sh overnight   # one supervised cycle
docker compose up -d                                       # start the schedule
docker compose logs -f
```

`ETORO_USER_KEY` lives only in the host's `.env` (gitignored) and the running container's
memory — the entrypoint writes the MCP config at startup, so no key is ever in the image or the
repo. Set `ANTHROPIC_API_KEY` in `.env` instead of `claude login` if you prefer per-token
billing to an interactive login.

Verified on the image: correct timezone, valid crontab, and egress to `public-api.etoro.com`,
`mcp.public-api.etoro.com` and `api.anthropic.com` under the hardened settings.

## Dashboard

A password-protected, **read-only** web view at your own domain, served over a Cloudflare
Tunnel so the VPS opens no inbound port. Setup — including the Cloudflare steps — is in
[`dashboard/README.md`](dashboard/README.md).

```bash
cp .env.dashboard.example .env.dashboard
docker compose run --rm --no-deps --entrypoint node dashboard \
  server/dist/hash-password.js 'your dashboard password'   # paste into .env.dashboard
openssl rand -hex 32                                        # JWT_SECRET
# add TUNNEL_TOKEN to .env, then:
docker compose up -d
```

It runs as its own container with no eToro credentials, no Claude Code, and `data/` mounted
read-only — there is no endpoint that can trade, so exposing it cannot cost money.

## Schedule (Europe/Sofia; US session is 16:30–23:00 local)

| Cycle | When | Model | Purpose |
|---|---|---|---|
| `overnight` | 09:12 weekdays | Sonnet | Crypto only — stocks are shut |
| `premarket` | 13:07 weekdays | Sonnet | Research; rebuild the ranked watchlist |
| `open` | 16:47 weekdays | Sonnet | **Primary entry window** |
| `midday` | 19:33 weekdays | Sonnet | Manage positions, trail stops |
| `close` | 22:47 weekdays | Sonnet | Exit, then **grade every trade closed today** |
| `weekly` | Sat 12:15 | Opus | Turn statistics into rules |
| `monthly` | 1st of month 12:15 | Opus | Improvement report vs benchmark |

On a server the same schedule is driven by `docker/crontab` via supercronic; on a Mac it is
driven by launchd (`bin/install-schedule.sh`). launchd rather than cron on macOS because cron
silently skips jobs missed while the machine sleeps, whereas launchd runs them on wake — but
neither helps if the machine is off, which is why the container is the recommended deployment.

## How the learning loop works

1. **Every entry is labelled** — `setup`, `signals`, `thesis`, `invalidation`, `conviction`,
   and `risk_r`. You cannot learn from a trade you did not describe.
2. **Every cycle marks open positions** into `data/excursions.jsonl`, giving MAE/MFE — which is
   how "the thesis was wrong" is told apart from "the stop was too tight".
3. **Every close is graded** with an `error_category` from a closed vocabulary. Free text cannot
   be counted; categories can.
4. **`bin/etoro stats`** aggregates in deterministic Python — expectancy in R, per setup, signal
   tag, asset class and conviction, plus rolling 20-trade expectancy.
5. **`weekly` writes rules** into `strategy/rules.md`, which every later run loads.

Rules are tiered by sample size, and the tier is mechanical:

| Tier | Sample | Power |
|---|---|---|
| `hypothesis` | n < 10 | changes nothing |
| `provisional` | n ≥ 10 | may tilt ranking/sizing, **may not veto** |
| `established` | n ≥ 30 | may veto a setup |

This exists because ~60 trades a month will otherwise generate confident, wrong conclusions.

## Judging whether it is improving

Not by equity — a rising market lifts a bad bot. Use:

- **rolling 20-trade expectancy in R** (the headline)
- **excess return vs SPX500/NSDQ100/BTC** in `data/benchmark.jsonl`
- **error-category counts over time** — the top category should shrink after a rule targets it

## Costs matter more than expected

Measured on a $2,000 position: a BTC CFD at 2× costs **10.72% of margin over a 5-day hold**
($40 entry + $34.84/night), against 0.95% for the same position held as `real` at 1×, and 0.48%
for an NVDA CFD at 2×. So crypto is traded unleveraged; stocks keep 2× CFD. Check any entry with
`bin/etoro cost <SYMBOL> --settlement <s> --leverage <n>`.

## API traps worth knowing

- `/market-data/search` **requires** `fields`; without it, 321k characters.
- **Pagination is broken** — 13 pages of 1000 yield ~995 unique instruments. Hence the curated
  `config/universe.txt`.
- `instrumentTypeID` filters are silently ignored; `instrumentType` cannot be projected.
- Descending sort is `sort=-field`; `field desc` and `field:desc` both 404.
- `popularityUniques7Day` is not liquidity — AAPL scores 12, obscure HK listings score 6991.
- `weeklyPriceChange` and `monthlyPriceChange` are often identical; use candles instead.
- Trade history requires `minDate`; `startTime` 404s.
- Cloudflare rejects urllib's default User-Agent with error 1010.
