use crate::broker::{BarData, BrokerError};
use crate::data::DataProvider;

pub struct AlpacaDataProvider {
    client: reqwest::Client,
    api_key: String,
    secret_key: String,
    base_url: String,
}

impl AlpacaDataProvider {
    pub fn new(api_key: String, secret_key: String, paper: bool) -> Self {
        let base_url = if paper {
            "https://paper-api.alpaca.markets".to_string()
        } else {
            "https://data.alpaca.markets".to_string()
        };
        Self {
            client: reqwest::Client::new(),
            api_key,
            secret_key,
            base_url,
        }
    }
}

impl DataProvider for AlpacaDataProvider {
    fn get_historical_bars(&self, _symbol: &str, _timeframe: &str, _start: &str, _end: &str) -> Result<Vec<BarData>, BrokerError> {
        Err(BrokerError::NotImplemented)
    }

    fn get_latest_bar(&self, _symbol: &str) -> Result<BarData, BrokerError> {
        Err(BrokerError::NotImplemented)
    }

    fn get_market_status(&self) -> Result<bool, BrokerError> {
        Err(BrokerError::NotImplemented)
    }

    fn name(&self) -> &str { "AlpacaData" }
}