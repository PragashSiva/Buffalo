"use client";

import { useState } from "react";
import type { Strategy } from "@/lib/types";
import { fmtSigned, pnlColor } from "@/lib/format";

export default function StrategiesPanel({
  strategies,
  onChange,
}: {
  strategies: Strategy[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [rules, setRules] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rules }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not save strategy.");
      else {
        setName("");
        setRules("");
        onChange();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this strategy? Its trades keep the tag removed.")) return;
    await fetch(`/api/strategies?id=${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        Strategies
      </div>
      <div className="space-y-3 px-3 py-3">
        {strategies.length === 0 && (
          <p className="text-xs text-zinc-500">
            No strategies yet. Save one, then tag orders to it and compare results here.
          </p>
        )}
        {strategies.map((s) => (
          <div key={s.id} className="border border-zinc-800 bg-black px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-bold text-amber-400">{s.name}</span>
              <button
                onClick={() => remove(s.id)}
                className="text-xs text-zinc-500 hover:text-red-400"
                aria-label={`Delete ${s.name}`}
              >
                ✕
              </button>
            </div>
            {s.rules && <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-400">{s.rules}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
              <span>
                Trades: <span className="text-zinc-100">{s.tradeCount}</span>
              </span>
              <span>
                Win rate:{" "}
                <span className="text-zinc-100">
                  {s.winRate == null ? "—" : `${(s.winRate * 100).toFixed(0)}%`}
                </span>
              </span>
              <span>
                Realized:{" "}
                <span className={pnlColor(s.realizedPnl)}>{fmtSigned(s.realizedPnl)}</span>
              </span>
            </div>
          </div>
        ))}

        <form onSubmit={add} className="space-y-2 border-t border-zinc-800 pt-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Strategy name (e.g. Earnings bounce)"
            className="w-full border border-zinc-700 bg-black px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500"
          />
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Rules — entry, exit, position size…"
            rows={2}
            className="w-full border border-zinc-700 bg-black px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="border border-amber-500 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-500/20 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save strategy"}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      </div>
    </section>
  );
}
