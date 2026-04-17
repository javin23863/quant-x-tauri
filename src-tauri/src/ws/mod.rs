use log::info;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AlpacaStream {
    api_key: String,
    secret_key: String,
    url: String,
    connected: Arc<RwLock<bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StreamEvent {
    Trade { symbol: String, price: f64, size: f64, timestamp: String },
    Quote { symbol: String, bid: f64, ask: f64, timestamp: String },
    Bar { symbol: String, open: f64, high: f64, low: f64, close: f64, volume: f64, timestamp: String },
}

impl AlpacaStream {
    pub fn new(api_key: String, secret_key: String, paper: bool) -> Self {
        let url = if paper {
            "wss://paper-api.alpaca.markets/stream".to_string()
        } else {
            "wss://stream.data.alpaca.markets/v2/iex".to_string()
        };
        Self {
            api_key,
            secret_key,
            url,
            connected: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn connect(&self) -> Result<(), String> {
        info!("Connecting to Alpaca stream: {}", self.url);
        *self.connected.write().await = true;
        Ok(())
    }

    pub async fn subscribe(&self, _symbols: &[&str]) -> Result<(), String> {
        if !*self.connected.read().await {
            return Err("Not connected".to_string());
        }
        info!("Subscribing to symbols stream");
        Ok(())
    }

    pub async fn unsubscribe(&self, _symbols: &[&str]) -> Result<(), String> {
        if !*self.connected.read().await {
            return Err("Not connected".to_string());
        }
        Ok(())
    }

    pub async fn reconnect(&self) -> Result<(), String> {
        *self.connected.write().await = false;
        self.connect().await
    }

    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    pub async fn disconnect(&self) {
        *self.connected.write().await = false;
        info!("Disconnected from Alpaca stream");
    }
}