import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { fetchQuote, normalizeSymbol } from "@/lib/market-data";

export async function GET(req: NextRequest) {
  await connection(); // request-time only: never prerender at build
  const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol") ?? "");
  if (!symbol) {
    return Response.json({ error: "Pass ?symbol=TICKER" }, { status: 400 });
  }
  try {
    const quote = await fetchQuote(symbol);
    return Response.json({ symbol, ...quote });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: `Live price for ${symbol} is unavailable right now.` },
      { status: 502 }
    );
  }
}
