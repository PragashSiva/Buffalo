# Paper Trading — Terminal

A standalone paper trading app: a **$100,000 virtual account** to try out
trading strategies with real market prices, without risking real money.

Dark, Bloomberg-terminal-style UI. Line charts only (no candles, no
indicators yet) — more to come as the strategies evolve.

## Features

- **$100,000 virtual account** — cash, equity, realized + unrealized P&L
- **Buy/sell order ticket** — fills immediately at the live market price,
  with cash and share checks (can't buy what you can't afford, can't sell
  what you don't hold)
- **Line-only price charts** — any ticker, ranges 1D / 5D / 1M / 6M / 1Y;
  1D uses real 1-minute candles
- **Trade history** — every fill, with strategy tag and note
- **Named strategies** — save a strategy with its rules, tag orders to it,
  compare per-strategy trade count, win rate, and realized P&L
- **Watchlist** — with live prices and day change
- **Account reset** — back to $100,000, positions and trades cleared
  (strategies and watchlist stay)

## Stack — all free tier, $0/month

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, TypeScript, Tailwind v4) | One codebase for UI + API; Vercel-native |
| Hosting | **Vercel Hobby** (free) | Free, deploys straight from GitHub |
| Database | **Neon Postgres** (free tier) | Real Postgres, works across devices; a single `DATABASE_URL` env var, no other config. Tables are created automatically on first use (`lib/db.ts`), so there is no migration step. |
| Charts | **Recharts** | Lightweight line charts |
| Prices | **Finnhub** (free key) first when set, else **Yahoo Finance chart API** (no key), **Stooq** fallback | Free, no paid APIs. Yahoo/Stooq block datacenter IPs, so on Vercel the Finnhub key is what makes prices work. Proxied through Next.js route handlers (`/api/chart`, `/api/quote`) so the browser never calls the sources directly. |

No auth yet — it's a single-user app on a private repo. Add Vercel's
password protection or proper auth before sharing the URL with anyone.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL (see below)
npm run dev                  # http://localhost:3000
```

Without `DATABASE_URL` the app still runs: charts and quotes work, and a
banner explains that orders/positions/trades/strategies/watchlist need the
database. With it set, everything works and state persists in Postgres.

## Environment variables

| Variable | Required | Where it comes from |
| --- | --- | --- |
| `DATABASE_URL` | Yes, for trading state | Neon dashboard → your free project → connection string. Format: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `FINNHUB_API_KEY` | Yes, for live prices on Vercel | Free key at [finnhub.io](https://finnhub.io) (free tier: 60 calls/min). Yahoo and Stooq both block Vercel's datacenter IPs, so without this key charts and quotes show an error on the deployed app. |

That's the only one. There are no API keys: market data comes from Yahoo
Finance (no key) with a Stooq fallback (no key).

## Deploy (once GitHub and Vercel are connected)

1. **GitHub** — create a **private** repo (`buffalo`) and push
   this folder:
   ```bash
   git init
   git add .
   git commit -m "Paper trading terminal"
   git branch -M main
   git remote add origin git@github.com:PragashSiva/buffalo.git
   git push -u origin main
   ```
2. **Neon** — at [neon.tech](https://neon.tech), create a free project
   (free tier: 0.25 CU, 512 MB storage — plenty for this app). Copy the
   Postgres connection string from the dashboard.
3. **Vercel** — at [vercel.com](https://vercel.com) → **Add New → Project** →
   **Import** the GitHub repo. Framework preset: Next.js (auto-detected).
   In **Environment Variables**, add `DATABASE_URL` with the Neon string.
   Then **Deploy**.
4. Open the Vercel URL. The app creates its tables on first use and seeds
   the $100,000 account and a starter watchlist (SPY, NVDA, QQQ, AAPL).

To update later: push to `main` — Vercel redeploys automatically.

## Market data — and its failure modes

- **Primary:** Yahoo Finance chart API (`query1.finance.yahoo.com/v8/finance/chart`),
  called server-side from `/api/chart` and `/api/quote`. Responses are
  cached for 15 seconds to avoid hammering it. Yahoo prices are typically
  delayed ~15 minutes and Yahoo sometimes rate-limits (HTTP 429) — the app
  shows a clear error state in that case.
- **Fallback:** for multi-day ranges, Stooq daily bars
  (`stooq.com/q/d/l/`) are tried if Yahoo fails. Stooq covers US listings
  only and has no intraday data, so the 1D chart has no fallback.
- **Never fakes prices.** If no source returns a price, the chart shows an
  error and orders are refused with "live price unavailable" — no invented
  fills.

## Project layout

```
app/
  page.tsx                 Dashboard (chart + ticket + positions + history + strategies)
  layout.tsx               Dark terminal shell
  api/
    portfolio/route.ts     Account summary, positions with live marks, reset
    chart/route.ts         Line-chart history (?symbol=&range=)
    quote/route.ts         Latest price (?symbol=)
    orders/route.ts        Place a paper order (POST)
    trades/route.ts        Trade history
    strategies/route.ts    Strategies + per-strategy stats
    watchlist/route.ts     Watchlist with live quotes
components/                AccountSummary, ChartPanel, OrderTicket,
                           PositionsTable, TradeHistory, StrategiesPanel,
                           WatchlistPanel
lib/
  db.ts                    Neon client, schema auto-creation, $100k seed
  market-data.ts           Yahoo + Stooq fetching, ticker normalization
  format.ts                Money / percent formatting
  types.ts                 Shared types
db/schema.sql              The same schema, as a reference (app auto-creates it)
```

## Cost

$0/month: Vercel Hobby (free), Neon free tier, no paid APIs. The only
thing that could ever cost money is outgrowing the free tiers (Neon free
is 512 MB — this app stores a few KB per trade).

## Roadmap ideas (not built yet)

- Limit/stop orders, intraday P&L chart, per-strategy equity curves
- Candlesticks / indicators (deliberately line-only for now)
- Import/export trades (CSV), daily journal notes
- Auth, if the URL is ever shared
