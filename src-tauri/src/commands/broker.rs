use crate::broker::{self, BrokerType, OrderRequest, BrokerRef};
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::State;

pub type ActiveBroker = Arc<RwLock<Option<BrokerRef>>>;
pub type KillSwitchState = Arc<RwLock<bool>>;

#[tauri::command]
pub async fn get_connection_status(broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    match guard.as_ref() {
        Some(b) => {
            let b_guard = b.read().await;
            Ok(serde_json::json!({
                "connected": true,
                "broker": b_guard.name(),
                "is_live": b_guard.is_live(),
            }))
        }
        None => Ok(serde_json::json!({
            "connected": false,
            "broker": null,
            "is_live": false,
        })),
    }
}

#[tauri::command]
pub async fn place_order(
    broker: State<'_, ActiveBroker>,
    kill_switch: State<'_, KillSwitchState>,
    symbol: String,
    side: String,
    qty: f64,
    order_type: String,
    time_in_force: String,
    limit_price: Option<f64>,
    stop_price: Option<f64>,
    client_order_id: Option<String>,
    asset_class: Option<String>,
) -> Result<serde_json::Value, String> {
    if *kill_switch.read().await {
        return Err("Kill switch is active — trading disabled".to_string());
    }
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let order = OrderRequest {
        symbol,
        side,
        qty,
        order_type,
        limit_price,
        stop_price,
        time_in_force,
        client_order_id,
        asset_class,
    };
    let result = b_guard.submit_order(order).map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(result).unwrap_or_default())
}

#[tauri::command]
pub async fn cancel_order(broker: State<'_, ActiveBroker>, order_id: String) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let result = b_guard.cancel_order(&order_id).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": result, "order_id": order_id }))
}

#[tauri::command]
pub async fn get_positions(broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let positions = b_guard.get_positions().map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(positions).unwrap_or_default())
}

#[tauri::command]
pub async fn get_orders(_broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!([]))
}

#[tauri::command]
pub async fn get_account(broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let account = b_guard.get_account().map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(account).unwrap_or_default())
}

#[tauri::command]
pub async fn get_equity(broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let equity = b_guard.get_equity().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "equity": equity }))
}

#[tauri::command]
pub async fn get_buying_power(broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let bp = b_guard.get_buying_power().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "buying_power": bp }))
}

#[tauri::command]
pub async fn start_trading(broker: State<'_, ActiveBroker>, broker_type: String) -> Result<serde_json::Value, String> {
    let bt = parse_broker_type(&broker_type)?;
    let b_ref = broker::create_broker(&bt).map_err(|e| e.to_string())?;
    *broker.write().await = Some(b_ref);
    Ok(serde_json::json!({ "status": "started", "broker": broker_type }))
}

#[tauri::command]
pub async fn stop_trading(broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    *broker.write().await = None;
    Ok(serde_json::json!({ "status": "stopped" }))
}

#[tauri::command]
pub async fn switch_broker(broker: State<'_, ActiveBroker>, broker_type: String) -> Result<serde_json::Value, String> {
    let bt = parse_broker_type(&broker_type)?;
    let b_ref = broker::create_broker(&bt).map_err(|e| e.to_string())?;
    *broker.write().await = Some(b_ref);
    Ok(serde_json::json!({ "status": "switched", "broker": broker_type }))
}

#[tauri::command]
pub async fn activate_kill_switch(kill_switch: State<'_, KillSwitchState>) -> Result<serde_json::Value, String> {
    *kill_switch.write().await = true;
    Ok(serde_json::json!({ "kill_switch": true }))
}

#[tauri::command]
pub async fn deactivate_kill_switch(kill_switch: State<'_, KillSwitchState>) -> Result<serde_json::Value, String> {
    *kill_switch.write().await = false;
    Ok(serde_json::json!({ "kill_switch": false }))
}

#[tauri::command]
pub async fn check_pdt_status(broker: State<'_, ActiveBroker>) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let name = b_guard.name();
    if !name.starts_with("Alpaca") {
        return Ok(serde_json::json!({
            "is_pattern_day_trader": false,
            "day_trade_count": 0,
            "day_trades_remaining": -1,
            "message": "PDT check not applicable for this broker"
        }));
    }
    let account = b_guard.get_account().map_err(|e| e.to_string())?;
    let is_pdt = account.pattern_day_trader;
    let remaining = if is_pdt { (3_i32).max(0) } else { -1 };
    Ok(serde_json::json!({
        "is_pattern_day_trader": is_pdt,
        "day_trade_count": 0,
        "day_trades_remaining": remaining,
        "trading_blocked": account.trading_blocked,
    }))
}

#[tauri::command]
pub async fn tv_process_signal(
    broker: State<'_, ActiveBroker>,
    _hypothesis_id: String,
    _symbol: String,
    _action: String,
    _price: f64,
    _qty: Option<f64>,
) -> Result<serde_json::Value, String> {
    let guard = broker.read().await;
    let b_ref = guard.as_ref().ok_or("No broker connected")?;
    let b_guard = b_ref.read().await;
    let name = b_guard.name().to_string();
    drop(b_guard);
    drop(guard);
    if !name.starts_with("TV") {
        return Err("Not a TVPaperBroker".to_string());
    }
    Err("Use broker directly for TV signal processing".to_string())
}

fn parse_broker_type(s: &str) -> Result<BrokerType, String> {
    match s.to_lowercase().as_str() {
        "alpacapaper" | "alpaca_paper" => Ok(BrokerType::AlpacaPaper),
        "alpacalive" | "alpaca_live" => Ok(BrokerType::AlpacaLive),
        "paper" => Ok(BrokerType::Paper),
        "tradingview" | "tv" => Ok(BrokerType::TradingView),
        "ibkr" => Ok(BrokerType::IBKR),
        "schwab" => Ok(BrokerType::Schwab),
        "tastytrade" => Ok(BrokerType::TastyTrade),
        "tradestation" => Ok(BrokerType::TradeStation),
        "etrade" => Ok(BrokerType::ETrade),
        _ => Err(format!("Unknown broker type: {}", s)),
    }
}