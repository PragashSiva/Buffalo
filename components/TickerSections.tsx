"use client";

import { useEffect, useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { Trade } from "@/lib/types";

const RECENTS_KEY = "pt-recent-tickers";
const MAX_RECENTS = 8;
const MAX_SUGGESTIONS = 8;

interface Quote {
  price: number | null;
  changePct: number | null;
}

/** Curated liquid large caps / ETFs to suggest. */
const SUGGESTED: { symbol: string; sector: string }[] = [
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
const SECTORS: Record<string, string> = {
  ...Object.fromEntries(SUGGESTED.map((s) => [s.symbol, s.sector])),
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

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.toUpperCase())
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function saveRecents(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable — recents are ephemeral, ignore */
  }
}

/** Live quotes for a set of symbols via the app's /api/quote route.
 *  Refreshes every 60s. Never fakes a price — a failed fetch leaves "—". */
function useQuotes(symbols: string[]) {
  const key = [...symbols].sort().join(",");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    async function load() {
      const list = key.split(",").filter(Boolean);
      const entries = await Promise.all(
        list.map(async (s): Promise<[string, Quote]> => {
          try {
            const res = await fetch(`/api/quote?symbol=${encodeURIComponent(s)}`);
            if (!res.ok) return [s, { price: null, changePct: null }];
            const d = await res.json();
            const price = typeof d.price === "number" ? d.price : null;
            const changePct =
              price != null && typeof d.prevClose === "number" && d.prevClose
                ? ((price - d.prevClose) / d.prevClose) * 100
                : null;
            return [s, { price, changePct }];
          } catch {
            return [s, { price: null, changePct: null }];
          }
        })
      );
      if (!cancelled) setQuotes(Object.fromEntries(entries));
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return quotes;
}

function TickerCard({
  symbol,
  quote,
  active,
  tag,
  onSelect,
}: {
  symbol: string;
  quote: Quote | undefined;
  active: boolean;
  tag: string | null;
  onSelect: (s: string) => void;
}) {
  const q = quote ?? { price: null, changePct: null };
  return (
    <button
      onClick={() => onSelect(symbol)}
      className={`flex items-center justify-between border px-2 py-2 text-left ${
        active
          ? "border-amber-500 bg-amber-500/10"
          : "border-zinc-800 bg-zinc-950 hover:border-amber-500/60"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm font-bold text-amber-400">
          {symbol}
        </span>
        {tag && (
          <span className="block truncate text-[10px] uppercase tracking-wider text-zinc-500">
            {tag}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm text-zinc-100">{fmtMoney(q.price)}</span>
        <span
          className={`block font-mono text-xs ${
            q.changePct == null
              ? "text-zinc-500"
              : q.changePct >= 0
                ? "text-emerald-400"
                : "text-red-400"
          }`}
        >
          {fmtPct(q.changePct)}
        </span>
      </span>
    </button>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        {title}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

export default function TickerSections({
  currentSymbol,
  trades,
  watchlistSymbols,
  holdingSymbols,
  onSelect,
}: {
  currentSymbol: string;
  trades: Trade[];
  watchlistSymbols: string[];
  holdingSymbols: string[];
  onSelect: (s: string) => void;
}) {
  const [recents, setRecents] = useState<string[]>([]);

  // Hydrate recents from localStorage on mount.
  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  // Record every ticker loaded in the chart, most recent first.
  useEffect(() => {
    if (!currentSymbol) return;
    setRecents((prev) => {
      const next = [
        currentSymbol,
        ...prev.filter((s) => s !== currentSymbol),
      ].slice(0, MAX_RECENTS);
      saveRecents(next);
      return next;
    });
  }, [currentSymbol]);

  // Merge tickers from recent trades (most recent trade first) when the
  // trade history loads — appended after tickers actually viewed.
  useEffect(() => {
    if (trades.length === 0) return;
    const tradeSyms = [...trades]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((t) => t.symbol.toUpperCase())
      .filter((s, i, arr) => arr.indexOf(s) === i);
    setRecents((prev) => {
      const merged = [...prev];
      for (const s of tradeSyms) {
        if (!merged.includes(s)) merged.push(s);
      }
      const next = merged.slice(0, MAX_RECENTS);
      saveRecents(next);
      return next;
    });
  }, [trades]);

  // Suggestions: curated list minus anything already on screen, with
  // sector peers of current holdings ranked first.
  const heldSectors = new Set(
    holdingSymbols.map((s) => SECTORS[s]).filter((s): s is string => Boolean(s))
  );
  const excluded = new Set([
    currentSymbol,
    ...recents,
    ...watchlistSymbols.map((s) => s.toUpperCase()),
    ...holdingSymbols.map((s) => s.toUpperCase()),
  ]);
  const suggestions = SUGGESTED.filter((s) => !excluded.has(s.symbol))
    .sort((a, b) => {
      const aPeer = heldSectors.has(a.sector) ? 0 : 1;
      const bPeer = heldSectors.has(b.sector) ? 0 : 1;
      return aPeer - bPeer;
    })
    .slice(0, MAX_SUGGESTIONS);

  const quoteSymbols = [
    ...new Set([...recents, ...suggestions.map((s) => s.symbol)]),
  ];
  const quotes = useQuotes(quoteSymbols);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Recent">
        {recents.length === 0 ? (
          <p className="px-1 py-2 text-xs text-zinc-500">
            No recent tickers yet — open any ticker and it shows up here.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {recents.map((s) => (
              <TickerCard
                key={s}
                symbol={s}
                quote={quotes[s]}
                active={s === currentSymbol}
                tag={null}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Suggested">
        {suggestions.length === 0 ? (
          <p className="px-1 py-2 text-xs text-zinc-500">
            All suggestions are already in your lists.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {suggestions.map((s) => (
              <TickerCard
                key={s.symbol}
                symbol={s.symbol}
                quote={quotes[s.symbol]}
                active={s.symbol === currentSymbol}
                tag={
                  heldSectors.has(s.sector)
                    ? `${s.sector} · peer`
                    : s.sector
                }
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
