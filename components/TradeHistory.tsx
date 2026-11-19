import type { Trade } from "@/lib/types";
import { fmtMoney, fmtNum, fmtSigned, pnlColor } from "@/lib/format";

export default function TradeHistory({ trades }: { trades: Trade[] }) {
  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        Trade history
      </div>
      {trades.length === 0 ? (
        <p className="px-3 py-4 text-xs text-zinc-500">No trades yet.</p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-zinc-950">
              <tr className="text-left text-zinc-500">
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-2 py-2 font-semibold">Symbol</th>
                <th className="px-2 py-2 font-semibold">Side</th>
                <th className="px-2 py-2 text-right font-semibold">Shares</th>
                <th className="px-2 py-2 text-right font-semibold">Price</th>
                <th className="px-2 py-2 font-semibold">Strategy</th>
                <th className="px-2 py-2 font-semibold">Note</th>
                <th className="px-3 py-2 text-right font-semibold">Realized</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-zinc-900 text-zinc-200">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                    {new Date(t.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-2 py-2 font-bold text-amber-400">{t.symbol}</td>
                  <td
                    className={`px-2 py-2 font-bold ${
                      t.side === "BUY" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {t.side}
                  </td>
                  <td className="px-2 py-2 text-right">{fmtNum(t.shares, 4)}</td>
                  <td className="px-2 py-2 text-right">{fmtMoney(t.price)}</td>
                  <td className="px-2 py-2 text-zinc-400">{t.strategyName ?? "—"}</td>
                  <td className="max-w-[160px] truncate px-2 py-2 text-zinc-400" title={t.note ?? ""}>
                    {t.note ?? "—"}
                  </td>
                  <td className={`px-3 py-2 text-right ${pnlColor(t.realizedPnl)}`}>
                    {t.realizedPnl == null ? "—" : fmtSigned(t.realizedPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
