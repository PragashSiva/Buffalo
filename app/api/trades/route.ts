import { connection } from "next/server";
import {
  ensureSchema,
  getSql,
  isDbConfigured,
  dbNotConfiguredResponse,
} from "@/lib/db";

export async function GET() {
  await connection(); // request-time only: never prerender at build
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT t.id, t.symbol, t.side, t.shares, t.price, t.strategy_id, s.name AS strategy_name,
             t.note, t.realized_pnl, t.created_at
      FROM trades t
      LEFT JOIN strategies s ON s.id = t.strategy_id
      ORDER BY t.created_at DESC
      LIMIT 200`;
    const trades = rows.map((r) => ({
      id: Number(r.id),
      symbol: String(r.symbol),
      side: String(r.side) as "BUY" | "SELL",
      shares: Number(r.shares),
      price: Number(r.price),
      strategyId: r.strategy_id == null ? null : Number(r.strategy_id),
      strategyName: r.strategy_name == null ? null : String(r.strategy_name),
      note: r.note == null ? null : String(r.note),
      realizedPnl: r.realized_pnl == null ? null : Number(r.realized_pnl),
      createdAt: new Date(String(r.created_at)).toISOString(),
    }));
    return Response.json({ trades });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load trades." }, { status: 500 });
  }
}
