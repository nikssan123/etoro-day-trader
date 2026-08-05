# Cycle: monthly review (is the decision-making actually improving?)

Markets are closed. This cycle answers one question honestly: **is the bot getting better at
deciding, or is it just riding the market?**

## Do this in order

1. `bin/etoro stats` — full aggregates.
2. Read `data/equity.jsonl` and `data/benchmark.jsonl` (the last ~200 lines of each are enough).
3. Read `strategy/rules.md` and the last month of postmortems.

## The improvement report

Equity going up is **not** evidence of improvement — a rising market lifts a bad strategy.
Judge on these instead, and state each with its number:

1. **Rolling 20-trade expectancy in R** (`rolling20_expectancy_r`). This is the headline. Is the
   series trending up, flat, or down? With few trades, say explicitly when the trend is not yet
   distinguishable from noise.
2. **Excess return vs. benchmark.** Compare account equity change over the month against SPX500,
   NSDQ100 and BTC from `benchmark.jsonl`. If the account is up 4% while the index is up 6%, the
   bot is losing to doing nothing — say that plainly.
3. **Error-category distribution over time** (`error_categories_by_month`). This is the most
   direct evidence the loop works: after a rule targeting an error goes `established`, that
   error's count should fall in following months. If it has not, the rule is not working and
   should be revised or retired.
4. **Conviction calibration** (`by_conviction`). Does high conviction actually predict better
   outcomes? If not, say so and stop letting conviction drive sizing.
5. **Rule inventory health.** How many rules at each tier? How many were retired? A file full of
   `provisional` rules that never reach `established` means cohorts are too fragmented — likely
   inconsistent `signals` tag spellings. Check for that specifically.

## Then

- Revise `strategy/rules.md`: prune anything stale, consolidate near-duplicates, fix
  tag-fragmentation by standardizing signal names going forward.
- Consider whether the **mandate itself** should change (position count, sizing, stop distance,
  hold period) and recommend it explicitly — but change mandate parameters in `CLAUDE.md` only
  where the data supports it, and note what you changed and why.
- Write the report to `strategy/postmortems/YYYY-MM-monthly-review.md`.

## Be blunt

If the bot is not improving, say so and diagnose why. Plausible causes worth checking: too few
trades to learn from, fragmented cohorts, rules created on noise, a strategy edge that does not
exist, or a market regime that changed underneath the rules. An honest negative report is worth
far more than an optimistic one — it is the only way the next month gets better.

Finish with: the improvement verdict in one paragraph, backed by the five numbers above.
