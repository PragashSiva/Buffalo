import type { Portfolio } from "@/lib/types";
import { fmtMoney, fmtSigned, pnlColor } from "@/lib/format";

function Stat({
  label,
  value,
  className = "text-zinc-100",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </div>
      <div className={`font-mono text-lg leading-tight ${className}`}>{value}</div>
    </div>
  );
}

export default function AccountSummary({ portfolio }: { portfolio: Portfolio | null }) {
  if (!portfolio) {
    return (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {["Cash", "Equity", "Unrealized P&L", "Realized P&L"].map((label) => (
          <Stat key={label} label={label} value="—" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Stat label="Cash" value={fmtMoney(portfolio.cash)} />
      <Stat label="Equity" value={fmtMoney(portfolio.equity)} />
      <Stat
        label="Unrealized P&L"
        value={fmtSigned(portfolio.unrealizedPnl)}
        className={`font-mono text-lg leading-tight ${pnlColor(portfolio.unrealizedPnl)}`}
      />
      <Stat
        label="Realized P&L"
        value={fmtSigned(portfolio.realizedPnl)}
        className={`font-mono text-lg leading-tight ${pnlColor(portfolio.realizedPnl)}`}
      />
    </div>
  );
}
