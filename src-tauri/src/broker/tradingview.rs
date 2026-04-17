use crate::broker::{BrokerAdapter, BrokerError, OrderRequest, OrderResult, Position, AccountInfo};
use std::collections::HashMap;
use std::sync::Mutex;

pub struct ContractSpec {
    pub symbol: &'static str,
    pub name: &'static str,
    pub exchange: &'static str,
    pub point_value: f64,
    pub tick_size: f64,
    pub tick_value: f64,
    pub margin: f64,
    pub currency: &'static str,
    pub category: &'static str,
}

pub static CONTRACT_SPECS: &[ContractSpec] = &[
    ContractSpec { symbol: "MES", name: "Micro E-mini S&P 500", exchange: "CME", point_value: 5.0, tick_size: 0.25, tick_value: 1.25, margin: 50.0, currency: "USD", category: "index" },
    ContractSpec { symbol: "MNQ", name: "Micro E-mini Nasdaq-100", exchange: "CME", point_value: 2.0, tick_size: 0.25, tick_value: 0.50, margin: 50.0, currency: "USD", category: "index" },
    ContractSpec { symbol: "MYM", name: "Micro E-mini Dow Jones", exchange: "CBOT", point_value: 0.50, tick_size: 1.0, tick_value: 0.50, margin: 50.0, currency: "USD", category: "index" },
    ContractSpec { symbol: "M2K", name: "Micro E-mini Russell 2000", exchange: "CME", point_value: 0.50, tick_size: 0.10, tick_value: 0.05, margin: 50.0, currency: "USD", category: "index" },
    ContractSpec { symbol: "MBT", name: "Micro Bitcoin Futures", exchange: "CME", point_value: 0.1, tick_size: 5.0, tick_value: 0.50, margin: 50.0, currency: "USD", category: "crypto" },
    ContractSpec { symbol: "MET", name: "Micro Ether Futures", exchange: "CME", point_value: 0.1, tick_size: 0.25, tick_value: 0.025, margin: 50.0, currency: "USD", category: "crypto" },
    ContractSpec { symbol: "MCL", name: "Micro Crude Oil", exchange: "NYMEX", point_value: 100.0, tick_size: 0.01, tick_value: 1.00, margin: 100.0, currency: "USD", category: "energy" },
    ContractSpec { symbol: "MGC", name: "Micro Gold", exchange: "COMEX", point_value: 10.0, tick_size: 0.10, tick_value: 1.00, margin: 100.0, currency: "USD", category: "metal" },
    ContractSpec { symbol: "MSI", name: "Micro Silver", exchange: "COMEX", point_value: 5.0, tick_size: 0.001, tick_value: 0.005, margin: 100.0, currency: "USD", category: "metal" },
    ContractSpec { symbol: "ES", name: "E-mini S&P 500", exchange: "CME", point_value: 50.0, tick_size: 0.25, tick_value: 12.50, margin: 500.0, currency: "USD", category: "index" },
    ContractSpec { symbol: "NQ", name: "E-mini Nasdaq-100", exchange: "CME", point_value: 20.0, tick_size: 0.25, tick_value: 5.00, margin: 500.0, currency: "USD", category: "index" },
    ContractSpec { symbol: "YM", name: "E-mini Dow Jones", exchange: "CBOT", point_value: 5.0, tick_size: 1.0, tick_value: 5.00, margin: 500.0, currency: "USD", category: "index" },
    ContractSpec { symbol: "CL", name: "Crude Oil", exchange: "NYMEX", point_value: 1000.0, tick_size: 0.01, tick_value: 10.00, margin: 1000.0, currency: "USD", category: "energy" },
    ContractSpec { symbol: "GC", name: "Gold", exchange: "COMEX", point_value: 100.0, tick_size: 0.10, tick_value: 10.00, margin: 1000.0, currency: "USD", category: "metal" },
];

