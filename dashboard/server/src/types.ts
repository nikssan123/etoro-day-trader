/** Shapes mirroring data/schema.json. Kept loose where the bot writes free-form
 *  fields, strict where the dashboard actually depends on a value. */

export interface Trade {
  position_id: number;
  order_id?: number;
  run_id?: string;
  symbol?: string;
  instrument_id?: number;
  asset_class?: string;
  direction?: 'long' | 'short';
  status?: 'open' | 'closed';
  opened_at?: string;
  closed_at?: string;
  setup?: string;
  signals?: string[];
  thesis?: string;
  invalidation?: string;
  conviction?: number;
  expected_hold_days?: number;
  expected_move_pct?: number;
  entry_rate?: number;
  stop?: number;
  target?: number;
  amount?: number;
  leverage?: number;
  risk_r?: number;
  rules_applied?: string[];
  exit_rate?: number;
  outcome_r?: number;
  outcome_usd?: number;
  exit_reason?: string;
  hold_days?: number;
  mae_r?: number;
  mfe_r?: number;
  thesis_correct?: boolean;
  error_category?: string;
  lesson?: string;
}

export interface EquityPoint {
  ts: string;
  equity: number;
  cash: number;
  unrealized_pnl: number;
  open_positions: number;
}

export interface BenchmarkPoint {
  ts: string;
  prices: Record<string, number | null>;
}

export interface RunRecord {
  run_id: string;
  cycle: string;
  started_at: string;
  ended_at?: string;
  duration_s?: number;
  equity?: number;
  cash?: number;
  open_positions?: number;
  trades_opened?: number;
  trades_closed?: number;
  no_trade_reason?: string | null;
  exit_code?: number;
}

export interface BotEvent {
  ts: string;
  run_id?: string;
  cycle?: string;
  type?: string;
  symbol?: string | null;
  reason?: string;
  detail?: unknown;
}

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

export interface Stats {
  generated_at?: string;
  overall?: Cohort;
  by_setup?: Record<string, Cohort>;
  by_signal?: Record<string, Cohort>;
  by_asset_class?: Record<string, Cohort>;
  by_conviction?: Record<string, Cohort>;
  rolling20_expectancy_r?: { trade_index: number; closed_at: string; expectancy_r: number }[];
  error_categories?: Record<string, number>;
  error_categories_by_month?: Record<string, Record<string, number>>;
  stop_and_exit_quality?: {
    avg_mae_r_of_winners: number | null;
    avg_mfe_r_of_losers: number | null;
  };
}

export interface Portfolio {
  ts?: string;
  cash?: number;
  invested?: number;
  unrealized_pnl?: number;
  equity?: number;
  open_positions?: number;
  positions?: OpenPosition[];
}

export interface OpenPosition {
  position_id: number;
  instrument_id?: number;
  symbol?: string;
  is_buy?: boolean;
  open_rate?: number;
  amount?: number;
  units?: number;
  leverage?: number;
  stop_loss?: number;
  take_profit?: number;
  opened_at?: string;
  unrealized_pnl?: number;
  setup?: string;
  thesis?: string;
  invalidation?: string;
  conviction?: number;
  target?: number;
  stop?: number;
  risk_r?: number;
}

export interface Rule {
  id: string;
  title: string;
  tier: string;
  n: number | null;
  updated: string | null;
  body: string;
  retired: boolean;
}
