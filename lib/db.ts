import { neon } from "@neondatabase/serverless";

export const STARTING_CASH = 100_000;
export const DEFAULT_WATCHLIST = ["SPY", "NVDA", "QQQ", "AAPL"];

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// Creates the tables on first use so a fresh deploy works with only
// DATABASE_URL set — no manual migration step required.
let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS account (
          id INTEGER PRIMARY KEY,
          cash NUMERIC(18,4) NOT NULL,
          starting_cash NUMERIC(18,4) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS strategies (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          rules TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS positions (
          symbol TEXT PRIMARY KEY,
          shares NUMERIC(18,6) NOT NULL,
          avg_cost NUMERIC(18,4) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS trades (
          id SERIAL PRIMARY KEY,
          symbol TEXT NOT NULL,
          side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
          shares NUMERIC(18,6) NOT NULL,
          price NUMERIC(18,4) NOT NULL,
          strategy_id INTEGER REFERENCES strategies(id) ON DELETE SET NULL,
          note TEXT,
          realized_pnl NUMERIC(18,4),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS watchlist (
          symbol TEXT PRIMARY KEY,
          added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        INSERT INTO account (id, cash, starting_cash)
        VALUES (1, ${STARTING_CASH}, ${STARTING_CASH})
        ON CONFLICT (id) DO NOTHING`;
      for (const s of DEFAULT_WATCHLIST) {
        await sql`INSERT INTO watchlist (symbol) VALUES (${s}) ON CONFLICT (symbol) DO NOTHING`;
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

export function dbNotConfiguredResponse() {
  return Response.json(
    {
      error:
        "Database is not configured. Set DATABASE_URL to your Neon Postgres connection string (see README).",
      code: "DB_NOT_CONFIGURED",
    },
    { status: 503 }
  );
}
