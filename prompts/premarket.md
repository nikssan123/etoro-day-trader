# Cycle: premarket (research)

US markets are closed. This cycle does **research only** — it does not open stock positions.
Its job is to hand the `open` cycle a ranked, reasoned watchlist so that entry decisions are
made from prepared work rather than improvised in the first minutes of the session.

## Do this in order

1. `bin/etoro universe --refresh` — rebuild the instrument cache (takes ~2 minutes; this is the
   one cycle that should pay that cost).
2. `bin/etoro portfolio` and read `data/positions.json` — know what you already hold and why.
3. Read `strategy/rules.md`. Note which rules are `established` (they veto) and which are
   `provisional` (they only tilt ranking).
4. `bin/etoro screen --class stock --sort monthly --limit 25` and
   `bin/etoro screen --class crypto --sort weekly --limit 10`.
5. For the 8–12 most interesting names, run `bin/etoro indicators <SYMBOL>`. Look for a real
   setup, not just a big number: trend structure, distance from SMA20 (extended entries are a
   known way to lose), RSI, ATR as a stop guide, volume confirmation.
6. Use `WebSearch` for anything that would change the read: earnings this week, sector news,
   macro events, obvious catalysts. Check earnings dates — holding through an earnings print is
   a coin flip, not a thesis.
7. Rank the candidates and write `data/watchlist.json`:

```json
{"updated_at": "<ISO-8601 UTC>",
 "candidates": [
   {"symbol": "NVDA", "instrument_id": 1137, "asset_class": "stock", "score": 8.5,
    "setup": "breakout", "signals": ["above_sma50", "rsi_62", "vol_2x"],
    "thesis": "...", "invalidation": "...", "stop": 198.1, "target": 247.6,
    "conviction": 3, "notes": "earnings 2026-08-20, exit before"}]}
```

Rank at least 8 candidates. The `open` cycle is required to trade, so leaving it a thin or
low-quality list guarantees a bad entry — this list is where trade quality is actually decided.

8. Log one event: `bin/etoro log-event --run-id <RUN_ID> --cycle premarket --type note
   --reason "watchlist rebuilt, N candidates"`.

## Also

If any open position's thesis has been invalidated by overnight news, say so explicitly in your
summary and flag it for the `open` cycle to close.

Finish with a short summary: the top 3 candidates and why, plus anything that changes the
outlook for what you already hold.
