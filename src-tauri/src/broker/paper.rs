use crate::broker::{BrokerAdapter, BrokerError, OrderRequest, OrderResult, Position, AccountInfo};
use std::collections::HashMap;
use std::sync::Mutex;

pub struct PaperBroker {
    state: Mutex<PaperState>,
}

struct PaperState {
    equity: f64,
    cash: f64,
    initial_equity: f64,
    positions: HashMap<String, TrackedPosition>,
    orders: HashMap<String, TrackedOrder>,
    fills: Vec<FillRecord>,
    commission_per_share: f64,
    min_commission: f64,
    slippage_pct: f64,
}

struct TrackedPosition {
    symbol: String,
    qty: f64,
    avg_cost: f64,
    unrealized_pnl: f64,
    side: String,
}

struct TrackedOrder {
    id: String,
    symbol: String,
    side: String,
    qty: f64,
    order_type: String,
    status: String,
}

struct FillRecord {
    order_id: String,
    symbol: String,
    side: String,
    filled_qty: f64,
    price: f64,
    commission: f64,
    slippage: f64,
    timestamp: String,
}

impl PaperBroker {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(PaperState {
                equity: 100_000.0,
                cash: 100_000.0,
                initial_equity: 100_000.0,
                positions: HashMap::new(),
                orders: HashMap::new(),
                fills: Vec::new(),
                commission_per_share: 0.005,
                min_commission: 1.00,
                slippage_pct: 0.0002,
            }),
        }
    }

    pub fn with_equity(initial_equity: f64) -> Self {
        Self {
            state: Mutex::new(PaperState {
                equity: initial_equity,
                cash: initial_equity,
                initial_equity,
                positions: HashMap::new(),
                orders: HashMap::new(),
                fills: Vec::new(),
                commission_per_share: 0.005,
                min_commission: 1.00,
                slippage_pct: 0.0002,
            }),
        }
    }

    fn apply_fill(state: &mut PaperState, symbol: &str, side: &str, qty: f64, price: f64) -> f64 {
        let commission = (qty * state.commission_per_share).max(state.min_commission);
        let slippage = price * state.slippage_pct;
        let fill_price = if side == "buy" {
            price + slippage
        } else {
            price - slippage
        };

        match side {
            "buy" => {
                let cost = qty * fill_price + commission;
                if let Some(pos) = state.positions.get_mut(symbol) {
                    let total_qty = pos.qty + qty;
                    pos.avg_cost = (pos.avg_cost * pos.qty + fill_price * qty) / total_qty;
                    pos.qty = total_qty;
                    pos.side = "long".to_string();
                } else {
                    state.positions.insert(
                        symbol.to_string(),
                        TrackedPosition {
                            symbol: symbol.to_string(),
                            qty,
                            avg_cost: fill_price,
                            unrealized_pnl: 0.0,
                            side: "long".to_string(),
                        },
                    );
                }
                state.cash -= cost;
            }
            "sell" | "close" => {
                let proceeds = qty * fill_price - commission;
                if let Some(pos) = state.positions.get_mut(symbol) {
                    let close_qty = qty.min(pos.qty);
                    pos.qty -= close_qty;
                    if pos.qty.abs() < 0.001 {
                        state.positions.remove(symbol);
                    }
                }
                state.cash += proceeds;
            }
            _ => {}
        }

        state
            .fills
            .push(FillRecord {
                order_id: uuid::Uuid::new_v4().to_string(),
                symbol: symbol.to_string(),
                side: side.to_string(),
                filled_qty: qty,
                price: fill_price,
                commission,
                slippage,
                timestamp: chrono::Utc::now().to_rfc3339(),
            });

        fill_price
    }

    fn recalc_equity(state: &mut PaperState) {
        let mut unrealized = 0.0;
        for pos in state.positions.values() {
            unrealized += pos.unrealized_pnl;
        }
        state.equity = state.cash + unrealized;
    }
}