static STANDARD_TO_MICRO: &[(&str, &str)] = &[
    ("ES1!", "MES"),
    ("NQ1!", "MNQ"),
    ("YM1!", "MYM"),
    ("RTY1!", "M2K"),
    ("CL1!", "MCL"),
    ("GC1!", "MGC"),
    ("SI1!", "MSI"),
    ("BTC1!", "MBT"),
    ("ETH1!", "MET"),
];

pub fn to_micro_symbol(symbol: &str) -> String {
    let upper = symbol.to_uppercase();
    for (standard, micro) in STANDARD_TO_MICRO {
        if *standard == upper {
            return micro.to_string();
        }
    }
    symbol.to_string()
}

pub fn is_standard_futures(symbol: &str) -> bool {
    let upper = symbol.to_uppercase();
    STANDARD_TO_MICRO.iter().any(|(s, _)| *s == upper)
}

pub fn get_contract_spec(symbol: &str) -> Option<&'static ContractSpec> {
    CONTRACT_SPECS.iter().find(|c| c.symbol == symbol)
}

fn asset_class_for_symbol(symbol: &str) -> &'static str {
    let upper = symbol.to_uppercase();
    if upper.ends_with("1!") || upper.starts_with("ES") || upper.starts_with("NQ") || upper.starts_with("YM") || upper.starts_with("RTY") || upper.starts_with("MES") || upper.starts_with("MNQ") || upper.starts_with("MYM") || upper.starts_with("M2K") || upper.starts_with("MET") {
        "index"
    } else if upper.starts_with("CL") || upper.starts_with("MCL") {
        "energy"
    } else if upper.starts_with("GC") || upper.starts_with("MGC") || upper.starts_with("SI") || upper.starts_with("MSI") {
        "metal"
    } else if upper.starts_with("MBT") || upper.contains("BTC") || upper.contains("ETH") {
        "crypto"
    } else if upper.len() == 6 || upper.contains("/") {
        "forex"
    } else {
        "crypto"
    }
}

fn multiplier_for_symbol(symbol: &str) -> f64 {
    if let Some(spec) = get_contract_spec(symbol) {
        return spec.point_value;
    }
    let upper = symbol.to_uppercase();
    if upper.len() == 6 || upper.contains("/") {
        return 1.0;
    }
    1.0
}

#[derive(Clone)]
struct TvPosition {
    symbol: String,
    direction: String,
    entry_price: f64,
    qty: f64,
    multiplier: f64,
    opened_at: String,
}

struct TvTrade {
    symbol: String,
    direction: String,
    entry_price: f64,
    exit_price: f64,
    qty: f64,
    multiplier: f64,
    pnl: f64,
    opened_at: String,
    closed_at: String,
}

struct TvStats {
    trades: u32,
    wins: u32,
    losses: u32,
    cumulative_pnl: f64,
    max_drawdown: f64,
    gross_profit: f64,
    gross_loss: f64,
}

impl TvStats {
    fn new() -> Self {
        Self {
            trades: 0,
            wins: 0,
            losses: 0,
            cumulative_pnl: 0.0,
            max_drawdown: 0.0,
            gross_profit: 0.0,
            gross_loss: 0.0,
        }
    }

    fn win_rate(&self) -> f64 {
        if self.trades == 0 { 0.0 } else { self.wins as f64 / self.trades as f64 }
    }

    fn profit_factor(&self) -> Option<f64> {
        if self.gross_loss > 0.0 { Some(self.gross_profit / self.gross_loss) } else { None }
    }
}

struct TvState {
    equity: f64,
    peak_equity: f64,
    initial_equity: f64,
    default_qty: f64,
    positions: HashMap<String, TvPosition>,
    trades: Vec<TvTrade>,
    stats: HashMap<String, TvStats>,
}

pub struct TVPaperBroker {
    state: Mutex<TvState>,
}

