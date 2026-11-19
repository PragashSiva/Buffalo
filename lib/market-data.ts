import type { ChartData as ChartResult } from "./types";

export type { ChartResult };

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

/** Optional Finnhub key (free tier). Used for the fast quote (order fills);
 *  its candle endpoint is NOT on the free plan, so charts do not use it
 *  unless the key is a paid one. Get one free at finnhub.io. */
const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";

/** Optional Twelve Data key (free tier: 800 calls/day, 8/min). The chart
 *  source: 1h and 1day candles are included free. Get one at twelvedata.com. */
const TWELVEDATA_KEY = process.env.TWELVEDATA_API_KEY ?? "";

/** Twelve Data datetimes are wall times in the exchange timezone
 *  (America/New_York for US listings). Convert one to epoch ms so the
 *  browser — also in ET for this user — labels the hours correctly. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour % 24,
    +parts.minute,
    +parts.second
  );
  return asUTC - date.getTime();
}

function wallTimeToMs(wall: string, timeZone: string): number {
  const [datePart, timePart = "00:00:00"] = wall.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  return guess - tzOffsetMs(new Date(guess), timeZone);
}

async function twelvedataChart(symbol: string, rangeKey: string): Promise<ChartResult> {
  if (!TWELVEDATA_KEY) throw new Error("Twelve Data key not configured");
  // Hourly for short ranges, daily for long ones — this app trades
  // hourly/daily moves, not minute bars.
  const cfg: Record<string, { interval: string; outputsize: number }> = {
    "1D": { interval: "1h", outputsize: 24 },
    "5D": { interval: "1h", outputsize: 48 },
    "1M": { interval: "1day", outputsize: 31 },
    "6M": { interval: "1day", outputsize: 130 },
    "1Y": { interval: "1day", outputsize: 260 },
  };
  const { interval, outputsize } = cfg[rangeKey] ?? cfg["1M"];
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVEDATA_KEY}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Twelve Data returned HTTP ${res.status}`);
  const json = await res.json();
  if (json?.status !== "ok" || !Array.isArray(json.values) || json.values.length === 0)
    throw new Error(`Twelve Data returned no data for ${symbol}: ${json?.message ?? "unknown"}`);
  const tz = json.meta?.exchange_timezone ?? "America/New_York";
  const points: { t: number; close: number }[] = (json.values as any[])
    .map((v) => ({ t: wallTimeToMs(v.datetime, tz), close: Number(v.close) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.close))
    .sort((a, b) => a.t - b.t);
  if (points.length === 0) throw new Error(`Twelve Data returned no price points for ${symbol}`);
  return {
    symbol,
    name: null,
    currency: json.meta?.currency ?? "USD",
    price: points[points.length - 1].close,
    prevClose: points.length > 1 ? points[points.length - 2].close : null,
    points,
    source: "twelvedata",
  };
}

async function finnhubChart(symbol: string, rangeKey: string): Promise<ChartResult> {
  if (!FINNHUB_KEY) throw new Error("Finnhub key not configured");
  const cfg: Record<string, { resolution: string; seconds: number }> = {
    "1D": { resolution: "1", seconds: 86400 },
    "5D": { resolution: "5", seconds: 5 * 86400 },
    "1M": { resolution: "D", seconds: 30 * 86400 },
    "6M": { resolution: "D", seconds: 180 * 86400 },
    "1Y": { resolution: "D", seconds: 365 * 86400 },
  };
  const { resolution, seconds } = cfg[rangeKey] ?? cfg["1M"];
  const to = Math.floor(Date.now() / 1000);
  const from = to - seconds;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
    symbol
  )}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
  const res = await fetch(url, { next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Finnhub returned HTTP ${res.status}`);
  const json = await res.json();
  if (json?.s !== "ok" || !Array.isArray(json.c) || json.c.length === 0)
    throw new Error(`Finnhub returned no data for ${symbol}`);
  const points: { t: number; close: number }[] = (json.t as number[])
    .map((t, i) => ({ t: t * 1000, close: json.c[i] as number }))
    .filter((p) => Number.isFinite(p.close));
  if (points.length === 0) throw new Error(`Finnhub returned no price points for ${symbol}`);
  return {
    symbol,
    name: null,
    currency: "USD",
    price: points[points.length - 1].close,
    prevClose: points.length > 1 ? points[points.length - 2].close : null,
    points,
    source: "finnhub",
  };
}

async function finnhubQuote(symbol: string): Promise<{
  price: number;
  prevClose: number | null;
  name: string | null;
}> {
  if (!FINNHUB_KEY) throw new Error("Finnhub key not configured");
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
    symbol
  )}&token=${FINNHUB_KEY}`;
  const res = await fetch(url, { next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Finnhub returned HTTP ${res.status}`);
  const json = await res.json();
  if (typeof json?.c !== "number" || json.c === 0)
    throw new Error(`Finnhub returned no price for ${symbol}`);
  return { price: json.c, prevClose: typeof json.pc === "number" ? json.pc : null, name: null };
}

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

async function yahooChart(
  symbol: string,
  range: string,
  interval: string,
  host = "query1.finance.yahoo.com"
): Promise<ChartResult> {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
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
 * Line-chart history for a symbol. Twelve Data first (1h bars for short
 * ranges, daily bars for long ones — this app trades hourly/daily moves);
 * then Finnhub candles (paid plans only), Yahoo (query1, then query2),
 * then Stooq daily bars for multi-day ranges.
 * Throws on failure — callers must surface the error, never invent a price.
 */
export async function fetchChart(symbol: string, rangeKey: string): Promise<ChartResult> {
  const cfg = RANGES[rangeKey] ?? RANGES["1M"];
  if (TWELVEDATA_KEY) {
    try {
      return await twelvedataChart(symbol, rangeKey);
    } catch {
      // fall through to the next source
    }
  }
  if (FINNHUB_KEY) {
    try {
      return await finnhubChart(symbol, rangeKey);
    } catch {
      // fall through to Yahoo
    }
  }
  try {
    return await yahooChart(symbol, cfg.range, cfg.interval, "query1.finance.yahoo.com");
  } catch {
    try {
      return await yahooChart(symbol, cfg.range, cfg.interval, "query2.finance.yahoo.com");
    } catch {
      if (cfg.stooqDays > 0) return await stooqDaily(symbol, cfg.stooqDays);
      throw new Error(`Live price data for ${symbol} is unavailable right now`);
    }
  }
}

/** Latest tradable price for an order fill. Same sources, same no-faking rule. */
export async function fetchQuote(symbol: string): Promise<{
  price: number;
  prevClose: number | null;
  name: string | null;
}> {
  if (FINNHUB_KEY) {
    try {
      return await finnhubQuote(symbol);
    } catch {
      // fall through to Yahoo
    }
  }
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const c = await yahooChart(symbol, "1d", "1m", host);
      if (c.price == null) throw new Error("No price");
      return { price: c.price, prevClose: c.prevClose, name: c.name };
    } catch {
      // try the next host, then Stooq
    }
  }
  const s = await stooqDaily(symbol, 2);
  if (s.price == null) throw new Error("No price");
  return { price: s.price, prevClose: s.prevClose, name: null };
}