impl BrokerAdapter for PaperBroker {
    fn submit_order(&self, order: OrderRequest) -> Result<OrderResult, BrokerError> {
        let mut state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;

        if order.qty <= 0.0 {
            return Err(BrokerError::InvalidOrder("Quantity must be positive".into()));
        }

        let order_id = uuid::Uuid::new_v4().to_string();
        let client_order_id = order
            .client_order_id
            .clone()
            .unwrap_or_else(|| format!("paper-{}", chrono::Utc::now().timestamp_millis()));

        let side = order.side.to_lowercase();
        let qty = order.qty;

        let _fill_price = match order.order_type.as_str() {
            "market" => {
                let ref_price = if let Some(price) = order.limit_price {
                    price
                } else if let Some(pos) = state.positions.get(&order.symbol) {
                    pos.avg_cost
                } else {
                    100.0
                };
                Self::apply_fill(&mut state, &order.symbol, &side, qty, ref_price)
            }
            "limit" => {
                if let Some(limit_price) = order.limit_price {
                    Self::apply_fill(&mut state, &order.symbol, &side, qty, limit_price)
                } else {
                    return Err(BrokerError::InvalidOrder(
                        "Limit order requires limit_price".into(),
                    ));
                }
            }
            _ => {
                return Err(BrokerError::InvalidOrder(format!(
                    "Unsupported order type: {}",
                    order.order_type
                )));
            }
        };

        Self::recalc_equity(&mut state);

        Ok(OrderResult {
            id: order_id,
            client_order_id,
            status: "filled".to_string(),
            filled_qty: qty,
            filled_at: Some(chrono::Utc::now().to_rfc3339()),
        })
    }

    fn cancel_order(&self, order_id: &str) -> Result<bool, BrokerError> {
        let mut state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        if let Some(order) = state.orders.remove(order_id) {
            state
                .orders
                .insert(order_id.to_string(), TrackedOrder { status: "cancelled".into(), ..order });
            Ok(true)
        } else {
            Ok(true)
        }
    }

    fn get_position(&self, symbol: &str) -> Result<Option<Position>, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state.positions.get(symbol).map(|pos| Position {
            symbol: pos.symbol.clone(),
            qty: pos.qty,
            side: pos.side.clone(),
            market_value: pos.qty * pos.avg_cost,
            cost_basis: pos.qty * pos.avg_cost,
            unrealized_pl: pos.unrealized_pnl,
            unrealized_plpc: if pos.avg_cost > 0.0 {
                pos.unrealized_pnl / (pos.qty * pos.avg_cost)
            } else {
                0.0
            },
            current_price: pos.avg_cost,
            avg_entry_price: pos.avg_cost,
            asset_class: None,
        }))
    }

    fn get_positions(&self) -> Result<Vec<Position>, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state
            .positions
            .values()
            .map(|pos| Position {
                symbol: pos.symbol.clone(),
                qty: pos.qty,
                side: pos.side.clone(),
                market_value: pos.qty * pos.avg_cost,
                cost_basis: pos.qty * pos.avg_cost,
                unrealized_pl: pos.unrealized_pnl,
                unrealized_plpc: if pos.avg_cost > 0.0 {
                    pos.unrealized_pnl / (pos.qty * pos.avg_cost)
                } else {
                    0.0
                },
                current_price: pos.avg_cost,
                avg_entry_price: pos.avg_cost,
                asset_class: None,
            })
            .collect())
    }

    fn get_account(&self) -> Result<AccountInfo, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        let is_pdt = state.equity < 25_000.0;
        Ok(AccountInfo {
            id: "paper-account".to_string(),
            cash: state.cash,
            portfolio_value: state.equity,
            equity: state.equity,
            buying_power: if is_pdt {
                state.cash * 1.0
            } else {
                state.cash * 4.0
            },
            status: "active".to_string(),
            pattern_day_trader: is_pdt,
            trading_blocked: false,
        })
    }

    fn get_equity(&self) -> Result<f64, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state.equity)
    }

    fn get_cash(&self) -> Result<f64, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        Ok(state.cash)
    }

    fn get_buying_power(&self) -> Result<f64, BrokerError> {
        let state = self.state.lock().map_err(|e| BrokerError::AccountError(e.to_string()))?;
        let is_pdt = state.equity < 25_000.0;
        Ok(if is_pdt {
            state.cash * 1.0
        } else {
            state.cash * 4.0
        })
    }

    fn is_live(&self) -> bool {
        false
    }

    fn name(&self) -> &str {
        "PaperBroker"
    }
}