impl TVPaperBroker {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(TvState {
                equity: 100_000.0,
                peak_equity: 100_000.0,
                initial_equity: 100_000.0,
                default_qty: 1.0,
                positions: HashMap::new(),
                trades: Vec::new(),
                stats: HashMap::new(),
            }),
        }
    }

    pub fn with_config(initial_equity: f64, default_qty: f64) -> Self {
        Self {
            state: Mutex::new(TvState {
                equity: initial_equity,
                peak_equity: initial_equity,
                initial_equity,
                default_qty,
                positions: HashMap::new(),
                trades: Vec::new(),
                stats: HashMap::new(),
            }),
        }
    }

    pub fn on_signal(&self, hypothesis_id: &str, symbol: &str, action: &str, price: f64, qty: Option<f64>) -> Result<serde_json::Value, BrokerError> {
        let mut state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;

        if price <= 0.0 {
            return Ok(serde_json::json!({ "filled": false, "reason": "No valid price in signal" }));
        }

        let exec_symbol = to_micro_symbol(symbol);
        let multiplier = multiplier_for_symbol(&exec_symbol);
        let fill_qty = qty.unwrap_or(state.default_qty);

        match action {
            "buy" => Self::open_position(&mut state, hypothesis_id, &exec_symbol, "long", price, fill_qty, multiplier),
            "sell" => Self::open_position(&mut state, hypothesis_id, &exec_symbol, "short", price, fill_qty, multiplier),
            "close_long" => Self::close_position(&mut state, hypothesis_id, "long", price, multiplier),
            "close_short" => Self::close_position(&mut state, hypothesis_id, "short", price, multiplier),
            _ => Ok(serde_json::json!({ "filled": false, "reason": format!("Unhandled action: {}", action) })),
        }
    }

    fn open_position(
        state: &mut TvState,
        hypothesis_id: &str,
        symbol: &str,
        direction: &str,
        price: f64,
        qty: f64,
        multiplier: f64,
    ) -> Result<serde_json::Value, BrokerError> {
        if let Some(existing) = state.positions.get(hypothesis_id) {
            if existing.direction == direction {
                return Ok(serde_json::json!({
                    "filled": false,
                    "reason": format!("Already {} for {}", direction, hypothesis_id)
                }));
            }
            let mult = existing.multiplier;
            let dir = existing.direction.clone();
            Self::close_position(state, hypothesis_id, &dir, price, mult).ok();
        }

        let opened_at = chrono::Utc::now().to_rfc3339();
        state.positions.insert(
            hypothesis_id.to_string(),
            TvPosition {
                symbol: symbol.to_string(),
                direction: direction.to_string(),
                entry_price: price,
                qty,
                multiplier,
                opened_at: opened_at.clone(),
            },
        );

        Ok(serde_json::json!({
            "filled": true,
            "action": if direction == "long" { "buy" } else { "sell" },
            "hypothesisId": hypothesis_id,
            "symbol": symbol,
            "direction": direction,
            "price": price,
            "qty": qty,
            "openedAt": opened_at,
        }))
    }

    fn close_position(
        state: &mut TvState,
        hypothesis_id: &str,
        direction: &str,
        exit_price: f64,
        multiplier: f64,
    ) -> Result<serde_json::Value, BrokerError> {
        let position = state.positions.remove(hypothesis_id).ok_or_else(|| {
            BrokerError::NoPosition(format!("No open {} position for {}", direction, hypothesis_id))
        })?;

        if position.direction != direction {
            let dir = position.direction.clone();
            state.positions.insert(hypothesis_id.to_string(), position);
            return Ok(serde_json::json!({
                "filled": false,
                "reason": format!("Direction mismatch: have {}, closing {}", dir, direction)
            }));
        }

        let price_diff = if direction == "long" {
            exit_price - position.entry_price
        } else {
            position.entry_price - exit_price
        };
        let pnl = price_diff * position.qty * multiplier;

        state.equity += pnl;
        if state.equity > state.peak_equity {
            state.peak_equity = state.equity;
        }
        let drawdown = if state.peak_equity > 0.0 {
            (state.peak_equity - state.equity) / state.peak_equity
        } else {
            0.0
        };

        let closed_at = chrono::Utc::now().to_rfc3339();
        let trade = TvTrade {
            symbol: position.symbol.clone(),
            direction: direction.to_string(),
            entry_price: position.entry_price,
            exit_price,
            qty: position.qty,
            multiplier,
            pnl,
            opened_at: position.opened_at.clone(),
            closed_at: closed_at.clone(),
        };

        state.trades.push(TvTrade {
            symbol: trade.symbol.clone(),
            direction: trade.direction.clone(),
            entry_price: trade.entry_price,
            exit_price: trade.exit_price,
            qty: trade.qty,
            multiplier: trade.multiplier,
            pnl: trade.pnl,
            opened_at: trade.opened_at.clone(),
            closed_at: trade.closed_at.clone(),
        });

        Self::update_stats(state, hypothesis_id, pnl, drawdown);

        Ok(serde_json::json!({
            "filled": true,
            "action": "close",
            "hypothesisId": hypothesis_id,
            "symbol": position.symbol,
            "direction": direction,
            "entryPrice": position.entry_price,
            "exitPrice": exit_price,
            "qty": position.qty,
            "pnl": pnl,
            "multiplier": multiplier,
            "equity": state.equity,
            "drawdown": drawdown,
        }))
    }

    fn update_stats(state: &mut TvState, hypothesis_id: &str, pnl: f64, drawdown: f64) {
        let stats = state.stats.entry(hypothesis_id.to_string()).or_insert_with(TvStats::new);
        stats.trades += 1;
        stats.cumulative_pnl += pnl;
        if pnl > 0.0 {
            stats.wins += 1;
            stats.gross_profit += pnl;
        } else {
            stats.losses += 1;
            stats.gross_loss += pnl.abs();
        }
        if drawdown > stats.max_drawdown {
            stats.max_drawdown = drawdown;
        }
    }

    pub fn get_summary(&self) -> Result<serde_json::Value, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        let total_pnl: f64 = state.trades.iter().map(|t| t.pnl).sum();
        let wins = state.trades.iter().filter(|t| t.pnl > 0.0).count();
        let drawdown = if state.peak_equity > 0.0 {
            (state.peak_equity - state.equity) / state.peak_equity
        } else {
            0.0
        };
        Ok(serde_json::json!({
            "equity": state.equity,
            "totalPnL": total_pnl,
            "totalTrades": state.trades.len(),
            "winRate": if state.trades.is_empty() { 0.0 } else { wins as f64 / state.trades.len() as f64 },
            "openPositions": state.positions.len(),
            "drawdown": drawdown,
        }))
    }

    pub fn get_stats(&self, hypothesis_id: &str) -> Result<serde_json::Value, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state
            .stats
            .get(hypothesis_id)
            .map(|s| {
                serde_json::json!({
                    "trades": s.trades,
                    "wins": s.wins,
                    "losses": s.losses,
                    "cumulativePnL": s.cumulative_pnl,
                    "maxDrawdown": s.max_drawdown,
                    "winRate": s.win_rate(),
                    "profitFactor": s.profit_factor(),
                })
            })
            .unwrap_or(serde_json::json!(null)))
    }

    pub fn reset(&self) -> Result<(), BrokerError> {
        let mut state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        state.positions.clear();
        state.trades.clear();
        state.stats.clear();
        state.equity = state.initial_equity;
        state.peak_equity = state.initial_equity;
        Ok(())
    }
}

