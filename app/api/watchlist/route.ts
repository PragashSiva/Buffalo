import { connection } from "next/server";
import type { NextRequest } from "next/server";
import {
  ensureSchema,
  getSql,
  isDbConfigured,
  dbNotConfiguredResponse,
} from "@/lib/db";
import { fetchQuote, normalizeSymbol } from "@/lib/market-data";

export async function GET() {
  await connection(); // request-time only: never prerender at build
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`SELECT symbol FROM watchlist ORDER BY added_at ASC`;
    const items = await Promise.all(
      rows.map(async (r) => {
        const symbol = String(r.symbol);
        try {
          const q = await fetchQuote(symbol);
          const changePct =
            q.prevClose != null && q.prevClose !== 0
              ? ((q.price - q.prevClose) / q.prevClose) * 100
              : null;
          return { symbol, price: q.price, changePct };
        } catch {
          return { symbol, price: null, changePct: null };
        }
      })
    );
    return Response.json({ watchlist: items });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load watchlist." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await connection();
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  const body = await req.json().catch(() => null);
  const symbol = normalizeSymbol(String(body?.symbol ?? ""));
  if (!symbol) return Response.json({ error: "Enter a ticker symbol." }, { status: 400 });
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`INSERT INTO watchlist (symbol) VALUES (${symbol}) ON CONFLICT (symbol) DO NOTHING`;
    return Response.json({ ok: true, symbol });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not add to watchlist." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await connection();
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol") ?? "");
  if (!symbol) return Response.json({ error: "Pass ?symbol=TICKER" }, { status: 400 });
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`DELETE FROM watchlist WHERE symbol = ${symbol}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not remove from watchlist." }, { status: 500 });
  }
}
