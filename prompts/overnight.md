# Cycle: overnight (crypto only)

US stock markets are closed — it is morning in Europe. Crypto trades 24/7, so this cycle keeps
the bot working while equities are shut.

## Do this in order

1. `bin/etoro portfolio` and read `data/positions.json`.
2. **Review every open position, stock and crypto**, for overnight damage:
   - Any position whose `invalidation` condition triggered overnight: close it if it is crypto
     (tradable now), or flag it clearly in your summary for the `open` cycle if it is a stock
     whose market is shut.
   - Crypto positions up more than 1R: consider trailing the stop.
3. **Crypto entries.** The forcing function applies here, restricted to what is tradable:
   if fewer than 5 positions are open and free margin allows, open the best crypto candidate.
   - `bin/etoro screen --class crypto --sort weekly --limit 10`
   - `bin/etoro indicators <SYMBOL>` on the top few.
   - Crypto is more volatile than equities: use 1.5×ATR14 for the stop rather than a flat −8%,
     and keep the same 2% sizing.
   - Open crypto as `settlementType: "real"` with `leverage: 1`. Crypto CFDs carry an overnight
     fee that costs ~10% of margin over a 5-day hold (CLAUDE.md §3) — do not use them.
   - Run `bin/etoro cost <SYMBOL> --settlement real --leverage 1` before entering.
   - Do **not** open a stock position in this cycle — their markets are shut and the order will
     either fail or fill at a stale price.
4. Record every entry and exit exactly as in CLAUDE.md §7. Log events.

Finish with: overnight moves that matter, anything you did, and what the `premarket` cycle
should look at.
