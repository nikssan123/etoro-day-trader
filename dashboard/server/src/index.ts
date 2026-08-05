/** Dashboard API + static host.
 *
 *  Every route here is READ-ONLY by design. The dashboard can observe the bot but
 *  cannot trade, cancel, or change its rules — so exposing it to the internet cannot
 *  cost money even in the worst case.
 */

import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';

import { clearSession, issueSession, requireAuth, verifyPassword } from './auth';
import {
  getClosedTrades, getEvents, getPerformanceSeries, getPortfolio, getPositionsFile,
  getRules, getRuns, getStats, getTrades,
} from './data';

const app = express();
const PORT = Number(process.env.PORT ?? 8080);
const WEB_DIR = process.env.WEB_DIR ?? path.join(__dirname, '../../web/dist');

// Behind the reverse proxy, the client IP arrives in a forwarded header. Trust exactly
// one hop so the rate limiter keys on the real client rather than the proxy. Chaining a
// second proxy in front without raising this would key every login attempt on one IP.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // The charts are inline SVG with a small inline style block; no external origins.
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too many login attempts, try again later' },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (await verifyPassword(password)) {
    issueSession(res);
    res.json({ ok: true });
    return;
  }
  // Deliberately vague: nothing here distinguishes "wrong password" from anything else.
  res.status(401).json({ error: 'invalid password' });
});

app.post('/api/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

const api = express.Router();
api.use(requireAuth);

api.get('/me', (_req, res) => res.json({ authenticated: true }));

api.get('/overview', (_req, res) => {
  const portfolio = getPortfolio();
  const stats = getStats();
  const runs = getRuns();
  const closed = getClosedTrades();
  const rolling = stats.rolling20_expectancy_r ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const closedToday = closed.filter((t) => (t.closed_at ?? '').startsWith(today));

  res.json({
    portfolio,
    overall: stats.overall ?? null,
    generated_at: stats.generated_at ?? null,
    rolling20_latest: rolling.length ? rolling[rolling.length - 1]!.expectancy_r : null,
    // Compare the two most recent non-overlapping-ish windows so the KPI can show a
    // direction, not just a level. Null until there is enough history to mean anything.
    rolling20_prev: rolling.length > 20 ? rolling[rolling.length - 21]!.expectancy_r : null,
    closed_trades: closed.length,
    realized_r_today: Number(
      closedToday.reduce((sum, t) => sum + (t.outcome_r ?? 0), 0).toFixed(3),
    ),
    last_run: runs.length ? runs[runs.length - 1] : null,
  });
});

api.get('/performance', (_req, res) => res.json(getPerformanceSeries()));
api.get('/stats', (_req, res) => res.json(getStats()));
api.get('/rules', (_req, res) => res.json(getRules()));

api.get('/positions', (_req, res) => {
  const file = getPositionsFile();
  res.json({ ts: file.ts ?? null, positions: file.positions ?? [] });
});

api.get('/trades', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
  res.json(getClosedTrades().slice(-limit).reverse());
});

api.get('/open-trades', (_req, res) => {
  res.json(getTrades().filter((t) => t.status === 'open'));
});

api.get('/runs', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 300);
  res.json(getRuns().slice(-limit).reverse());
});

api.get('/events', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 300);
  res.json(getEvents().slice(-limit).reverse());
});

app.use('/api', api);

// Static frontend. Unknown non-API paths fall through to index.html for the SPA.
if (fs.existsSync(WEB_DIR)) {
  app.use(express.static(WEB_DIR, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(WEB_DIR, 'index.html'));
  });
} else {
  console.warn(`web build not found at ${WEB_DIR} — serving API only`);
}

app.listen(PORT, () => {
  console.log(`dashboard listening on :${PORT} (data=${process.env.DATA_DIR ?? '/data'})`);
});
