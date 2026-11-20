"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { Suggestion, Trade } from "@/lib/types";

const RECENTS_KEY = "pt-recent-tickers";
const MAX_RECENTS = 8;

interface Quote {
  price: number | null;
  changePct: number | null;
}

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
 *  Refreshes every 60s. Never fakes a price — a failed fetch leaves "—".
 *  Prices may keep updating; only the cards' order and membership are
 *  frozen (see below). */
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

function SuggestionCard({
  suggestion,
  quote,
  active,
  onSelect,
}: {
  suggestion: Suggestion;
  quote: Quote | undefined;
  active: boolean;
  onSelect: (s: string) => void;
}) {
  const q = quote ?? { price: null, changePct: null };
  const biasStyle =
    suggestion.bias === "LONG"
      ? "border-emerald-500/60 text-emerald-400"
      : suggestion.bias === "SHORT"
        ? "border-red-500/60 text-red-400"
        : "border-zinc-700 text-zinc-400";
  return (
    <button
      onClick={() => onSelect(suggestion.symbol)}
      className={`block w-full border px-2 py-2 text-left ${
        active
          ? "border-amber-500 bg-amber-500/10"
          : "border-zinc-800 bg-zinc-950 hover:border-amber-500/60"
      }`}
    >
      <span className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-amber-400">
          {suggestion.symbol}
        </span>
        <span
          className={`border px-1.5 py-0.5 font-mono text-[10px] font-bold ${biasStyle}`}
        >
          {suggestion.bias}
        </span>
      </span>
      <span className="mt-1 flex items-center justify-between font-mono text-xs">
        <span className="text-zinc-500">
          LIVE {fmtMoney(q.price)}
        </span>
        <span
          className={
            q.changePct == null
              ? "text-zinc-500"
              : q.changePct >= 0
                ? "text-emerald-400"
                : "text-red-400"
          }
        >
          {fmtPct(q.changePct)}
        </span>
      </span>
      <span className="mt-1.5 grid grid-cols-3 gap-1 font-mono text-[11px]">
        <span className="block">
          <span className="block text-[9px] uppercase tracking-wider text-zinc-500">
            Entry
          </span>
          <span className="text-zinc-100">{fmtMoney(suggestion.entry)}</span>
        </span>
        <span className="block">
          <span className="block text-[9px] uppercase tracking-wider text-zinc-500">
            Target
          </span>
          <span className="text-emerald-400">{fmtMoney(suggestion.target)}</span>
        </span>
        <span className="block">
          <span className="block text-[9px] uppercase tracking-wider text-zinc-500">
            Stop
          </span>
          <span className="text-red-400">{fmtMoney(suggestion.stop)}</span>
        </span>
      </span>
      <span className="mt-1.5 block text-[11px] font-semibold text-zinc-200">
        {suggestion.strategy}
      </span>
      <span className="block text-[11px] leading-snug text-zinc-400">
        {suggestion.rationale}
      </span>
      <span className="mt-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {suggestion.sector}
        {suggestion.peer ? " · peer" : ""} · {suggestion.lastBar}
      </span>
    </button>
  );
}

