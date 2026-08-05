import type { ReactNode } from 'react';

export function Panel(
  { title, hint, right, children }:
  { title: string; hint?: string; right?: ReactNode; children: ReactNode },
) {
  return (
    <section className="panel">
      <header>
        <h2 style={{ fontSize: 15 }}>{title}</h2>
        {right}
      </header>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

/** Stat tile: label (sentence case) / value / optional signed delta. */
export function Tile(
  { label, value, delta, deltaGood, hero, note }:
  {
    label: string; value: string; delta?: string | null;
    deltaGood?: boolean; hero?: boolean; note?: string;
  },
) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className={`value${hero ? ' hero' : ''}`}>{value}</div>
      {delta && <div className={`delta ${deltaGood ? 'up' : 'down'}`}>{delta}</div>}
      {note && <div className="muted">{note}</div>}
    </div>
  );
}

export function TierBadge({ tier, n }: { tier: string; n?: number | null }) {
  return (
    <span className={`badge ${tier}`}>
      {tier}{typeof n === 'number' ? ` · n=${n}` : ''}
    </span>
  );
}

export const fmtUsd = (v: number | undefined | null): string =>
  typeof v === 'number'
    ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';

export const fmtR = (v: number | undefined | null): string =>
  typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}R` : '—';

export const fmtPct = (v: number | undefined | null): string =>
  typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : '—';

export const fmtDate = (s: string | undefined | null): string =>
  s ? s.slice(0, 10) : '—';

export const fmtDateTime = (s: string | undefined | null): string =>
  s ? s.replace('T', ' ').slice(0, 16) : '—';
