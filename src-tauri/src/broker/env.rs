pub fn load_alpaca_keys() -> Result<(String, String, String), String> {
    let api_key = std::env::var("ALPACA_API_KEY").map_err(|_| "ALPACA_API_KEY not set".to_string())?;
    let secret_key = std::env::var("ALPACA_SECRET_KEY").map_err(|_| "ALPACA_SECRET_KEY not set".to_string())?;
    let base_url = std::env::var("ALPACA_BASE_URL")
        .unwrap_or_else(|_| "https://paper-api.alpaca.markets".to_string());
    Ok((api_key, secret_key, base_url))
}

pub fn load_alpaca_live_keys() -> Result<(String, String), String> {
    let api_key = std::env::var("ALPACA_LIVE_API_KEY").map_err(|_| "ALPACA_LIVE_API_KEY not set".to_string())?;
    let secret_key = std::env::var("ALPACA_LIVE_API_SECRET").map_err(|_| "ALPACA_LIVE_API_SECRET not set".to_string())?;
    Ok((api_key, secret_key))
}

pub fn load_ibkr_config() -> (String, u16, u32, bool) {
    let host = std::env::var("IBKR_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = std::env::var("IBKR_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(7497);
    let client_id: u32 = std::env::var("IBKR_CLIENT_ID").ok().and_then(|c| c.parse().ok()).unwrap_or(1);
    let paper = std::env::var("IBKR_PAPER").ok().and_then(|p| p.parse().ok()).unwrap_or(true);
    (host, port, client_id, paper)
}

pub fn load_schwab_config() -> (String, String, String) {
    let api_key = std::env::var("SCHWAB_API_KEY").unwrap_or_default();
    let secret = std::env::var("SCHWAB_API_SECRET").unwrap_or_default();
    let redirect = std::env::var("SCHWAB_REDIRECT_URI").unwrap_or_else(|_| "https://localhost:8182/callback".to_string());
    (api_key, secret, redirect)
}

pub fn load_tastytrade_config() -> (String, String) {
    let api_key = std::env::var("TASTYTRADE_API_KEY").unwrap_or_default();
    let secret = std::env::var("TASTYTRADE_API_SECRET").unwrap_or_default();
    (api_key, secret)
}

pub fn load_tradestation_config() -> (String, String, String) {
    let api_key = std::env::var("TRADESTATION_API_KEY").unwrap_or_default();
    let secret = std::env::var("TRADESTATION_API_SECRET").unwrap_or_default();
    let env = std::env::var("TRADESTATION_ENV").unwrap_or_else(|_| "simulation".to_string());
    (api_key, secret, env)
}

pub fn load_etrade_config() -> (String, String, String) {
    let api_key = std::env::var("ETRADE_API_KEY").unwrap_or_default();
    let secret = std::env::var("ETRADE_API_SECRET").unwrap_or_default();
    let env = std::env::var("ETRADE_ENV").unwrap_or_else(|_| "sandbox".to_string());
    (api_key, secret, env)
}