"use client";

import { useState } from "react";
import type { Strategy } from "@/lib/types";
import { fmtMoney } from "@/lib/format";

export default function OrderTicket({
  symbol,
  price,
  strategies,
  disabled,
  onPlaced,
}: {
  symbol: string;
  price: number | null;
  strategies: Strategy[];
  disabled: boolean;
  onPlaced: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [shares, setShares] = useState("10");
  const [strategyId, setStrategyId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const qty = Number(shares);
  const estCost = price != null && Number.isFinite(qty) && qty > 0 ? price * qty : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          shares: qty,
          strategyId: strategyId ? Number(strategyId) : null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Order failed." });
      } else {
        setMessage({
          ok: true,
          text: `${side} ${qty} ${symbol} @ ${fmtMoney(data.trade.price)} filled.`,
        });
        setNote("");
        onPlaced();
      }
    } catch {
      setMessage({ ok: false, text: "Network error — order not placed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        Order ticket · {symbol}
      </div>
      <form onSubmit={submit} className="space-y-3 px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("BUY")}
            className={`border px-3 py-2 font-mono text-sm font-bold ${
              side === "BUY"
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            BUY
          </button>
          <button
            type="button"
            onClick={() => setSide("SELL")}
            className={`border px-3 py-2 font-mono text-sm font-bold ${
              side === "SELL"
                ? "border-red-500 bg-red-500/15 text-red-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            SELL
          </button>
        </div>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Shares
          </span>
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full border border-zinc-700 bg-black px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none focus:border-amber-500"
          />
        </label>

        <div className="flex justify-between font-mono text-xs text-zinc-400">
          <span>Live price</span>
          <span className="text-zinc-100">{price != null ? fmtMoney(price) : "—"}</span>
        </div>
        <div className="flex justify-between font-mono text-xs text-zinc-400">
          <span>Est. {side === "BUY" ? "cost" : "proceeds"}</span>
          <span className="text-zinc-100">{estCost != null ? fmtMoney(estCost) : "—"}</span>
        </div>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Strategy (optional)
          </span>
          <select
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            className="mt-1 w-full border border-zinc-700 bg-black px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="">No strategy</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Note (optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this trade?"
            className="mt-1 w-full border border-zinc-700 bg-black px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500"
          />
        </label>

        <button
          type="submit"
          disabled={disabled || busy || price == null}
          className={`w-full border px-3 py-2 font-mono text-sm font-bold uppercase tracking-wider ${
            side === "BUY"
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              : "border-red-500 bg-red-500/15 text-red-400 hover:bg-red-500/25"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {busy ? "Placing…" : `${side} ${symbol}`}
        </button>

        {disabled && (
          <p className="text-xs text-amber-400/90">
            Orders need the database — set DATABASE_URL (see README).
          </p>
        )}
        {message && (
          <p className={`text-xs ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
      </form>
    </section>
  );
}
