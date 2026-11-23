// Momentum-ride bot for btc-race-24h-20261123-0511: trades cbBTC (CBBTC) on
// 1-minute Orca Whirlpool bars, long only, one position, full cash, at most
// one round trip per window.
//
// Dev window (2026-11-22 05:11 UTC -> 2026-11-23 05:11 UTC, 1440 bars):
//   - BTC +3.64% over the window, but the move is one surge, not a steady
//     climb: flat for 3h, +0.83% in hour 3, +2.29% in hour 4, then 20h of
//     choppy sideways drift (+/-0.5% per hour). Buy-and-hold makes +$32.17,
//     the house momentum baseline +$34.94 (1 trade); every mean-reversion /
//     high-frequency baseline loses (ema-cross -$114.83 on 76 trades,
//     rsi-bollinger -$9.32, adx-momentum -$11.20). Fees + slippage + own
//     price impact cost ~26 bps per full-size round trip, so frequent trading
//     is a guaranteed loss and a trade must catch a move well above that.
//   - Two designs were graded on this window (grade-local, --driver process):
//       * trailing-stop trend bot (enter on 60m momentum, 0.6% trail, up to
//         2 round trips): +$23.74, maxDD 1.46%. A 40-copy 1h-block bootstrap
//         of it gives median -$5.69..-$7.27 with 25-27/40 copies losing:
//         it only works when the window has one clean surge to ride and
//         bleeds fees in chop, so it was rejected.
//       * this bot (enter on 60m momentum, hold to the end, hard stop only):
//         +$32.24, maxDD 1.98%, 1 trade. The same bootstrap gives median
//         +$11.87..+$22.63 with 9-17/40 copies losing. Neighbouring entries
//         (60m +0.5%/+0.7%) give +$29.50/+$29.56, so the result is a plateau,
//         not a point optimum. The 1.98% maxDD is the window's own dip while
//         holding (buy-and-hold shows the same 1.98%); the hard stop bounds
//         the race-window loss to ~1.2% below entry plus costs.
//   - The hard stop is the only exit: once in, the bot rides the trend to
//     the end of the window. A trailing stop was tested and removed: on this
//     window it exits mid-surge and re-enters in chop, paying round-trip
//     costs for no gain (+$23.74 vs +$32.24).
//   - A last-resort rule fires only if the bot has not traded by bar 1080
//     (6h left): a relaxed momentum threshold, so a quiet race day still
//     meets the "at least 1 trade" guardrail. It never fires on the dev
//     window (the bot trades there), so it cannot change the dev grade.
//
// All decisions are pure functions of the closes seen so far: no clock, no
// randomness, no network, no files. Two runs on the same bars give the same
// orders, byte for byte.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** 60-minute lookback for the trend. */
const LOOKBACK = 60;
/** Entry: 60m close-to-close rise of at least 0.3%. */
const ENTRY_BPS = 30;
/** Exit: hard stop, 1.2% below the cost basis. */
const STOP_BPS = 120;
/** Max round trips per window (fee discipline: one conviction trade). */
const MAX_TRADES = 1;
/** Last-resort (no trade yet by bar 1080): relaxed entry threshold. */
const LATE_BAR = 1080;
const LATE_ENTRY_BPS = 25;
/** Slippage cap per order, 1% past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, in batch order (one per CBBTC bar). */
const closes: number[] = [];
/** Round trips completed. */
let trades = 0;

/** Cost basis in USDC per BTC: cost (quote units, fees included) / qty. */
function entryPrice(state: BarsState, symbol: string): number | null {
  const held = state.positions.get(symbol);
  if (held === undefined) return null;
  return Number(held.cost) / 1e6 / (Number(held.qty) / 1e8);
}

await runBars({
  onBatch(state, batch) {
    const scale = state.symbols.get(SYMBOL)?.price_scale ?? 5;
    for (const bar of batch.bars) {
      // Store closes in USDC per BTC (raw price / 10^price_scale), so they are
      // on the same scale as entryPrice() below. Ratios are scale-free, but
      // the exit compares a close against the cost basis, which is in USDC.
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c) / 10 ** scale);
    }
    if (state.warmingUp) return [];
    const n = closes.length;
    if (n === 0) return [];
    const close = closes[n - 1];
    const held = state.positions.get(SYMBOL);

    if (held !== undefined) {
      const entry = entryPrice(state, SYMBOL);
      if (entry === null) return [];
      const fromEntryBps = (close / entry - 1) * 10000;
      if (fromEntryBps <= -STOP_BPS) {
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    if (n <= LOOKBACK || trades >= MAX_TRADES) return [];
    const late = trades === 0 && n > LATE_BAR;
    const entryBps = late ? LATE_ENTRY_BPS : ENTRY_BPS;
    const trend = (close / closes[n - 1 - LOOKBACK] - 1) * 10000;
    if (trend >= entryBps) {
      const cash = state.cash;
      if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      trades += 1;
      const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
      return [buy];
    }
    return [];
  },
});
