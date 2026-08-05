import { useCallback, useEffect, useState } from 'react';
import {
  AuthError, api,
  type Overview, type Performance, type Position, type Rule, type Run, type Stats, type Trade,
} from './api';
import { BarChart, type Bar } from './charts/BarChart';
import { LineChart, type Series } from './charts/LineChart';
import { Login } from './Login';
import {
  Panel, TierBadge, Tile, fmtDate, fmtDateTime, fmtPct, fmtR, fmtUsd,
} from './components';

type Theme = 'light' | 'dark' | 'auto';

interface Data {
  overview: Overview;
  performance: Performance;
  stats: Stats;
  positions: { ts: string | null; positions: Position[] };
  trades: Trade[];
  runs: Run[];
  rules: Rule[];
}

const SERIES_COLORS = ['var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme | null) ?? 'auto',
  );

  // 'auto' follows the OS; resolve it so the toggle can offer the opposite of what
  // the viewer is actually looking at, rather than the opposite of the stored value.
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const resolvedTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const load = useCallback(async () => {
    try {
      const [overview, performance, stats, positions, trades, runs, rules] = await Promise.all([
        api.overview(), api.performance(), api.stats(),
        api.positions(), api.trades(100), api.runs(30), api.rules(),
      ]);
      setData({ overview, performance, stats, positions, trades, runs, rules });
      setAuthed(true);
      setError(null);
    } catch (err) {
      if (err instanceof AuthError) { setAuthed(false); return; }
      setError(err instanceof Error ? err.message : 'failed to load');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Refresh on focus — a cycle may have run while the tab was in the background.
  useEffect(() => {
    const onFocus = () => { if (authed) void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authed, load]);

  // Poll while the tab is visible. The bot refreshes portfolio.json every 2 minutes, so
  // without this an open tab would sit on whatever it fetched at page load. Paused when
  // hidden: a backgrounded tab hitting the API forever is waste, and the focus handler
  // above already covers the return.
  useEffect(() => {
    if (!authed) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    return () => clearInterval(id);
  }, [authed, load]);

  if (authed === false) return <Login onSuccess={() => { setAuthed(null); void load(); }} />;
  if (authed === null || !data) {
    return <div className="app"><p className="subtle">{error ?? 'Loading…'}</p></div>;
  }

  const { overview, performance, stats, positions, trades, runs, rules } = data;
  const overall = overview.overall;
  const rolling = stats.rolling20_expectancy_r ?? [];
  const expectancyDelta =
    overview.rolling20_latest !== null && overview.rolling20_prev !== null
      ? overview.rolling20_latest - overview.rolling20_prev
      : null;

  const perfSeries: Series[] = [
    { key: 'equity', label: 'Bot', color: 'var(--series-1)' },
    ...performance.symbols.map((sym, i) => ({
      key: sym,
      label: sym,
      color: SERIES_COLORS[i % SERIES_COLORS.length]!,
      muted: true,
    })),
  ];

  const setupBars: Bar[] = Object.entries(stats.by_setup ?? {})
    .map(([label, c]) => ({
      label,
      value: c.expectancy_r,
      note: `n=${c.n} · ${c.tier} · win rate ${fmtPct(c.win_rate)} · total ${fmtR(c.total_r)}`,
    }))
    .sort((a, b) => b.value - a.value);

  const signalBars: Bar[] = Object.entries(stats.by_signal ?? {})
    .map(([label, c]) => ({
      label,
      value: c.expectancy_r,
      note: `n=${c.n} · ${c.tier} · win rate ${fmtPct(c.win_rate)}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const errorBars: Bar[] = Object.entries(stats.error_categories ?? {})
    .map(([label, count]) => ({ label, value: count, note: `${count} trades` }))
    .sort((a, b) => b.value - a.value);

  const activeRules = rules.filter((r) => !r.retired);

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1 style={{ fontSize: 20 }}>Trading bot</h1>
          <div className="subtle">
            Demo account · stats generated {fmtDateTime(overview.generated_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
            {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button onClick={() => void load()}>Refresh</button>
          <button onClick={async () => { await api.logout(); setAuthed(false); }}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {/* The lead number is the improvement metric, not equity — a rising market
          lifts a bad bot, so expectancy is what actually answers "is this working". */}
      <div className="grid">
        <Tile
          label="Expectancy (20-trade)"
          value={overview.rolling20_latest !== null ? fmtR(overview.rolling20_latest) : '—'}
          hero
          delta={expectancyDelta !== null
            ? `${expectancyDelta >= 0 ? '+' : ''}${expectancyDelta.toFixed(2)}R vs previous 20`
            : null}
          deltaGood={(expectancyDelta ?? 0) >= 0}
          note={rolling.length === 0 ? 'needs 20 closed trades' : undefined}
        />
        <Tile label="Equity" value={fmtUsd(overview.portfolio.equity)}
          note={`${fmtUsd(overview.portfolio.cash)} cash`} />
        <Tile label="Open positions" value={String(overview.portfolio.open_positions ?? 0)}
          note="target 5–8" />
        <Tile label="Closed trades" value={String(overview.closed_trades)}
          note={overall ? `${overall.tier} sample` : 'no closed trades yet'} />
        <Tile label="Win rate" value={overall ? fmtPct(overall.win_rate) : '—'}
          note={overall ? `profit factor ${overall.profit_factor ?? '—'}` : undefined} />
        <Tile label="Today" value={fmtR(overview.realized_r_today)}
          note={overview.last_run
            ? `last cycle: ${overview.last_run.cycle}`
            : 'no cycles recorded'} />
      </div>

      <Panel
        title="Performance vs benchmarks"
        hint="Everything is indexed to 100 at the first data point, which is what allows a single
              axis — raw equity, an index near 7,700 and BTC near 64,000 share no scale. Beating
              the benchmark lines is the only reading that separates skill from a rising market."
      >
        <LineChart
          points={performance.points}
          xKey="ts"
          series={perfSeries}
          baselineValue={100}
          baselineLabel="start"
          format={(v) => v.toFixed(1)}
          yLabel="indexed performance"
          height={300}
        />
        {/* Table view: required relief for the light-mode series that sit below 3:1,
            and the honest fallback when lines converge. */}
        <details style={{ marginTop: 8 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>Table view</summary>
          <div className="table-scroll" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {perfSeries.map((s) => <th key={s.key} className="num">{s.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...performance.points].reverse().slice(0, 60).map((p, i) => (
                  <tr key={i}>
                    <td>{fmtDateTime(String(p.ts))}</td>
                    {perfSeries.map((s) => (
                      <td key={s.key} className="num">
                        {typeof p[s.key] === 'number' ? (p[s.key] as number).toFixed(1) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>

      <Panel
        title="Rolling 20-trade expectancy"
        hint="The headline improvement metric. Each point averages the trailing 20 closed trades
              in R. Above zero is a positive edge; a rising line means decisions are getting
              better. Fewer than 20 closed trades and this is intentionally empty."
      >
        <LineChart
          points={rolling.map((r) => ({ ts: r.closed_at, expectancy: r.expectancy_r }))}
          xKey="ts"
          series={[{ key: 'expectancy', label: 'Expectancy (R)', color: 'var(--series-1)' }]}
          baselineValue={0}
          baselineLabel="break-even"
          format={(v) => v.toFixed(2)}
          height={220}
        />
      </Panel>

      <div className="two-col">
        <Panel
          title="Expectancy by setup"
          hint="Which setups actually pay. Hover for sample size and tier — anything below
                n=30 cannot veto a trade, no matter how good it looks here."
        >
          <BarChart bars={setupBars} diverging format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`} />
        </Panel>

        <Panel
          title="Expectancy by signal tag"
          hint="Top 12 tags by expectancy. Tags appearing disproportionately in losers are the
                raw material for the next rule."
        >
          <BarChart bars={signalBars} diverging format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`} />
        </Panel>
      </div>

      <div className="two-col">
        <Panel
          title="Error categories"
          hint="Counted from every closed trade's postmortem. The top category is what to fix
                first; after a rule targets it, this count should fall."
        >
          <BarChart bars={errorBars} format={(v) => String(v)} />
        </Panel>

        <Panel
          title="Stop & exit quality"
          hint="Diagnostic for whether stops and exits are set correctly, from MAE/MFE."
        >
          <div className="grid" style={{ marginBottom: 0 }}>
            <Tile
              label="Avg MAE of winners"
              value={fmtR(stats.stop_and_exit_quality?.avg_mae_r_of_winners)}
              note="near −1R means stops are too tight and are killing winners"
            />
            <Tile
              label="Avg MFE of losers"
              value={fmtR(stats.stop_and_exit_quality?.avg_mfe_r_of_losers)}
              note="well above 0 means exits are too slow"
            />
          </div>
        </Panel>
      </div>

      <Panel title={`Open positions (${positions.positions.length})`}>
        {positions.positions.length === 0
          ? <div className="empty">No open positions.</div>
          : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th><th>Setup</th><th className="num">Size</th>
                    <th className="num">Entry</th><th className="num">Stop</th>
                    <th className="num">Target</th><th className="num">P&amp;L</th>
                    <th>Thesis</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.positions.map((p) => (
                    <tr key={p.position_id}>
                      <td><strong>{p.symbol ?? p.position_id}</strong></td>
                      <td>{p.setup ?? '—'}</td>
                      <td className="num">{fmtUsd(p.amount)}{p.leverage ? ` ×${p.leverage}` : ''}</td>
                      <td className="num">{p.open_rate ?? '—'}</td>
                      <td className="num">{p.stop_loss ?? p.stop ?? '—'}</td>
                      <td className="num">{p.take_profit ?? p.target ?? '—'}</td>
                      <td className={`num ${(p.unrealized_pnl ?? 0) >= 0 ? 'up' : 'down'}`}>
                        {fmtUsd(p.unrealized_pnl)}
                      </td>
                      <td style={{ maxWidth: 340 }}>{p.thesis ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

      <Panel
        title={`Learned rules (${activeRules.length} active)`}
        hint="Written by the weekly review from the statistics. Only `established` rules
              (n≥30) may veto a trade; `provisional` may tilt ranking only."
      >
        {activeRules.length === 0
          ? <div className="empty">No rules yet — the first appear after the weekly review.</div>
          : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>ID</th><th>Rule</th><th>Tier</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {activeRules.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.id}</strong></td>
                      <td style={{ maxWidth: 520 }}>
                        {r.title}
                        <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{r.body}</div>
                      </td>
                      <td><TierBadge tier={r.tier} n={r.n} /></td>
                      <td>{r.updated ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

      <Panel title="Recent closed trades">
        {trades.length === 0
          ? <div className="empty">No closed trades yet.</div>
          : (
            <div className="table-scroll capped">
              <table>
                <thead>
                  <tr>
                    <th>Closed</th><th>Symbol</th><th>Setup</th>
                    <th className="num">R</th><th>Exit</th><th>Error</th><th>Lesson</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.position_id}>
                      <td>{fmtDate(t.closed_at)}</td>
                      <td><strong>{t.symbol ?? '—'}</strong></td>
                      <td>{t.setup ?? '—'}</td>
                      <td className={`num ${(t.outcome_r ?? 0) >= 0 ? 'up' : 'down'}`}>
                        {fmtR(t.outcome_r)}
                      </td>
                      <td>{t.exit_reason ?? '—'}</td>
                      <td>{t.error_category ?? '—'}</td>
                      <td style={{ maxWidth: 360 }}>{t.lesson ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

      <Panel
        title="Cycle history"
        hint="Whether the schedule is actually firing. A cycle that opened nothing must name
              the guardrail that stopped it — a blank reason means the forcing function is too soft."
      >
        {runs.length === 0
          ? <div className="empty">No cycles recorded yet.</div>
          : (
            <div className="table-scroll capped">
              <table>
                <thead>
                  <tr>
                    <th>Started</th><th>Cycle</th><th className="num">Opened</th>
                    <th className="num">Closed</th><th className="num">Equity</th>
                    <th className="num">Secs</th><th>No-trade reason</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.run_id}>
                      <td>{fmtDateTime(r.started_at)}</td>
                      <td>
                        {r.cycle}
                        {r.exit_code ? <span className="badge" style={{ marginLeft: 6 }}>exit {r.exit_code}</span> : null}
                      </td>
                      <td className="num">{r.trades_opened ?? 0}</td>
                      <td className="num">{r.trades_closed ?? 0}</td>
                      <td className="num">{fmtUsd(r.equity)}</td>
                      <td className="num">{r.duration_s ?? '—'}</td>
                      <td className="muted">{r.no_trade_reason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

      <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>
        Read-only view. Trading decisions are made by the scheduled cycles, not from here.
      </p>
    </div>
  );
}
