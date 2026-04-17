use crate::data::DataProvider;
use crate::data::alpaca_data::AlpacaDataProvider;

#[tauri::command]
pub async fn subscribe_bars(symbols: Vec<String>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "status": "subscribed", "symbols": symbols }))
}

#[tauri::command]
pub async fn unsubscribe_bars(symbols: Vec<String>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "status": "unsubscribed", "symbols": symbols }))
}

#[tauri::command]
pub async fn get_historical_bars(symbol: String, timeframe: String, start: String, end: String) -> Result<serde_json::Value, String> {
    let provider = AlpacaDataProvider::new(String::new(), String::new(), true);
    let bars: Vec<crate::broker::BarData> = provider.get_historical_bars(&symbol, &timeframe, &start, &end)
        .map_err(|e: crate::broker::BrokerError| e.to_string())?;
    Ok(serde_json::to_value(bars).unwrap_or_default())
}

#[tauri::command]
pub async fn get_market_status() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "open": false, "next_open": null, "next_close": null }))
}