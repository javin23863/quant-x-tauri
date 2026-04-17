use crate::broker::{AccountInfo, BrokerAdapter, BrokerError, OrderRequest, OrderResult, Position};
use crate::broker::env;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct AlpacaAdapter {
    client: reqwest::Client,
    api_key: String,
    secret_key: String,
    base_url: String,
    is_live: bool,
    order_counter: AtomicU64,
    max_retries: u32,
    base_delay_ms: u64,
}

impl AlpacaAdapter {
    pub fn new_paper() -> Result<Self, BrokerError> {
        let (api_key, secret_key, base_url) =
            env::load_alpaca_keys().map_err(BrokerError::ConfigError)?;
        Ok(Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()?,
            api_key,
            secret_key,
            base_url,
            is_live: false,
            order_counter: AtomicU64::new(0),
            max_retries: 3,
            base_delay_ms: 1000,
        })
    }

    pub fn new_live() -> Result<Self, BrokerError> {
        let (api_key, secret_key) =
            env::load_alpaca_live_keys().map_err(BrokerError::ConfigError)?;
        if std::env::var("LIVE_TRADING_ENABLED") != Ok("true".to_string()) {
            return Err(BrokerError::ConfigError(
                "LiveAlpacaAdapter requires LIVE_TRADING_ENABLED=true".into(),
            ));
        }
        Ok(Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()?,
            api_key,
            secret_key,
            base_url: "https://api.alpaca.markets".to_string(),
            is_live: true,
            order_counter: AtomicU64::new(0),
            max_retries: 3,
            base_delay_ms: 1000,
        })
    }

    fn headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "APCA-API-KEY-ID",
            self.api_key.parse().unwrap_or_else(|_| "invalid".parse().unwrap()),
        );
        headers.insert(
            "APCA-API-SECRET-KEY",
            self.secret_key.parse().unwrap_or_else(|_| "invalid".parse().unwrap()),
        );
        headers
    }

    fn generate_client_order_id(&self) -> String {
        let counter = self.order_counter.fetch_add(1, Ordering::Relaxed);
        let ts = chrono::Utc::now().timestamp_millis();
        format!("qx-{}-{}", ts, counter)
    }

    async fn retry_request<F, Fut, T>(&self, f: F) -> Result<T, BrokerError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, BrokerError>>,
    {
        let mut last_err = None;
        for attempt in 0..=self.max_retries {
            match f().await {
                Ok(v) => return Ok(v),
                Err(e) => {
                    let should_retry = matches!(
                        &e,
                        BrokerError::Network(_)
                            | BrokerError::RateLimitExceeded
                            | BrokerError::HttpError(_)
                    );
                    if !should_retry || attempt >= self.max_retries {
                        return Err(e);
                    }
                    let delay = self.base_delay_ms * 2u64.pow(attempt);
                    last_err = Some(e);
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                }
            }
        }
        Err(last_err.unwrap_or_else(|| BrokerError::RetryExhausted("unknown".into())))
    }

    async fn get_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, BrokerError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .client
            .get(&url)
            .headers(self.headers())
            .send()
            .await?;

        let status = resp.status();
        if status.as_u16() == 429 {
            return Err(BrokerError::RateLimitExceeded);
        }
        if status.as_u16() == 404 {
            return Err(BrokerError::PositionNotFound(path.into()));
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(BrokerError::Network(format!("HTTP {} {}: {}", status, path, body)));
        }
        resp.json::<T>().await.map_err(|e| BrokerError::Network(e.to_string()))
    }

    async fn post_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &serde_json::Value,
    ) -> Result<T, BrokerError> {
        self.retry_request(|| {
            let client = self.client.clone();
            let url = format!("{}{}", self.base_url, path);
            let headers = self.headers();
            let body = body.clone();
            async move {
                let resp = client
                    .post(&url)
                    .headers(headers)
                    .json(&body)
                    .send()
                    .await?;

                let status = resp.status();
                if status.as_u16() == 429 {
                    return Err(BrokerError::RateLimitExceeded);
                }
                if !status.is_success() {
                    let resp_body = resp.text().await.unwrap_or_default();
                    return Err(BrokerError::OrderRejected(format!(
                        "HTTP {}: {}",
                        status, resp_body
                    )));
                }
                let text = resp.text().await.map_err(|e| BrokerError::Network(e.to_string()))?;
                serde_json::from_str::<T>(&text)
                    .map_err(|e| BrokerError::Network(e.to_string()))
            }
        })
        .await
    }

    async fn delete_json(&self, path: &str) -> Result<bool, BrokerError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.delete(&url).headers(self.headers()).send().await?;
        let status = resp.status();
        if status.as_u16() == 422 {
            return Ok(true);
        }
        Ok(status.is_success())
    }

    pub async fn get_clock(&self) -> Result<serde_json::Value, BrokerError> {
        self.get_json("/v2/clock").await
    }

    pub async fn is_market_open(&self) -> Result<bool, BrokerError> {
        let clock = self.get_clock().await?;
        Ok(clock["is_open"].as_bool().unwrap_or(false))
    }

    pub async fn check_pdt(&self) -> Result<PdtStatus, BrokerError> {
        let account = self.get_account_internal().await?;
        Ok(PdtStatus {
            is_pattern_day_trader: account.pattern_day_trader,
            day_trade_count: 0,
            day_trades_remaining: if account.pattern_day_trader {
                3_i32.saturating_sub(0)
            } else {
                -1
            },
            trading_blocked: account.trading_blocked,
        })
    }

    async fn get_account_internal(&self) -> Result<AccountInfo, BrokerError> {
        let val: serde_json::Value = self.get_json("/v2/account").await?;
        Ok(AccountInfo {
            id: val["id"].as_str().unwrap_or_default().to_string(),
            cash: val["cash"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["cash"].as_f64())
                .unwrap_or(0.0),
            portfolio_value: val["portfolio_value"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["portfolio_value"].as_f64())
                .unwrap_or(0.0),
            equity: val["equity"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["equity"].as_f64())
                .unwrap_or(0.0),
            buying_power: val["buying_power"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["buying_power"].as_f64())
                .unwrap_or(0.0),
            status: val["status"].as_str().unwrap_or("inactive").to_string(),
            pattern_day_trader: val["pattern_day_trader"].as_bool().unwrap_or(false),
            trading_blocked: val["trading_blocked"].as_bool().unwrap_or(false),
        })
    }

    fn parse_position(val: &serde_json::Value) -> Position {
        Position {
            symbol: val["symbol"].as_str().unwrap_or_default().to_string(),
            qty: val["qty"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["qty"].as_f64())
                .unwrap_or(0.0),
            side: val["side"].as_str().unwrap_or("long").to_string(),
            market_value: val["market_value"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["market_value"].as_f64())
                .unwrap_or(0.0),
            cost_basis: val["cost_basis"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["cost_basis"].as_f64())
                .unwrap_or(0.0),
            unrealized_pl: val["unrealized_pl"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["unrealized_pl"].as_f64())
                .unwrap_or(0.0),
            unrealized_plpc: val["unrealized_plpc"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["unrealized_plpc"].as_f64())
                .unwrap_or(0.0),
            current_price: val["current_price"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["current_price"].as_f64())
                .unwrap_or(0.0),
            avg_entry_price: val["avg_entry_price"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| val["avg_entry_price"].as_f64())
                .unwrap_or(0.0),
            asset_class: val["asset_class"].as_str().map(|s| s.to_string()),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PdtStatus {
    pub is_pattern_day_trader: bool,
    pub day_trade_count: i32,
    pub day_trades_remaining: i32,
    pub trading_blocked: bool,
}

impl BrokerAdapter for AlpacaAdapter {
    fn submit_order(&self, order: OrderRequest) -> Result<OrderResult, BrokerError> {
        if self.is_live {
            let equity = self.get_equity()?;
            if equity < 25_000.0 {
                let account = self.get_account()?;
                if account.pattern_day_trader {
                    return Err(BrokerError::PdtRestricted(format!(
                        "PDT account with equity ${:.2} < $25,000 minimum",
                        equity
                    )));
                }
            }
        }

        let client_order_id = order
            .client_order_id
            .clone()
            .unwrap_or_else(|| self.generate_client_order_id());

        let mut body = serde_json::json!({
            "symbol": order.symbol,
            "side": order.side,
            "type": order.order_type,
            "qty": order.qty.to_string(),
            "time_in_force": order.time_in_force,
            "client_order_id": client_order_id,
        });

        if let Some(price) = order.limit_price {
            body["limit_price"] = serde_json::json!(price.to_string());
        }
        if let Some(price) = order.stop_price {
            body["stop_price"] = serde_json::json!(price.to_string());
        }

        let rt = tokio::runtime::Runtime::new().map_err(|e| BrokerError::Network(e.to_string()))?;
        rt.block_on(async {
            let result: serde_json::Value = self.post_json("/v2/orders", &body).await?;

            let status = result["status"].as_str().unwrap_or("new");
            if status == "new" || status == "accepted" || status == "pending_new" {
                return Ok(OrderResult {
                    id: result["id"].as_str().unwrap_or_default().to_string(),
                    client_order_id: result["client_order_id"]
                        .as_str()
                        .unwrap_or_default()
                        .to_string(),
                    status: "accepted".to_string(),
                    filled_qty: 0.0,
                    filled_at: None,
                });
            }

            Ok(OrderResult {
                id: result["id"].as_str().unwrap_or_default().to_string(),
                client_order_id: result["client_order_id"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                status: status.to_string(),
                filled_qty: result["filled_qty"]
                    .as_str()
                    .and_then(|s| s.parse().ok())
                    .or_else(|| result["filled_qty"].as_f64())
                    .unwrap_or(0.0),
                filled_at: result["filled_at"].as_str().map(|s| s.to_string()),
            })
        })
    }

    fn cancel_order(&self, order_id: &str) -> Result<bool, BrokerError> {
        let rt = tokio::runtime::Runtime::new().map_err(|e| BrokerError::Network(e.to_string()))?;
        rt.block_on(async { self.delete_json(&format!("/v2/orders/{}", order_id)).await })
    }

    fn get_position(&self, symbol: &str) -> Result<Option<Position>, BrokerError> {
        let rt = tokio::runtime::Runtime::new().map_err(|e| BrokerError::Network(e.to_string()))?;
        rt.block_on(async {
            match self
                .get_json::<serde_json::Value>(&format!("/v2/positions/{}", symbol))
                .await
            {
                Ok(val) => Ok(Some(Self::parse_position(&val))),
                Err(BrokerError::PositionNotFound(_)) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    fn get_positions(&self) -> Result<Vec<Position>, BrokerError> {
        let rt = tokio::runtime::Runtime::new().map_err(|e| BrokerError::Network(e.to_string()))?;
        rt.block_on(async {
            let vals: Vec<serde_json::Value> = self.get_json("/v2/positions").await?;
            Ok(vals.iter().map(Self::parse_position).collect())
        })
    }

    fn get_account(&self) -> Result<AccountInfo, BrokerError> {
        let rt = tokio::runtime::Runtime::new().map_err(|e| BrokerError::Network(e.to_string()))?;
        rt.block_on(async { self.get_account_internal().await })
    }

    fn get_equity(&self) -> Result<f64, BrokerError> {
        let account = self.get_account()?;
        Ok(account.equity)
    }

    fn get_cash(&self) -> Result<f64, BrokerError> {
        let account = self.get_account()?;
        Ok(account.cash)
    }

    fn get_buying_power(&self) -> Result<f64, BrokerError> {
        let account = self.get_account()?;
        Ok(account.buying_power)
    }

    fn is_live(&self) -> bool {
        self.is_live
    }

    fn name(&self) -> &str {
        if self.is_live {
            "Alpaca Live"
        } else {
            "Alpaca Paper"
        }
    }
}