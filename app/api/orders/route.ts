import { connection } from "next/server";
import type { NextRequest } from "next/server";
import {
  ensureSchema,
  getSql,
  isDbConfigured,
  dbNotConfiguredResponse,
} from "@/lib/db";
import { fetchQuote, normalizeSymbol } from "@/lib/market-data";

/**
 * Place a paper order. Fills immediately at the live market price —
 * no limit/stop orders yet. Cash and share checks run before anything
 * is written; if the live price can't be fetched, nothing is placed.
 */
export async function POST(req: NextRequest) {
  await connection();
  if (!isDbConfigured()) return dbNotConfiguredResponse();
  const body = await req.json().catch(() => null);
  const symbol = normalizeSymbol(String(body?.symbol ?? ""));
  const side = String(body?.side ?? "").toUpperCase();
  const shares = Number(body?.shares);
  const strategyId = body?.strategyId ? Number(body.strategyId) : null;
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;

  if (!symbol) return Response.json({ error: "Enter a ticker symbol." }, { status: 400 });
  if (side !== "BUY" && side !== "SELL") {
    return Response.json({ error: "Side must be BUY or SELL." }, { status: 400 });
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    return Response.json({ error: "Shares must be greater than 0." }, { status: 400 });
  }

  let price: number;
  try {
    price = (await fetchQuote(symbol)).price;
  } catch {
    return Response.json(
      {
        error: `Live price unavailable for ${symbol} right now. Order not placed — no price was invented.`,
      },
      { status: 502 }
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const accounts = await sql`SELECT cash FROM account WHERE id = 1`;
    const cash = Number(accounts[0].cash);
    const posRows = await sql`SELECT shares, avg_cost FROM positions WHERE symbol = ${symbol}`;
    const held = posRows.length ? Number(posRows[0].shares) : 0;
    const avgCost = posRows.length ? Number(posRows[0].avg_cost) : 0;
    const cost = price * shares;

    if (side === "BUY" && cost > cash) {
      return Response.json(
        {
          error: `Not enough cash. ${shares} shares of ${symbol} at $${price.toFixed(
            2
          )} costs $${cost.toFixed(2)}; you have $${cash.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }
    if (side === "SELL" && shares > held) {
      return Response.json(
        { error: `You hold ${held} shares of ${symbol}; cannot sell ${shares}.` },
        { status: 400 }
      );
    }

    let realizedPnl: number | null = null;
    if (side === "BUY") {
      const newShares = held + shares;
      const newAvg = held > 0 ? (avgCost * held + cost) / newShares : price;
      await sql`INSERT INTO positions (symbol, shares, avg_cost)
        VALUES (${symbol}, ${newShares}, ${newAvg})
        ON CONFLICT (symbol) DO UPDATE SET shares = EXCLUDED.shares, avg_cost = EXCLUDED.avg_cost, updated_at = NOW()`;
      await sql`UPDATE account SET cash = cash - ${cost}, updated_at = NOW() WHERE id = 1`;
    } else {
      realizedPnl = (price - avgCost) * shares;
      const remaining = held - shares;
      if (remaining <= 0.000001) {
        await sql`DELETE FROM positions WHERE symbol = ${symbol}`;
      } else {
        await sql`UPDATE positions SET shares = ${remaining}, updated_at = NOW() WHERE symbol = ${symbol}`;
      }
      await sql`UPDATE account SET cash = cash + ${cost}, updated_at = NOW() WHERE id = 1`;
    }

    const inserted = await sql`
      INSERT INTO trades (symbol, side, shares, price, strategy_id, note, realized_pnl)
      VALUES (${symbol}, ${side}, ${shares}, ${price}, ${strategyId}, ${note}, ${realizedPnl})
      RETURNING id, created_at`;
    return Response.json({
      ok: true,
      trade: { id: inserted[0].id, symbol, side, shares, price, realizedPnl },
      cashAfter: side === "BUY" ? cash - cost : cash + cost,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Order failed to save." }, { status: 500 });
  }
}
