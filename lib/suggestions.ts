import { fmtMoney } from "./format";
import type { ChartPoint, Suggestion } from "./types";

/** Curated liquid large caps / ETFs to suggest. */
export const CURATED: { symbol: string; sector: string }[] = [
  { symbol: "MSFT", sector: "Software" },
  { symbol: "GOOGL", sector: "Internet" },
  { symbol: "AMZN", sector: "E-commerce" },
  { symbol: "META", sector: "Internet" },
  { symbol: "AMD", sector: "Semis" },
  { symbol: "AVGO", sector: "Semis" },
  { symbol: "TSLA", sector: "EV" },
  { symbol: "JPM", sector: "Banks" },
  { symbol: "V", sector: "Payments" },
  { symbol: "NFLX", sector: "Media" },
  { symbol: "XOM", sector: "Energy" },
  { symbol: "UNH", sector: "Health" },
];

/** Sector lookup for symbols the user may already hold, so sector peers
 *  of holdings can be ranked first in the suggestions. */
export const SECTORS: Record<string, string> = {
  ...Object.fromEntries(CURATED.map((s) => [s.symbol, s.sector])),
  AAPL: "Hardware",
  NVDA: "Semis",
  SPY: "ETF",
  QQQ: "ETF",
  DIA: "ETF",
  IWM: "ETF",
  CRM: "Software",
  ORCL: "Software",
  INTC: "Semis",
  MU: "Semis",
  LLY: "Health",
  JNJ: "Health",
  BAC: "Banks",
  GS: "Banks",
  MA: "Payments",
  COST: "Retail",
  WMT: "Retail",
  HD: "Retail",
  DIS: "Media",
  PLTR: "Software",
  COIN: "Crypto",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Rule-based signal from daily closes — real numbers only, nothing
 * invented. Bias from last close vs 20-day SMA plus 5-day momentum;
 * target/stop from the 20-day high/low, with small % fallbacks when the
 * high/low is on the wrong side of the entry. Returns null when there
 * isn't enough history to compute a signal.
 */
export function computeSignal(
  points: ChartPoint[]
): Omit<Suggestion, "symbol" | "sector" | "peer"> | null {
  const closes = points
    .map((p) => p.close)
    .filter((c) => Number.isFinite(c));
  if (closes.length < 21) return null;

  const last = closes[closes.length - 1];
  const last20 = closes.slice(-20);
  const sma20 = last20.reduce((a, b) => a + b, 0) / last20.length;
  const prev5 = closes[closes.length - 6];
  const momentum5 = ((last - prev5) / prev5) * 100;
  const high20 = Math.max(...last20);
  const low20 = Math.min(...last20);

  const bias: Suggestion["bias"] =
    last > sma20 && momentum5 > 0
      ? "LONG"
      : last < sma20 && momentum5 < 0
        ? "SHORT"
        : "NEUTRAL";

  let target: number;
  let stop: number;
  if (bias === "LONG") {
    target = high20 > last ? high20 : last * 1.02;
    stop = low20 < last ? low20 : last * 0.98;
  } else if (bias === "SHORT") {
    target = low20 < last ? low20 : last * 0.98;
    stop = high20 > last ? high20 : last * 1.02;
  } else {
    target = high20 > last ? high20 : last * 1.02;
    stop = low20 < last ? low20 : last * 0.98;
  }

  let strategy: string;
  if (bias === "LONG") {
    if (last >= high20 * 0.995) strategy = "Breakout";
    else if (last <= sma20 * 1.02) strategy = "Pullback";
    else strategy = "Trend follow";
  } else if (bias === "SHORT") {
    if (last <= low20 * 1.005) strategy = "Breakdown";
    else if (last >= sma20 * 0.98) strategy = "Pullback";
    else strategy = "Trend follow";
  } else {
    strategy = "Range";
  }

  const dir =
    bias === "LONG" ? "above" : bias === "SHORT" ? "below" : "near";
  const momWord = momentum5 >= 0 ? "up" : "down";
  // Only claim "near/at" a high/low when the close is actually within
  // ~0.5% of it — otherwise state where it sits relative to the level.
  const nearWord =
    bias === "LONG"
      ? last >= high20 * 0.995
        ? `testing the 20-day high ${fmtMoney(high20)}`
        : `below the 20-day high ${fmtMoney(high20)}`
      : bias === "SHORT"
        ? last <= low20 * 1.005
          ? `at the 20-day low ${fmtMoney(low20)}`
          : `above the 20-day low ${fmtMoney(low20)}`
        : `inside the 20-day range ${fmtMoney(low20)}–${fmtMoney(high20)}`;
  const rationale =
    `Close ${fmtMoney(last)} ${dir} its 20-day average ${fmtMoney(sma20)}, ` +
    `${momWord} ${Math.abs(momentum5).toFixed(2)}% over 5 days; ${nearWord}.`;

  return {
    bias,
    strategy,
    entry: round2(last),
    target: round2(target),
    stop: round2(stop),
    rationale,
    lastBar: new Date(points[points.length - 1].t)
      .toISOString()
      .slice(0, 10),
  };
}
