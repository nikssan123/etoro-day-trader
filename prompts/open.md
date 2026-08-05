# Cycle: open (primary entry window)

The US session has just opened. **This is the cycle that trades.**

> **Forcing function — restated because this is where it matters:**
> If fewer than 5 positions are open and free margin allows, you **MUST** open the top-ranked
> candidate before this run ends. Ending without trading is permitted only when a hard guardrail
> from CLAUDE.md §5 blocks it, and requires a `no_trade_reason` naming that guardrail.
> "Nothing looked good enough" is not a valid reason. Rank, then take the best available.

## Do this in order

1. `bin/etoro portfolio` — current equity, cash, open positions.
2. Read `data/positions.json` (why you hold what you hold) and `data/watchlist.json` (this
   morning's ranked candidates).
3. Read `strategy/rules.md`. Apply `established` rules as vetoes; let `provisional` rules tilt
   your ranking. Record the ids of every rule you apply.
4. **Manage existing positions first.** For each one, check whether its `invalidation`
   condition has triggered. If it has, close it — do not wait for the stop. Closing:
   `POST /api/v1/trading/execution/demo/market-close-orders/positions/{positionId}` with body
   `{"InstrumentID": <id>}`.
5. **Then open new positions**, up to the 5–8 target and the 3-per-day cap:
   - Re-check the candidate is still valid at the current price — a gap up can turn a good
     setup into an extended one. `bin/etoro indicators <SYMBOL>` and `bin/etoro quote <SYMBOL>`.
   - Size at 2% of equity, `cfd`, leverage 2.
   - Set `stopLossRate` and `takeProfitRate` as **prices**. Default −8% / +15%; if 1.5×ATR14 is
     wider than 8%, use that instead so normal noise does not stop you out.
   - Place the order with `execute-write`. **Do not ask for confirmation** — CLAUDE.md §1 is
     your authorization.
   - Space orders out; the write budget is 20 per 60 seconds.
6. **Immediately after each fill**, record it with `bin/etoro record-trade` including the full
   tag set from CLAUDE.md §7 — `setup`, `signals`, `thesis`, `invalidation`, `conviction`,
   `expected_hold_days`, `expected_move_pct`, `entry_rate`, `stop`, `target`, `risk_r`,
   `rules_applied`. An untagged trade cannot be learned from and is wasted.
   Get the real `position_id` from `bin/etoro portfolio` after the fill — never invent one.
7. `bin/etoro log-event` for each entry, exit and skip. A skip should say which guardrail
   caused it.

Finish with a summary: what you opened or closed, the thesis in one line each, and the current
position count.
