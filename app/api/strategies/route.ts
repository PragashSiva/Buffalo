import { connection } from "next/server";
import type { NextRequest } from "next/server";
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
      SELECT s.id, s.name, s.rules, s.created_at,
        COUNT(t.id) AS trade_count,
        COUNT(t.id) FILTER (WHERE t.realized_pnl > 0) AS wins,
        COUNT(t.id) FILTER (WHERE t.realized_pnl < 0) AS losses,
        COALESCE(SUM(t.realized_pnl), 0) AS realized_pnl
      FROM strategies s
      LEFT JOIN trades t ON t.strategy_id = s.id AND t.side = 'SELL'
      GROUP BY s.id
      ORDER BY s.created_at ASC`;
    const strategies = rows.map((r) => {
      const tradeCount = Number(r.trade_count);
      const wins = Number(r.wins);
      const losses = Number(r.losses);
      return {
        id: Number(r.id),
        name: String(r.name),
        rules: String(r.rules),
        createdAt: new Date(String(r.created_at)).toISOString(),
        tradeCount,
        wins,
        losses,
        winRate: tradeCount > 0 ? wins / tradeCount : null,
        realizedPnl: Number(r.realized_pnl),
      };
    });
    return Response.json({ strategies });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load strategies." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await connection();
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
  const rules = typeof body?.rules === "string" ? body.rules.slice(0, 2000) : "";
  if (!name) return Response.json({ error: "Give the strategy a name." }, { status: 400 });
  try {
    await ensureSchema();
    const sql = getSql();
    const inserted = await sql`
      INSERT INTO strategies (name, rules) VALUES (${name}, ${rules})
      RETURNING id, created_at`;
    return Response.json({
      ok: true,
      strategy: { id: Number(inserted[0].id), name, rules },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not save strategy." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await connection();
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return Response.json({ error: "Pass ?id=<strategy id>" }, { status: 400 });
  }
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`DELETE FROM strategies WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not delete strategy." }, { status: 500 });
  }
}
