export interface Position {
  symbol: string;
  qty: number;
  side: "long" | "short";
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  current_price: number;
  avg_entry_price: number;
  asset_class?: string;
}

export interface Order {
  id: string;
  client_order_id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  qty: number;
  filled_qty: number;
  limit_price: number | null;
  stop_price: number | null;
  status: "new" | "partially_filled" | "filled" | "canceled" | "rejected" | "pending_new";
  submitted_at: string;
  filled_at: string | null;
  time_in_force: "day" | "gtc" | "ioc" | "fok";
  asset_class?: string;
}

export interface Bar {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count?: number;
  vwap?: number;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  bid_size: number;
  ask_size: number;
  timestamp: string;
}

export interface AccountInfo {
  id: string;
  cash: number;
  portfolio_value: number;
  equity: number;
  buying_power: number;
  status: "active" | "inactive";
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
}

export interface TradeSignal {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  strategy: string;
  confidence: number;
  timestamp: string;
  price: number;
  asset_class: string;
  source: string;
}

export interface RiskState {
  var_limit: number;
  max_position_size: number;
  daily_loss_limit: number;
  circuit_breakers_active: boolean;
  kill_switch_active: boolean;
  equity_drop_pct: number;
  consecutive_losses: number;
  max_consecutive_losses: number;
  daily_pnl: number;
}

export interface RegimeState {
  current: "trending" | "mean_reverting" | "volatile" | "quiet";
  hmm_state: number;
  volatility_cluster: "low" | "normal" | "high" | "extreme";
  trend_strength: number;
  last_update: string;
}

export interface StrategyState {
  name: string;
  display_name: string;
  active: boolean;
  pnl: number;
  positions: number;
  last_signal: string | null;
  allowed_regimes: string[];
  lifecycle_state: "research" | "paper" | "live" | "demoted" | "retired";
}

export type TradingMode = "paper" | "live" | "stopped";

export interface ConnectionStatus {
  mode: TradingMode;
  connected: boolean;
  last_heartbeat: string | null;
  broker: string;
}

export type NotificationType = "info" | "warning" | "error" | "success";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
}

export interface KillSwitchState {
  active: boolean;
  reason: string | null;
  activated_at: string | null;
}

export type DrawdownMode = "continuous" | "eod" | "balance";

export type PhaseType = "challenge" | "verification" | "funded" | "combine" | "evaluation";

export interface PropFirmPhase {
  name: string;
  type: PhaseType;
  duration: number | null;
  profit_target: number | null;
  max_drawdown: number;
  consistency_enforced: boolean;
}

export interface PropFirmPreset {
  name: string;
  provider: string;
  url: string;
  account_size: number;
  rules: {
    profit_target: number;
    max_loss_limit: number;
    daily_loss_limit: number | null;
    consistency_rule: {
      max_day_percent: number | null;
      description: string;
    };
    min_trading_days: number | null;
    time_limit: number | null;
    payout: number;
    instruments: {
      forex?: string[];
      futures?: string[];
      stocks?: string[];
      indices?: string[];
      crypto?: string[];
    };
    restrictions: {
      news_trading: boolean;
      overnight_holding: boolean;
      weekend_holding: boolean;
      scaling: boolean;
    };
  };
  phases: PropFirmPhase[];
  metadata: {
    created: string;
    version: string;
    notes: string;
  };
}

export interface PropFirmState {
  preset_name: string;
  phase: string;
  equity_start: number;
  equity_high: number;
  drawdown_current: number;
  daily_pnl: number;
  drawdown_mode: DrawdownMode;
  rules_json: string;
  created_at: string;
  updated_at: string;
}

export type BrokerType =
  | "alpaca_paper"
  | "alpaca_live"
  | "paper"
  | "tradingview"
  | "ibkr"
  | "schwab"
  | "tastytrade"
  | "tradestation"
  | "etrade";

export interface DashboardState {
  account: AccountInfo | null;
  positions: Position[];
  orders: Order[];
  bars: Record<string, Bar[]>;
  signals: TradeSignal[];
  risk: RiskState | null;
  regime: RegimeState | null;
  strategies: StrategyState[];
  connection: ConnectionStatus;
  kill_switch: KillSwitchState;
  prop_firm: PropFirmState | null;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  last_update: string | null;
  active_view: string;
}