impl BrokerAdapter for TVPaperBroker {
    fn submit_order(&self, order: OrderRequest) -> Result<OrderResult, BrokerError> {
        let action = match order.side.as_str() {
            "buy" => "buy",
            "sell" => "sell",
            _ => "buy",
        };

        let exec_symbol = to_micro_symbol(&order.symbol);
        let multiplier = multiplier_for_symbol(&exec_symbol);

        let mut state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        let hypothesis_id = order.client_order_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        if let Some(existing) = state.positions.get(&hypothesis_id) {
            if existing.direction == action {
                return Err(BrokerError::InvalidOrder(format!(
                    "Already {} for {}",
                    action, hypothesis_id
                )));
            }
            let mult = existing.multiplier;
            let dir = existing.direction.clone();
            let close_price = order.limit_price.unwrap_or(existing.entry_price);
            let _ = Self::close_position(&mut state, &hypothesis_id, &dir, close_price, mult);
        }

        let entry_price = order
            .limit_price
            .unwrap_or_else(|| state.positions.get(&hypothesis_id).map(|p| p.entry_price).unwrap_or(100.0));
        let qty = order.qty;

        state.positions.insert(
            hypothesis_id.clone(),
            TvPosition {
                symbol: exec_symbol.clone(),
                direction: action.to_string(),
                entry_price,
                qty,
                multiplier,
                opened_at: chrono::Utc::now().to_rfc3339(),
            },
        );

        let order_id = uuid::Uuid::new_v4().to_string();
        let client_order_id = format!("tv-{}", chrono::Utc::now().timestamp_millis());

        Ok(OrderResult {
            id: order_id,
            client_order_id,
            status: "filled".to_string(),
            filled_qty: qty,
            filled_at: Some(chrono::Utc::now().to_rfc3339()),
        })
    }

