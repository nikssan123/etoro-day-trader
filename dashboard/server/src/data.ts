/** Reads the bot's append-only logs and derived snapshots.
 *
 *  The bot owns these files; the dashboard only ever reads them. Results are cached
 *  on (size, mtime) so a page refresh does not re-parse the whole trade history, but
 *  a new cycle's writes are picked up immediately.
 */

import fs from 'fs';
import path from 'path';
import type {
  BenchmarkPoint, BotEvent, EquityPoint, Portfolio, Rule, RunRecord, Stats, Trade,
} from './types';

const DATA_DIR = process.env.DATA_DIR ?? '/data';
const STRATEGY_DIR = process.env.STRATEGY_DIR ?? '/strategy';

interface CacheEntry<T> { key: string; value: T }
const cache = new Map<string, CacheEntry<unknown>>();

function fingerprint(file: string): string {
  try {
    const st = fs.statSync(file);
    return `${st.size}:${st.mtimeMs}`;
  } catch {
    return 'missing';
  }
}

function cached<T>(file: string, parse: () => T): T {
  const key = fingerprint(file);
  const hit = cache.get(file);
  if (hit && hit.key === key) return hit.value as T;
  const value = parse();
  cache.set(file, { key, value });
  return value;
}

function readJsonl<T>(name: string): T[] {
  const file = path.join(DATA_DIR, name);
  return cached(file, () => {
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      return [];
    }
    const out: T[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as T);
      } catch {
        // A partially-flushed final line is normal while a cycle is mid-write.
      }
    }
    return out;
  });
}

function readJson<T>(name: string, fallback: T): T {
  const file = path.join(DATA_DIR, name);
  return cached(file, () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    } catch {
      return fallback;
    }
  });
}

export const getEquity = (): EquityPoint[] => readJsonl<EquityPoint>('equity.jsonl');
export const getBenchmarks = (): BenchmarkPoint[] => readJsonl<BenchmarkPoint>('benchmark.jsonl');
export const getRuns = (): RunRecord[] => readJsonl<RunRecord>('runs.jsonl');
export const getEvents = (): BotEvent[] => readJsonl<BotEvent>('events.jsonl');
export const getStats = (): Stats => readJson<Stats>('stats.json', {});
export const getPortfolio = (): Portfolio => readJson<Portfolio>('portfolio.json', {});
export const getPositionsFile = () =>
  readJson<{ ts?: string; positions?: unknown[] }>('positions.json', { positions: [] });

/** trades.jsonl is append-only and a position is written twice (entry, then exit),
 *  so the last record per position_id is authoritative. Mirrors latest_trades() in
 *  bin/etoro — the two must agree or the dashboard will disagree with the bot. */
export function getTrades(): Trade[] {
  const merged = new Map<number, Trade>();
  for (const rec of readJsonl<Trade>('trades.jsonl')) {
    if (typeof rec.position_id !== 'number') continue;
    merged.set(rec.position_id, { ...merged.get(rec.position_id), ...rec });
  }
  return [...merged.values()];
}

export function getClosedTrades(): Trade[] {
  return getTrades()
    .filter((t) => t.status === 'closed' && typeof t.outcome_r === 'number')
    .sort((a, b) => (a.closed_at ?? '').localeCompare(b.closed_at ?? ''));
}

/** Parse strategy/rules.md into structured rules.
 *  Expected heading: `### R-011 — Title   [established, n=24, updated 2026-09-13]` */
export function getRules(): Rule[] {
  const file = path.join(STRATEGY_DIR, 'rules.md');
  return cached(file, () => {
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      return [];
    }
    const rules: Rule[] = [];
    // Everything after a "## Retired" heading is history, not active policy.
    const retiredAt = raw.search(/^##\s+Retired/im);
    const sections = raw.split(/^###\s+/m).slice(1);
    let cursor = raw.indexOf('### ');

    for (const section of sections) {
      const sectionStart = cursor;
      cursor = raw.indexOf('### ', cursor + 1);
      const [headingLine = '', ...rest] = section.split('\n');
      const meta = headingLine.match(/\[([^\]]+)\]\s*$/);
      const title = headingLine.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
      const idMatch = title.match(/^([RH]-\d+)/);
      const metaText = meta?.[1] ?? '';

      rules.push({
        id: idMatch?.[1] ?? title.slice(0, 12),
        title: title.replace(/^[RH]-\d+\s*[—-]\s*/, '').trim() || title,
        tier: metaText.split(',')[0]?.trim() ?? 'unknown',
        n: Number(metaText.match(/n\s*=\s*(\d+)/)?.[1] ?? '') || null,
        updated: metaText.match(/updated\s+([\d-]+)/)?.[1] ?? null,
        body: rest.join('\n').trim(),
        retired: retiredAt >= 0 && sectionStart > retiredAt,
      });
    }
    // The seed file ships explanatory headings before any real rule exists.
    return rules.filter((r) => /^[RH]-\d+$/.test(r.id));
  });
}

/** Equity and benchmarks on one indexed scale (start = 100).
 *
 *  Indexing is what makes a single y-axis possible: raw equity (~$101k), SPX (~7.7k)
 *  and BTC (~$64k) share no scale, and a dual axis would be a lie. Indexed to a common
 *  base, "is the bot beating the market" is answerable by eye.
 *
 *  Benchmarks are only sampled on the close cycle while equity is sampled every cycle,
 *  so benchmark values are carried forward to each equity timestamp.
 */
export function getPerformanceSeries(): {
  points: { ts: string; equity: number; [symbol: string]: number | string }[];
  symbols: string[];
} {
  const equity = getEquity();
  const benchmarks = getBenchmarks();
  if (equity.length === 0) return { points: [], symbols: [] };

  const symbols = [...new Set(benchmarks.flatMap((b) => Object.keys(b.prices ?? {})))];
  const baseEquity = equity[0]!.equity;
  const base: Record<string, number> = {};

  let bIdx = 0;
  let carried: Record<string, number | null> = {};
  const points = equity.map((point) => {
    while (bIdx < benchmarks.length && benchmarks[bIdx]!.ts <= point.ts) {
      carried = { ...carried, ...benchmarks[bIdx]!.prices };
      bIdx += 1;
    }
    const row: { ts: string; equity: number; [k: string]: number | string } = {
      ts: point.ts,
      equity: baseEquity ? (point.equity / baseEquity) * 100 : 100,
    };
    for (const symbol of symbols) {
      const price = carried[symbol];
      if (typeof price !== 'number' || price <= 0) continue;
      if (base[symbol] === undefined) base[symbol] = price;
      row[symbol] = (price / base[symbol]!) * 100;
    }
    return row;
  });

  return { points, symbols };
}
