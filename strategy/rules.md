# Learned trading rules

This file is **written by the bot**, by the `weekly` cycle, from the evidence in
`data/stats.json`. It is loaded into every trading cycle and is the mechanism by which
experience changes behaviour.

## How rules work

Every rule carries its evidence and a tier. The tier is a function of sample size **only** —
it is not a judgement call, and the weekly cycle may not promote a rule the sample does not
support:

| Tier | Sample | Power |
|---|---|---|
| `hypothesis` | n < 10 | Lives in `hypotheses.md`. **Changes nothing.** |
| `provisional` | n ≥ 10 | May adjust ranking and position sizing. **May not veto a trade.** |
| `established` | n ≥ 30 | May veto a setup outright. |

`bin/etoro stats` labels every cohort with its tier, so the threshold is mechanical.

Rules are **retired** as well as created: if fresh data drops a rule's cohort below its tier or
flips its sign, demote it and log a `rule_demoted` event. Cap this file at ~40 rules so it stays
loadable in every run; when at the cap, drop the weakest.

Format:

```
### R-001 — <one-line imperative>   [tier, n=NN, updated YYYY-MM-DD]
Evidence: <cohort stats that justify it, with the comparison cohort>
Action: <exactly what to do differently>
```

---

## Active rules

*None yet — the bot has no closed trades. The first rules can appear after the first `weekly`
cycle, and none can reach `established` until a cohort reaches 30 closed trades.*

## Retired rules

*None yet.*
