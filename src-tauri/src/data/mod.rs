pub mod alpaca_data;
pub mod tradingview;

use crate::broker::{BarData, BrokerError};

pub trait DataProvider: Send + Sync {
    fn get_historical_bars(&self, symbol: &str, timeframe: &str, start: &str, end: &str) -> Result<Vec<BarData>, BrokerError>;
    fn get_latest_bar(&self, symbol: &str) -> Result<BarData, BrokerError>;
    fn get_market_status(&self) -> Result<bool, BrokerError>;
    fn name(&self) -> &str;
}