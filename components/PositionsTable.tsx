import type { Position } from "@/lib/types";
import { fmtMoney, fmtNum, fmtSigned, pnlColor } from "@/lib/format";

export default function PositionsTable({
  positions,
  onSelectSymbol,
}: {
  positions: Position[];
  onSelectSymbol: (s: string) => void;
}) {
  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        Positions
      </div>
      {positions.length === 0 ? (
        <p className="px-3 py-4 text-xs text-zinc-500">
          No open positions. Place your first paper trade from the order ticket.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="px-3 py-2 font-semibold">Symbol</th>
                <th className="px-2 py-2 text-right font-semibold">Shares</th>
                <th className="px-2 py-2 text-right font-semibold">Avg cost</th>
                <th className="px-2 py-2 text-right font-semibold">Price</th>
                <th className="px-2 py-2 text-right font-semibold">Value</th>
                <th className="px-3 py-2 text-right font-semibold">Unrealized</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr
                  key={p.symbol}
                  onClick={() => onSelectSymbol(p.symbol)}
                  className="cursor-pointer border-t border-zinc-900 text-zinc-200 hover:bg-zinc-900"
                >
                  <td className="px-3 py-2 font-bold text-amber-400">{p.symbol}</td>
                  <td className="px-2 py-2 text-right">{fmtNum(p.shares, 4)}</td>
                  <td className="px-2 py-2 text-right">{fmtMoney(p.avgCost)}</td>
                  <td className="px-2 py-2 text-right">{fmtMoney(p.price)}</td>
                  <td className="px-2 py-2 text-right">{fmtMoney(p.value)}</td>
                  <td className={`px-3 py-2 text-right ${pnlColor(p.unrealized)}`}>
                    {fmtSigned(p.unrealized)}
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
