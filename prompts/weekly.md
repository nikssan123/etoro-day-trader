# Cycle: weekly review (this is where the bot actually learns)

Markets are closed. No entries this cycle except crypto management. Your job is to convert this
week's trades into **rules that change future behaviour** — and to resist inventing rules the
evidence does not support.

## Do this in order

1. `bin/etoro stats` — read the full aggregates. Note the `tier` on every cohort; it is computed
   from sample size and is not negotiable.
2. `bin/etoro journal --last 60` and skim this week's postmortems in `strategy/postmortems/`.
3. Read the current `strategy/rules.md` and `strategy/hypotheses.md`.

## Then, in this order

### a. Review existing rules
For each active rule, look up its cohort in the fresh stats:
- Still supported at its tier → leave it, update `n` and the date.
- Cohort dropped below its tier, or the effect **flipped sign** → demote or retire it, and log
  `bin/etoro log-event --type rule_demoted` with the numbers that justify it.
A rule that survives only because nobody rechecked it is worse than no rule.

### b. Promote hypotheses that earned it
A hypothesis at n ≥ 10 becomes a `provisional` rule. A provisional rule at n ≥ 30 becomes
`established`. **Never skip a tier, and never promote on a smaller sample than the tier
requires** — `bin/etoro stats` prints the tier for exactly this reason.

### c. Look for new patterns
Compare cohorts against each other, not against zero. Useful questions:
- Which `setup` has the best and worst expectancy? Is the gap larger than the noise?
- Which `signals` tags appear disproportionately in losers?
- `stop_and_exit_quality.avg_mae_r_of_winners` — if winners routinely dip near −1R before
  working, the stops are too tight and are converting winners into losses.
- `avg_mfe_r_of_losers` — if losers routinely showed +1R first, exits are too slow.
- `by_conviction` — does conviction 5 actually beat conviction 2? If not, your self-assessment
  is noise and should stop influencing sizing. Say so plainly.
- `error_categories` — what is the single most common failure, and what rule would prevent it?

Anything with n < 10 goes in `hypotheses.md`, **not** `rules.md`.

### d. Write the changes
Update `strategy/rules.md` in the documented format, citing `n` and expectancy for every rule
you touch. Log a `rule_created` / `rule_promoted` / `rule_demoted` event for each change.
Keep the file under ~40 rules; drop the weakest if at the cap.

## Guard against fooling yourself

With only a few dozen trades, most apparent patterns are noise. A cohort of 6 trades with a
great win rate means nothing. The tier system exists because a confident, wrong rule is worse
than no rule at all — it will actively misdirect every future cycle. **If the week's evidence
supports no new rule, create no new rule and say so.** That is a successful review.

Also manage crypto positions as in the `overnight` cycle if any need attention.

Finish with: the week's expectancy in R, rules changed and why, the largest recurring error
category, and one concrete thing to do differently next week.
