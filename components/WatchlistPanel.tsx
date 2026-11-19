"use client";

import { useState } from "react";
import type { WatchItem } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/format";

export default function WatchlistPanel({
  watchlist,
  onSelect,
  onChange,
}: {
  watchlist: WatchItem[];
  onSelect: (s: string) => void;
  onChange: () => void;
}) {
  const [input, setInput] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: input.trim() }),
    });
    setInput("");
    onChange();
  }

  async function remove(symbol: string) {
    await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
      method: "DELETE",
    });
    onChange();
  }

  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        Watchlist
      </div>
      <form onSubmit={add} className="flex gap-2 px-3 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="ADD TICKER"
          className="w-full border border-zinc-700 bg-black px-2 py-1 font-mono text-sm uppercase text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500"
          aria-label="Add ticker to watchlist"
        />
        <button
          type="submit"
          className="border border-amber-500 bg-amber-500/10 px-3 py-1 font-mono text-xs font-bold text-amber-400 hover:bg-amber-500/20"
        >
          +
        </button>
      </form>
      <ul>
        {watchlist.map((w) => (
          <li
            key={w.symbol}
            className="flex cursor-pointer items-center justify-between border-t border-zinc-900 px-3 py-2 hover:bg-zinc-900"
            onClick={() => onSelect(w.symbol)}
          >
            <span className="font-mono text-sm font-bold text-amber-400">{w.symbol}</span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-sm text-zinc-100">{fmtMoney(w.price)}</span>
              <span
                className={`w-16 text-right font-mono text-xs ${
                  w.changePct == null
                    ? "text-zinc-500"
                    : w.changePct >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}
              >
                {fmtPct(w.changePct)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(w.symbol);
                }}
                className="text-xs text-zinc-500 hover:text-red-400"
                aria-label={`Remove ${w.symbol}`}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
        {watchlist.length === 0 && (
          <li className="px-3 py-3 text-xs text-zinc-500">Watchlist is empty.</li>
        )}
      </ul>
    </section>
  );
}
