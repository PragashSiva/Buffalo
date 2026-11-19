"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartData, RangeKey } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/format";

const RANGES: RangeKey[] = ["1D", "5D", "1M", "6M", "1Y"];

function formatTick(t: number, range: RangeKey): string {
  const d = new Date(t);
  if (range === "1D") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip(props: any) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { t: number; close: number };
  const d = new Date(p.t);
  return (
    <div className="border border-zinc-700 bg-black px-2 py-1 font-mono text-xs text-zinc-200">
      <div>{d.toLocaleString("en-US")}</div>
      <div className="text-amber-400">{fmtMoney(p.close)}</div>
    </div>
  );
}

export default function ChartPanel({
  symbol,
  onSymbolChange,
  range,
  onRangeChange,
  chart,
  loading,
  error,
}: {
  symbol: string;
  onSymbolChange: (s: string) => void;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  chart: ChartData | null;
  loading: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState(symbol);

  const changePct =
    chart?.price != null && chart?.prevClose != null && chart.prevClose !== 0
      ? ((chart.price - chart.prevClose) / chart.prevClose) * 100
      : null;

  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) onSymbolChange(input.trim().toUpperCase());
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="TICKER"
            className="w-28 border border-zinc-700 bg-black px-2 py-1 font-mono text-sm uppercase text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500"
            aria-label="Ticker symbol"
          />
          <button
            type="submit"
            className="border border-amber-500 bg-amber-500/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-500/20"
          >
            Load
          </button>
        </form>
        <div className="ml-auto flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`border px-2 py-1 font-mono text-xs font-bold ${
                r === range
                  ? "border-amber-500 bg-amber-500/15 text-amber-400"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-3 px-3 pt-3">
        <span className="font-mono text-xl font-bold text-zinc-100">{symbol}</span>
        {chart?.name && <span className="text-xs text-zinc-500">{chart.name}</span>}
        {chart?.price != null && (
          <span className="font-mono text-xl text-amber-400">{fmtMoney(chart.price)}</span>
        )}
        {changePct != null && (
          <span
            className={`font-mono text-sm ${changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {fmtPct(changePct)}
          </span>
        )}
        {chart && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-600">
            Source: {chart.source === "yahoo" ? "Yahoo Finance" : "Stooq"} · line only
          </span>
        )}
      </div>

      <div className="h-[320px] px-1 pb-2 pt-2">
        {loading && (
          <div className="flex h-full items-center justify-center font-mono text-sm text-zinc-500">
            Loading chart…
          </div>
        )}
        {error && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="font-mono text-sm text-red-400">Chart unavailable</div>
            <div className="text-xs text-zinc-400">{error}</div>
          </div>
        )}
        {!loading && !error && chart && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart.points} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t: number) => formatTick(t, range)}
                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#ffb000"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
