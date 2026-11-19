import type { ChartData as ChartResult } from "./types";

export type { ChartResult };

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const RANGES: Record<string, { range: string; interval: string; stooqDays: number }> = {
  "1D": { range: "1d", interval: "1m", stooqDays: 0 },
  "5D": { range: "5d", interval: "5m", stooqDays: 5 },
  "1M": { range: "1mo", interval: "1d", stooqDays: 22 },
  "6M": { range: "6mo", interval: "1d", stooqDays: 126 },
  "1Y": { range: "1y", interval: "1d", stooqDays: 252 },
};

/** Keep only characters Yahoo accepts in a ticker; uppercase. */
export function normalizeSymbol(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-^]/g, "")
    .slice(0, 12);
}

async function yahooChart(symbol: string, range: string, interval: string): Promise<ChartResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, { headers: UA, next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Yahoo Finance returned HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo Finance returned no data for ${symbol}`);
  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const points: { t: number; close: number }[] = [];
  timestamps.forEach((t, i) => {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) points.push({ t: t * 1000, close: c });
  });
  if (points.length === 0) throw new Error(`Yahoo Finance returned no price points for ${symbol}`);
  const meta = result.meta ?? {};
  return {
    symbol,
    name: meta.shortName ?? meta.longName ?? null,
    currency: meta.currency ?? null,
    price:
      typeof meta.regularMarketPrice === "number"
        ? meta.regularMarketPrice
        : points[points.length - 1].close,
    prevClose: typeof meta.previousClose === "number" ? meta.previousClose : null,
    points,
    source: "yahoo",
  };
}

/** Daily-bars fallback (no API key). Stooq only covers US listings with a ".US" suffix. */
async function stooqDaily(symbol: string, days: number): Promise<ChartResult> {
  const stooqSym = symbol.toLowerCase().includes(".")
    ? symbol.toLowerCase()
    : `${symbol.toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=d`;
  const res = await fetch(url, { headers: UA, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Stooq returned HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1);
  const rows = lines
    .map((l) => {
      const [date, , , , close] = l.split(",");
      return { t: new Date(`${date}T16:00:00Z`).getTime(), close: Number(close) };
    })
    .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.close));
  const points = rows.slice(-days);
  if (points.length === 0) throw new Error(`Stooq returned no data for ${symbol}`);
  const price = points[points.length - 1].close;
  const prevClose = points.length > 1 ? points[points.length - 2].close : null;
  return { symbol, name: null, currency: "USD", price, prevClose, points, source: "stooq" };
}

/**
 * Line-chart history for a symbol. Yahoo first; Stooq daily bars as a
 * fallback for multi-day ranges. Throws on failure — callers must surface
 * the error, never invent a price.
 */
export async function fetchChart(symbol: string, rangeKey: string): Promise<ChartResult> {
  const cfg = RANGES[rangeKey] ?? RANGES["1M"];
  try {
    return await yahooChart(symbol, cfg.range, cfg.interval);
  } catch (err) {
    if (cfg.stooqDays > 0) return await stooqDaily(symbol, cfg.stooqDays);
    throw err;
  }
}

/** Latest tradable price for an order fill. Same sources, same no-faking rule. */
export async function fetchQuote(symbol: string): Promise<{
  price: number;
  prevClose: number | null;
  name: string | null;
}> {
  try {
    const c = await yahooChart(symbol, "1d", "1m");
    if (c.price == null) throw new Error("No price");
    return { price: c.price, prevClose: c.prevClose, name: c.name };
  } catch {
    const s = await stooqDaily(symbol, 2);
    if (s.price == null) throw new Error("No price");
    return { price: s.price, prevClose: s.prevClose, name: null };
  }
}
