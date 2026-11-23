# btc-race-24h-20261123-0511b

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/faj17/btc-race-24h-20261123-0511b/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/faj17/btc-race-24h-20261123-0511b/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Momentum-ride cbBTC trading bot for make.fun's "Race a BTC trading bot live
for 24 hours" bounty ($50 in USDC). Long-only, one position, full cash, at
most one round trip per window: enters on a confirmed 60-minute uptrend in
cbBTC, rides it to the end of the window, and exits only on a hard stop
(-1.2% from cost basis).

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=tzsn25v9&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>

## Strategy

Long-only, one position, full cash, at most one round trip per window. Enters
on a confirmed 60-minute uptrend in cbBTC, rides it to the end of the window,
and exits only on a hard stop (-1.2% from cost basis). A last-resort rule with
a relaxed threshold fires only if no trade has been sent by bar 1080, so a
quiet day still meets the race's "at least 1 trade" guardrail.

- Entry: 60m return ≥ +0.3%
- Exit: -1.2% from cost basis (fees included); otherwise hold to the window end
- Max slippage 100 bps per order; at most 16 orders/reply (uses 1)

A trailing-stop variant was tested and rejected: on the dev window it exits
mid-surge and re-enters in chop (+$23.74 vs +$32.24 here), and a 40-copy
1-hour-block bootstrap of it has a negative median PnL with most copies
losing, while this design's bootstrap median is +$11.87..+$22.63 with 9–17 of
40 copies losing.

## Dev-window result

Graded locally with the kit (`grade-local --driver process`) on the frozen
24h dev window (2026-11-22 05:11 UTC → 2026-11-23 05:11 UTC): net PnL
+$32.24, 1 trade, max drawdown 1.98% — passing the dev gate (net PnL > $0).
Neighbouring entry thresholds (+0.5%/+0.7% over 60m) give +$29.50/+$29.56,
so the result is a plateau, not a point optimum. On the same window
buy-and-hold makes +$32.17 and the house momentum baseline +$34.94, while
ema-cross loses -$114.83 (76 trades), rsi-bollinger -$9.32 and
adx-momentum -$11.20.

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript, stdlib only)
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's bars-replay SDK shim
- `LICENSE` — MIT
