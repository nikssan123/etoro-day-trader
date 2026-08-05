export interface Cohort {
  n: number;
  tier: 'hypothesis' | 'provisional' | 'established';
  win_rate: number;
  avg_win_r: number;
  avg_loss_r: number;
  expectancy_r: number;
  profit_factor: number | null;
  total_r: number;
}

export interface Overview {
  portfolio: {
    ts?: string; cash?: number; invested?: number; unrealized_pnl?: number;
    equity?: number; open_positions?: number;
  };
  overall: Cohort | null;
  generated_at: string | null;
  rolling20_latest: number | null;
  rolling20_prev: number | null;
  closed_trades: number;
  realized_r_today: number;
  last_run: {
    run_id: string; cycle: string; started_at: string; ended_at?: string;
    trades_opened?: number; trades_closed?: number; no_trade_reason?: string | null;
    exit_code?: number;
  } | null;
}

export interface Stats {
  generated_at?: string;
  overall?: Cohort;
  by_setup?: Record<string, Cohort>;
  by_signal?: Record<string, Cohort>;
  by_conviction?: Record<string, Cohort>;
  by_asset_class?: Record<string, Cohort>;
  rolling20_expectancy_r?: { trade_index: number; closed_at: string; expectancy_r: number }[];
  error_categories?: Record<string, number>;
  error_categories_by_month?: Record<string, Record<string, number>>;
  stop_and_exit_quality?: {
    avg_mae_r_of_winners: number | null;
    avg_mfe_r_of_losers: number | null;
  };
}

export interface Trade {
  position_id: number; symbol?: string; asset_class?: string; direction?: string;
  setup?: string; signals?: string[]; thesis?: string; conviction?: number;
  opened_at?: string; closed_at?: string; outcome_r?: number; outcome_usd?: number;
  exit_reason?: string; hold_days?: number; mae_r?: number; mfe_r?: number;
  thesis_correct?: boolean; error_category?: string; lesson?: string;
}

export interface Position {
  position_id: number; symbol?: string; amount?: number; leverage?: number;
  open_rate?: number; unrealized_pnl?: number;
  // stop_loss / take_profit come from eToro; stop / target come from the recorded
  // thesis. They can differ — the thesis records intent, eToro records what is live.
  stop_loss?: number; take_profit?: number; stop?: number; target?: number;
  setup?: string; thesis?: string; invalidation?: string; conviction?: number;
  opened_at?: string; risk_r?: number;
}

export interface Run {
  run_id: string; cycle: string; started_at: string; ended_at?: string;
  duration_s?: number; equity?: number; open_positions?: number;
  trades_opened?: number; trades_closed?: number;
  no_trade_reason?: string | null; exit_code?: number;
}

export interface Rule {
  id: string; title: string; tier: string; n: number | null;
  updated: string | null; body: string; retired: boolean;
}

export interface Performance {
  points: Record<string, number | string>[];
  symbols: string[];
}

export class AuthError extends Error {}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (res.status === 401) throw new AuthError('not authenticated');
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<{ authenticated: boolean }>('/me'),
  overview: () => request<Overview>('/overview'),
  performance: () => request<Performance>('/performance'),
  stats: () => request<Stats>('/stats'),
  positions: () => request<{ ts: string | null; positions: Position[] }>('/positions'),
  trades: (limit = 100) => request<Trade[]>(`/trades?limit=${limit}`),
  runs: (limit = 30) => request<Run[]>(`/runs?limit=${limit}`),
  rules: () => request<Rule[]>('/rules'),

  async login(password: string): Promise<void> {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? 'login failed');
    }
  },

  async logout(): Promise<void> {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  },
};
