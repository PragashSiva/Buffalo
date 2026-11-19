import { connection } from "next/server";
import type { NextRequest } from "next/server";
import {
  ensureSchema,
  getSql,
  isDbConfigured,
  dbNotConfiguredResponse,
} from "@/lib/db";
import { fetchQuote } from "@/lib/market-data";

export async function GET() {
  await connection(); // request-time only: never prerender at build
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  try {
    await ensureSchema();
    const sql = getSql();
    const accounts = await sql`SELECT cash, starting_cash FROM account WHERE id = 1`;
    const cash = Number(accounts[0].cash);
    const startingCash = Number(accounts[0].starting_cash);
    const posRows = await sql`SELECT symbol, shares, avg_cost FROM positions ORDER BY symbol`;
    const tradeRows = await sql`SELECT COALESCE(SUM(realized_pnl), 0) AS total FROM trades WHERE realized_pnl IS NOT NULL`;
    const realizedPnl = Number(tradeRows[0].total);
    const positions = await Promise.all(
      posRows.map(async (r) => {
        const shares = Number(r.shares);
        const avgCost = Number(r.avg_cost);
        let price: number | null = null;
        try {
          const q = await fetchQuote(String(r.symbol));
          price = q.price;
        } catch {
          price = null; // quote unavailable: show position without a live mark, never a fake one
        }
        const value = price != null ? price * shares : null;
        const unrealized = price != null ? (price - avgCost) * shares : null;
        return { symbol: String(r.symbol), shares, avgCost, price, value, unrealized };
      })
    );
    const positionsValue = positions.reduce((s, p) => s + (p.value ?? 0), 0);
    const unrealizedPnl = positions.reduce((s, p) => s + (p.unrealized ?? 0), 0);
    return Response.json({
      cash,
      startingCash,
      equity: cash + positionsValue,
      realizedPnl,
      unrealizedPnl,
      positions,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load portfolio." }, { status: 500 });
  }
}

/** POST { action: "reset" } — back to $100,000 cash, positions and trades cleared. */
export async function POST(req: NextRequest) {
  await connection();
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  const body = await req.json().catch(() => null);
  if (body?.action !== "reset") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`DELETE FROM trades`;
    await sql`DELETE FROM positions`;
    await sql`UPDATE account SET cash = starting_cash, updated_at = NOW() WHERE id = 1`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Account reset failed." }, { status: 500 });
  }
}
