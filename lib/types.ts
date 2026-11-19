export type RangeKey = "1D" | "5D" | "1M" | "6M" | "1Y";

export interface ChartPoint {
  t: number; // epoch ms
  close: number;
}

export interface ChartData {
  symbol: string;
  name: string | null;
  currency: string | null;
  price: number | null;
  prevClose: number | null;
  points: ChartPoint[];
  source: "yahoo" | "stooq" | "finnhub" | "twelvedata";
}

export interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
  price: number | null;
  value: number | null;
  unrealized: number | null;
}

export interface Portfolio {
  cash: number;
  startingCash: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  positions: Position[];
}

export interface Trade {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  strategyId: number | null;
  strategyName: string | null;
  note: string | null;
  realizedPnl: number | null;
  createdAt: string;
}

export interface Strategy {
  id: number;
  name: string;
  rules: string;
  createdAt: string;
  tradeCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  realizedPnl: number;
}

export interface WatchItem {
  symbol: string;
  price: number | null;
  changePct: number | null;
}
