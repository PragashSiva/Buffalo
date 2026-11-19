"use client";

import { useCallback, useEffect, useState } from "react";
import AccountSummary from "@/components/AccountSummary";
import ChartPanel from "@/components/ChartPanel";
import OrderTicket from "@/components/OrderTicket";
import PositionsTable from "@/components/PositionsTable";
import TradeHistory from "@/components/TradeHistory";
import StrategiesPanel from "@/components/StrategiesPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import type {
  ChartData,
  Portfolio,
  RangeKey,
  Strategy,
  Trade,
  WatchItem,
} from "@/lib/types";

export default function Home() {
  const [symbol, setSymbol] = useState("SPY");
  const [range, setRange] = useState<RangeKey>("1M");
  const [chart, setChart] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [resetting, setResetting] = useState(false);

  const loadChart = useCallback(async (sym: string, r: RangeKey) => {
    setChartLoading(true);
    setChartError(null);
    try {
      const res = await fetch(`/api/chart?symbol=${encodeURIComponent(sym)}&range=${r}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chart failed to load.");
      setChart(data);
    } catch (err) {
      setChart(null);
      setChartError(err instanceof Error ? err.message : "Chart failed to load.");
    } finally {
      setChartLoading(false);
    }
  }, []);

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio");
      const data = await res.json();
      if (res.status === 503 && data.code === "DB_NOT_CONFIGURED") {
        setDbConfigured(false);
        setPortfolio(null);
        return;
      }
      if (!res.ok) return;
      setDbConfigured(true);
      setPortfolio(data);
    } catch {
      /* transient network error — next poll retries */
    }
  }, []);

  const loadTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      if (!res.ok) return;
      const data = await res.json();
      setTrades(data.trades ?? []);
    } catch {
      /* transient network error — next refresh retries */
    }
  }, []);

  const loadStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/strategies");
      if (!res.ok) return;
      const data = await res.json();
      setStrategies(data.strategies ?? []);
    } catch {
      /* transient network error — next refresh retries */
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      setWatchlist(data.watchlist ?? []);
    } catch {
      /* transient network error — next refresh retries */
    }
  }, []);

  const refreshTrading = useCallback(() => {
    loadPortfolio();
    loadTrades();
  }, [loadPortfolio, loadTrades]);

  useEffect(() => {
    loadChart(symbol, range);
  }, [symbol, range, loadChart]);

  useEffect(() => {
    loadPortfolio();
    loadTrades();
    loadStrategies();
    loadWatchlist();
    const t = setInterval(() => {
      loadPortfolio();
      loadWatchlist();
    }, 30_000);
    return () => clearInterval(t);
  }, [loadPortfolio, loadTrades, loadStrategies, loadWatchlist]);

  async function resetAccount() {
    if (
      !window.confirm(
        "Reset the paper account to $100,000? Positions and trade history will be cleared. Strategies and watchlist stay."
      )
    )
      return;
    setResetting(true);
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    setResetting(false);
    refreshTrading();
  }

  return (
    <main className="min-h-screen bg-black px-3 py-3 text-zinc-200 md:px-5">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 bg-amber-500" aria-hidden />
          <h1 className="font-mono text-lg font-bold uppercase tracking-[0.2em] text-zinc-100">
            Paper Trading
          </h1>
          <span className="hidden font-mono text-xs text-zinc-500 sm:inline">
            / TERMINAL · VIRTUAL $100,000
          </span>
        </div>
        <button
          onClick={resetAccount}
          disabled={dbConfigured !== true || resetting}
          className="ml-auto border border-zinc-700 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300 hover:border-red-500 hover:text-red-400 disabled:opacity-40"
        >
          {resetting ? "Resetting…" : "Reset account"}
        </button>
      </header>

      {dbConfigured === false && (
        <div className="mb-3 border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Database not configured — charts and quotes still work, but orders,
          positions, trades, strategies and the watchlist need Postgres. Set{" "}
          <span className="font-mono">DATABASE_URL</span> to your free Neon
          connection string (see README) and redeploy or restart.
        </div>
      )}

      <div className="mb-3">
        <AccountSummary portfolio={portfolio} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <ChartPanel
            symbol={symbol}
            onSymbolChange={setSymbol}
            range={range}
            onRangeChange={setRange}
            chart={chart}
            loading={chartLoading}
            error={chartError}
          />
          <PositionsTable positions={portfolio?.positions ?? []} onSelectSymbol={setSymbol} />
          <TradeHistory trades={trades} />
        </div>
        <div className="space-y-3">
          <OrderTicket
            symbol={symbol}
            price={chart?.price ?? null}
            strategies={strategies}
            disabled={dbConfigured !== true}
            onPlaced={refreshTrading}
          />
          <WatchlistPanel watchlist={watchlist} onSelect={setSymbol} onChange={loadWatchlist} />
          <StrategiesPanel strategies={strategies} onChange={loadStrategies} />
        </div>
      </div>

      <footer className="mt-4 border-t border-zinc-900 pt-2 text-[11px] text-zinc-600">
        Paper trading only — not real money, not investment advice. Prices from
        Yahoo Finance (Stooq fallback); fills use the latest live price and may
        be delayed ~15 minutes. Line charts only, for now.
      </footer>
    </main>
  );
}
