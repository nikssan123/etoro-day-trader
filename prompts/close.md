# Cycle: close (end of US session — this cycle owns the learning)

The US session is about to end. Two jobs: final risk decisions, then **grade every trade that
closed today**. The grading is the more important of the two — it is the raw material the
weekly review turns into rules.

## Do this in order

1. `bin/etoro portfolio` and `bin/etoro history --since <today>` to see what closed today,
   including positions closed automatically by their stop or take-profit.
2. **Risk decisions:**
   - Close anything whose thesis has been invalidated rather than carrying it overnight.
   - Apply the time stop: anything held past 15 trading days and not up 5% gets closed.
   - Confirm every remaining open position still has a stop-loss set. A position without a stop
     is an unbounded risk — fix it via `PATCH /api/v2/trading/demo/positions/{positionId}`.
3. **Grade every trade that closed today** — winners as well as losers. For each, call
   `bin/etoro record-trade` with `status: "closed"` and:
   - `exit_rate`, `outcome_r`, `outcome_usd`, `hold_days`, `exit_reason`
   - `thesis_correct` — did the thing you predicted actually happen?
   - `error_category` — exactly one of `thesis_wrong`, `late_entry`, `stop_too_tight`, `sizing`,
     `exit_too_early`, `market_regime`, `execution`, `none`
   - `lesson` — one or two specific, actionable sentences. "Be more careful" is useless.
     "Entered 9% above SMA20 and got stopped on the first pullback" is useful.
   - For MAE/MFE, read the position's samples in `data/excursions.jsonl` (grep by
     `position_id`) — the worst and best unrealized points tell you whether the stop was too
     tight or the exit too slow. Include `mae_r` and `mfe_r`.
4. Write `strategy/postmortems/YYYY-MM-DD-SYMBOL.md` for each closed trade: what you expected,
   what happened, what you would do differently, and — for winners — what specifically worked so
   it can be repeated.
5. `bin/etoro stats --quiet` to refresh the aggregates.
6. `bin/etoro benchmark` to record the reference assets.

## Be honest

Grade your own decisions strictly. A loss labelled `market_regime` when it was really
`late_entry` corrupts the statistics and will teach the next run the wrong lesson. If you were
wrong, write that you were wrong.

Finish with: today's realized PnL in R, the day's trades and their grades, and the single
biggest recurring mistake you can see so far.