function Panel({
  title,
  footnote,
  children,
}: {
  title: string;
  footnote?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        {title}
      </div>
      <div className="p-2">{children}</div>
      {footnote && (
        <div className="border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-600">
          {footnote}
        </div>
      )}
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
  // FROZEN PANELS: recents and suggestions are snapshotted once while the
  // initial load settles, then never change until a full page refresh.
  // Clicking a card only loads its chart (and records recency to
  // localStorage for the NEXT load) — it never reorders, adds, or removes
  // a card in the current view. Live prices still refresh every 60s.
  const [recents, setRecents] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggError, setSuggError] = useState<string | null>(null);

  const initWindowRef = useRef(true);
  const tradesMergedRef = useRef(false);
  const suggStateRef = useRef<"pending" | "fetching" | "done">("pending");
  const suggTimerRef = useRef<number | null>(null);
  const propsRef = useRef({
    currentSymbol,
    trades,
    watchlistSymbols,
    holdingSymbols,
  });
  useEffect(() => {
    propsRef.current = {
      currentSymbol,
      trades,
      watchlistSymbols,
      holdingSymbols,
    };
  });

  // Init only: snapshot recents from localStorage, with the ticker already
  // loaded in the chart first. This is the only place recents state is
  // set from storage. The initial-load window stays open for 3s so the
  // first trade history can still merge in (see below).
  useEffect(() => {
    const t = window.setTimeout(() => {
      initWindowRef.current = false;
    }, 3000);
    const stored = loadRecents();
    const initial = [
      propsRef.current.currentSymbol,
      ...stored.filter((s) => s !== propsRef.current.currentSymbol),
    ].slice(0, MAX_RECENTS);
    setRecents(initial);
    saveRecents(initial);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record recency for the NEXT page load only — displayed recents never
  // move when a card is clicked.
  useEffect(() => {
    if (!currentSymbol) return;
    const stored = loadRecents();
    saveRecents(
      [currentSymbol, ...stored.filter((s) => s !== currentSymbol)].slice(
        0,
        MAX_RECENTS
      )
    );
  }, [currentSymbol]);

  // Merge tickers from recent trades once, and only while the initial
  // load is still settling — never after an order or a click.
  useEffect(() => {
    if (tradesMergedRef.current || trades.length === 0) return;
    if (!initWindowRef.current) return;
    tradesMergedRef.current = true;
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

  const fetchSuggestions = useCallback(async () => {
    const { currentSymbol: cur, holdingSymbols: h, watchlistSymbols: w } =
      propsRef.current;
    const params = new URLSearchParams({
      holdings: h.join(","),
      watchlist: w.join(","),
      current: cur,
      recents: loadRecents().join(","),
    });
    try {
      const res = await fetch(`/api/suggestions?${params}`);
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Suggestions failed to load.");
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setSuggError(null);
    } catch (err) {
      setSuggError(
        err instanceof Error ? err.message : "Suggestions failed to load."
      );
    } finally {
      suggStateRef.current = "done";
    }
  }, []);

  // Suggestions: one debounced fetch after the initial inputs (trades,
  // watchlist, holdings) stop changing, then frozen. Clicks never
  // re-trigger this — the ref guard stops it after the first fetch.
  useEffect(() => {
    if (suggStateRef.current !== "pending") return;
    if (suggTimerRef.current != null) {
      window.clearTimeout(suggTimerRef.current);
    }
    suggTimerRef.current = window.setTimeout(() => {
      if (suggStateRef.current !== "pending") return;
      suggStateRef.current = "fetching";
      void fetchSuggestions();
    }, 800);
    return () => {
      if (suggTimerRef.current != null) {
        window.clearTimeout(suggTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, watchlistSymbols, holdingSymbols]);

  function retrySuggestions() {
    suggStateRef.current = "fetching";
    setSuggError(null);
    void fetchSuggestions();
  }

  const quoteSymbols = [
    ...new Set([
      ...recents,
      ...(suggestions ?? []).map((s) => s.symbol),
    ]),
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

      <Panel
        title="Suggested"
        footnote="Rule-based signals from daily bars — not investment advice."
      >
        {suggError ? (
          <div className="px-1 py-2">
            <p className="text-xs text-red-400">{suggError}</p>
            <button
              onClick={retrySuggestions}
              className="mt-2 border border-zinc-700 px-2 py-1 font-mono text-xs text-zinc-300 hover:border-amber-500 hover:text-amber-400"
            >
              Try again
            </button>
          </div>
        ) : suggestions === null ? (
          <p className="px-1 py-2 text-xs text-zinc-500">
            Loading suggestions…
          </p>
        ) : suggestions.length === 0 ? (
          <p className="px-1 py-2 text-xs text-zinc-500">
            No suggestions right now — everything is already in your lists
            or has no signal.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.symbol}
                suggestion={s}
                quote={quotes[s.symbol]}
                active={s.symbol === currentSymbol}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
