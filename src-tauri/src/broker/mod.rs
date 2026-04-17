pub mod error;
pub mod env;
pub mod alpaca;
pub mod paper;
pub mod tradingview;
pub mod schwab;
pub mod ibkr;
pub mod tastytrade;
pub mod tradestation;
pub mod etrade;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub use self::error::BrokerError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BrokerType {
    AlpacaPaper,
    AlpacaLive,
    Paper,
    TradingView,
    IBKR,
    Schwab,
    TastyTrade,
    TradeStation,
    ETrade,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderRequest {
    pub symbol: String,
    pub side: String,
    pub qty: f64,
    pub order_type: String,
    pub limit_price: Option<f64>,
    pub stop_price: Option<f64>,
    pub time_in_force: String,
    pub client_order_id: Option<String>,
    pub asset_class: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResult {
    pub id: String,
    pub client_order_id: String,
    pub status: String,
    pub filled_qty: f64,
    pub filled_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub symbol: String,
    pub qty: f64,
    pub side: String,
    pub market_value: f64,
    pub cost_basis: f64,
    pub unrealized_pl: f64,
    pub unrealized_plpc: f64,
    pub current_price: f64,
    pub avg_entry_price: f64,
    pub asset_class: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub id: String,
    pub cash: f64,
    pub portfolio_value: f64,
    pub equity: f64,
    pub buying_power: f64,
    pub status: String,
    pub pattern_day_trader: bool,
    pub trading_blocked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub symbol: String,
    pub latest_quote: Option<QuoteData>,
    pub latest_trade: Option<TradeData>,
    pub prev_daily_bar: Option<BarData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteData {
    pub bid: f64,
    pub ask: f64,
    pub bid_size: f64,
    pub ask_size: f64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeData {
    pub price: f64,
    pub size: f64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarData {
    pub symbol: String,
    pub timestamp: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

pub trait BrokerAdapter: Send + Sync {
    fn submit_order(&self, order: OrderRequest) -> Result<OrderResult, BrokerError>;
    fn cancel_order(&self, order_id: &str) -> Result<bool, BrokerError>;
    fn get_position(&self, symbol: &str) -> Result<Option<Position>, BrokerError>;
    fn get_positions(&self) -> Result<Vec<Position>, BrokerError>;
    fn get_account(&self) -> Result<AccountInfo, BrokerError>;
    fn get_equity(&self) -> Result<f64, BrokerError>;
    fn get_cash(&self) -> Result<f64, BrokerError>;
    fn get_buying_power(&self) -> Result<f64, BrokerError>;
    fn is_live(&self) -> bool;
    fn name(&self) -> &str;
}

pub type BrokerRef = Arc<RwLock<Box<dyn BrokerAdapter>>>;

pub fn create_broker(broker_type: &BrokerType) -> Result<BrokerRef, BrokerError> {
    let broker: Box<dyn BrokerAdapter> = match broker_type {
        BrokerType::AlpacaPaper => Box::new(alpaca::AlpacaAdapter::new_paper()?),
        BrokerType::AlpacaLive => Box::new(alpaca::AlpacaAdapter::new_live()?),
        BrokerType::Paper => Box::new(paper::PaperBroker::new()),
        BrokerType::TradingView => Box::new(tradingview::TVPaperBroker::new()),
        BrokerType::IBKR => Box::new(ibkr::IbkrAdapter::new()),
        BrokerType::Schwab => Box::new(schwab::SchwabAdapter::new()),
        BrokerType::TastyTrade => Box::new(tastytrade::TastyTradeAdapter::new()),
        BrokerType::TradeStation => Box::new(tradestation::TradeStationAdapter::new()),
        BrokerType::ETrade => Box::new(etrade::ETradeAdapter::new()),
    };
    Ok(Arc::new(RwLock::new(broker)))
}

pub struct BrokerRegistry {
    brokers: HashMap<String, BrokerRef>,
    active: Option<String>,
}

impl BrokerRegistry {
    pub fn new() -> Self {
        Self {
            brokers: HashMap::new(),
            active: None,
        }
    }

    pub fn register(&mut self, name: &str, broker: BrokerRef) {
        self.brokers.insert(name.to_string(), broker);
    }

    pub fn activate(&mut self, name: &str) -> Result<(), BrokerError> {
        if self.brokers.contains_key(name) {
            self.active = Some(name.to_string());
            Ok(())
        } else {
            Err(BrokerError::ConfigError(format!("Broker '{}' not found in registry", name)))
        }
    }

    pub fn get_active(&self) -> Option<&BrokerRef> {
        self.active.as_ref().and_then(|name| self.brokers.get(name))
    }

    pub fn get(&self, name: &str) -> Option<&BrokerRef> {
        self.brokers.get(name)
    }

    pub fn active_name(&self) -> Option<&str> {
        self.active.as_deref()
    }

    pub fn deactivate(&mut self) {
        self.active = None;
    }

    pub fn list(&self) -> Vec<String> {
        self.brokers.keys().cloned().collect()
    }
}