import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { fetchChart, normalizeSymbol } from "@/lib/market-data";

export async function GET(req: NextRequest) {
  await connection(); // request-time only: never prerender at build
  const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol") ?? "");
  const range = (req.nextUrl.searchParams.get("range") ?? "1M").toUpperCase();
  if (!symbol) {
    return Response.json({ error: "Pass ?symbol=TICKER" }, { status: 400 });
  }
  try {
    const chart = await fetchChart(symbol, range);
    return Response.json(chart);
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        error: `Live price data for ${symbol} is unavailable right now (Yahoo Finance and the Stooq fallback both failed). Try again in a bit — no price was invented.`,
      },
      { status: 502 }
    );
  }
}