    fn cancel_order(&self, _order_id: &str) -> Result<bool, BrokerError> {
        Ok(true)
    }

    fn get_position(&self, symbol: &str) -> Result<Option<Position>, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        for pos in state.positions.values() {
            if pos.symbol == symbol {
                return Ok(Some(Position {
                    symbol: pos.symbol.clone(),
                    qty: pos.qty,
                    side: pos.direction.clone(),
                    market_value: pos.qty * pos.entry_price * pos.multiplier,
                    cost_basis: pos.qty * pos.entry_price * pos.multiplier,
                    unrealized_pl: 0.0,
                    unrealized_plpc: 0.0,
                    current_price: pos.entry_price,
                    avg_entry_price: pos.entry_price,
                    asset_class: Some(asset_class_for_symbol(&pos.symbol).to_string()),
                }));
            }
        }
        Ok(None)
    }

    fn get_positions(&self) -> Result<Vec<Position>, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state
            .positions
            .values()
            .map(|pos| Position {
                symbol: pos.symbol.clone(),
                qty: pos.qty,
                side: pos.direction.clone(),
                market_value: pos.qty * pos.entry_price * pos.multiplier,
                cost_basis: pos.qty * pos.entry_price * pos.multiplier,
                unrealized_pl: 0.0,
                unrealized_plpc: 0.0,
                current_price: pos.entry_price,
                avg_entry_price: pos.entry_price,
                asset_class: Some(asset_class_for_symbol(&pos.symbol).to_string()),
            })
            .collect())
    }

    fn get_account(&self) -> Result<AccountInfo, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(AccountInfo {
            id: "tv-paper-account".to_string(),
            cash: state.equity,
            portfolio_value: state.equity,
            equity: state.equity,
            buying_power: state.equity * 4.0,
            status: "active".to_string(),
            pattern_day_trader: false,
            trading_blocked: false,
        })
    }

    fn get_equity(&self) -> Result<f64, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state.equity)
    }

    fn get_cash(&self) -> Result<f64, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state.equity)
    }

    fn get_buying_power(&self) -> Result<f64, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state.equity * 4.0)
    }

    fn is_live(&self) -> bool {
        false
    }

    fn name(&self) -> &str {
        "TVPaperBroker"
    }
}