-- Paper Trading schema (Neon / Postgres).
-- The app runs these same statements automatically on first use
-- (see lib/db.ts ensureSchema), so this file is documentation and a
-- manual-setup reference — you don't need to run it yourself.

CREATE TABLE IF NOT EXISTS account (
  id INTEGER PRIMARY KEY,
  cash NUMERIC(18,4) NOT NULL,
  starting_cash NUMERIC(18,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rules TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  symbol TEXT PRIMARY KEY,
  shares NUMERIC(18,6) NOT NULL,
  avg_cost NUMERIC(18,4) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE TABLE IF NOT EXISTS watchlist (
  symbol TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO account (id, cash, starting_cash)
VALUES (1, 100000, 100000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO watchlist (symbol) VALUES ('SPY'), ('NVDA'), ('QQQ'), ('AAPL')
ON CONFLICT (symbol) DO NOTHING;
