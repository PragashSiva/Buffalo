import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { fetchChart, normalizeSymbol } from "@/lib/market-data";
import { CURATED, SECTORS, computeSignal } from "@/lib/suggestions";
import type { Suggestion } from "@/lib/types";

const MAX_SUGGESTIONS = 8;
/** Twelve Data free tier: 800 calls/day, 8/min. One page load costs at
 *  most 8 chart calls; the 10-minute cache below means a reload inside
 *  that window costs none. */
const CACHE_TTL_MS = 10 * 60 * 1000;
/** Minimum gap between the *start* of consecutive chart fetches, so the
 *  burst stays inside the free tier's per-minute limit. */
const GAP_MS = 1000;

interface CacheEntry {
  at: number;
  data: Suggestion[];
}

const cache = new Map<string, CacheEntry>();

function parseList(v: string | null): Set<string> {
  return new Set(
    (v ?? "")
      .split(",")
      .map((s) => normalizeSymbol(s))
      .filter(Boolean)
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Rule-based trade ideas from real daily bars — no invented prices.
 * Takes holdings/watchlist/current/recents as query params, excludes
 * anything already on screen, ranks sector peers of holdings first, then
 * computes a LONG/SHORT/NEUTRAL signal per symbol from its 6M daily
 * bars (last close vs 20-day SMA + 5-day momentum; entry/target/stop
 * from the last close and the 20-day high/low). A symbol whose chart
 * fetch fails is skipped, not faked.
 */
export async function GET(req: NextRequest) {
  await connection(); // request-time only: never prerender at build
  const q = req.nextUrl.searchParams;
  const holdings = parseList(q.get("holdings"));
  const watchlist = parseList(q.get("watchlist"));
  const current = normalizeSymbol(q.get("current") ?? "");
  const recents = parseList(q.get("recents"));

  const excluded = new Set([
    ...holdings,
    ...watchlist,
    ...recents,
    ...(current ? [current] : []),
  ]);
  const heldSectors = new Set(
    [...holdings].map((s) => SECTORS[s]).filter(Boolean)
  );
  const ranked = CURATED.filter((c) => !excluded.has(c.symbol)).sort(
    (a, b) =>
      Number(heldSectors.has(b.sector)) - Number(heldSectors.has(a.sector))
  );
  const picks = ranked.slice(0, MAX_SUGGESTIONS);

  const cacheKey = JSON.stringify({
    h: [...holdings].sort(),
    w: [...watchlist].sort(),
    c: current,
    r: [...recents].sort(),
  });
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json({ suggestions: hit.data, cached: true });
  }

  const out: Suggestion[] = [];
  for (let i = 0; i < picks.length; i++) {
    const { symbol, sector } = picks[i];
    const startedAt = Date.now();
    try {
      const chart = await fetchChart(symbol, "6M");
      const sig = computeSignal(chart.points);
      if (sig) {
        out.push({
          symbol,
          sector,
          peer: heldSectors.has(sector),
          ...sig,
        });
      }
    } catch (err) {
      // Skip this symbol gracefully and return the rest — never fake it.
      console.error(`suggestions: ${symbol} failed`, err);
    }
    if (i < picks.length - 1) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < GAP_MS) await sleep(GAP_MS - elapsed);
    }
  }
  cache.set(cacheKey, { at: Date.now(), data: out });
  return Response.json({ suggestions: out, cached: false });
}
