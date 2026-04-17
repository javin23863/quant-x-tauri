use crate::broker::{BarData, BrokerError};
use crate::data::DataProvider;

pub struct TradingViewDataProvider {
    client: reqwest::Client,
}

impl TradingViewDataProvider {
    pub fn new() -> Self {
        Self { client: reqwest::Client::new() }
    }
}

impl DataProvider for TradingViewDataProvider {
    fn get_historical_bars(&self, _symbol: &str, _timeframe: &str, _start: &str, _end: &str) -> Result<Vec<BarData>, BrokerError> {
        Err(BrokerError::NotImplemented)
    }

    fn get_latest_bar(&self, _symbol: &str) -> Result<BarData, BrokerError> {
        Err(BrokerError::NotImplemented)
    }

    fn get_market_status(&self) -> Result<bool, BrokerError> {
        Err(BrokerError::NotImplemented)
    }

    fn name(&self) -> &str { "TradingView" }
}