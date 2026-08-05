# Cycle: midday (position management + remaining entries)

The US session is roughly half over. Priority is managing what you hold; entries are secondary
but still required if you are under target.

## Do this in order

1. `bin/etoro portfolio` and read `data/positions.json`.
2. For **each open position**, decide explicitly — and say which it is:
   - **Hold** — thesis intact, still developing.
   - **Close** — the `invalidation` condition has triggered, or the thesis has played out early.
     Do not wait for a stop that is now clearly wrong.
   - **Trail the stop** — if the position is up more than 1R, consider raising the stop to
     break-even or trailing it below the recent swing low, via
     `PATCH /api/v2/trading/demo/positions/{positionId}`. Raising a stop on a winner is
     usually right; loosening a stop on a loser never is. **Never widen a stop to avoid a loss.**
3. If fewer than 5 positions are open, free margin allows, and the daily 3-entry cap is not
   spent: take the best remaining candidate from `data/watchlist.json`, re-validating it at the
   current price first. The forcing function applies to this cycle too.
4. Record every exit with `bin/etoro record-trade` including `outcome_r`, `exit_reason`,
   `thesis_correct`, `error_category` and a specific `lesson`. Write the postmortem file too.
5. `bin/etoro log-event` for each decision, including holds worth noting.

Finish with a one-line status per open position and any action taken.
