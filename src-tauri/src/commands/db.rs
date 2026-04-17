use crate::db::{self, DbState};
use serde_json::Value;
use tauri::State;

fn get_conn<'a>(state: &'a State<'a, DbState>) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    state.0.lock().map_err(|e| format!("DB lock error: {}", e))
}

#[tauri::command]
pub fn get_positions_db(state: State<DbState>) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    let rows = db::repositories::positions::get_all(&conn)?;
    Ok(Value::Array(rows))
}

#[tauri::command]
pub fn save_position(
    state: State<DbState>,
    symbol: String,
    qty: f64,
    side: String,
    market_value: f64,
    cost_basis: f64,
    unrealized_pl: f64,
    unrealized_plpc: f64,
    current_price: f64,
    avg_entry_price: f64,
    asset_class: Option<String>,
) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::positions::upsert(
        &conn,
        &symbol,
        qty,
        &side,
        market_value,
        cost_basis,
        unrealized_pl,
        unrealized_plpc,
        current_price,
        avg_entry_price,
        asset_class.as_deref(),
    )?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn clear_positions(state: State<DbState>) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::positions::clear_all(&conn)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn save_order(
    state: State<DbState>,
    broker_order_id: String,
    client_order_id: Option<String>,
    symbol: String,
    side: String,
    qty: f64,
    order_type: String,
    status: String,
    limit_price: Option<f64>,
    stop_price: Option<f64>,
    time_in_force: String,
) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    let id = db::repositories::orders::insert(
        &conn,
        &broker_order_id,
        client_order_id.as_deref(),
        &symbol,
        &side,
        qty,
        &order_type,
        &status,
        limit_price,
        stop_price,
        &time_in_force,
    )?;
    Ok(serde_json::json!({ "success": true, "id": id }))
}

#[tauri::command]
pub fn get_orders_db(state: State<DbState>) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    let rows = db::repositories::orders::get_all(&conn)?;
    Ok(Value::Array(rows))
}

#[tauri::command]
pub fn update_order_status(
    state: State<DbState>,
    id: i64,
    status: String,
    filled_qty: Option<f64>,
    filled_at: Option<String>,
) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::orders::update_status(
        &conn,
        id,
        &status,
        filled_qty,
        filled_at.as_deref(),
    )?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn get_trade_history(
    state: State<DbState>,
    symbol: Option<String>,
    limit: Option<u32>,
) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    let rows = db::repositories::trades::get_history(&conn, symbol.as_deref(), limit.unwrap_or(100))?;
    Ok(Value::Array(rows))
}

#[tauri::command]
pub fn save_trade(
    state: State<DbState>,
    symbol: String,
    side: String,
    qty: f64,
    entry_price: f64,
    exit_price: f64,
    pnl: f64,
    pnl_pct: f64,
    commission: Option<f64>,
    opened_at: Option<String>,
) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    let id = db::repositories::trades::insert(
        &conn,
        &symbol,
        &side,
        qty,
        entry_price,
        exit_price,
        pnl,
        pnl_pct,
        commission.unwrap_or(0.0),
        opened_at.as_deref(),
    )?;
    Ok(serde_json::json!({ "success": true, "id": id }))
}

#[tauri::command]
pub fn get_bars(
    state: State<DbState>,
    symbol: String,
    timeframe: Option<String>,
    limit: Option<u32>,
) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    let rows = db::repositories::bars::get_bars(&conn, &symbol, timeframe.as_deref(), limit.unwrap_or(500))?;
    Ok(Value::Array(rows))
}

#[tauri::command]
pub fn save_bars(state: State<DbState>, bars: Vec<Value>) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::bars::save_bars(&conn, &bars)?;
    Ok(serde_json::json!({ "success": true, "count": bars.len() }))
}

#[tauri::command]
pub fn save_config(state: State<DbState>, key: String, value: String) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::config_repo::save(&conn, &key, &value)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn load_config(state: State<DbState>, key: String) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    let result = db::repositories::config_repo::load(&conn, &key)?;
    Ok(serde_json::json!({ "key": key, "value": result }))
}

#[tauri::command]
pub fn get_kill_switch_state(state: State<DbState>) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::kill_switch::get_state(&conn)
}

#[tauri::command]
pub fn activate_kill_switch_db(state: State<DbState>, reason: Option<String>) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::kill_switch::activate(&conn, reason.as_deref())?;
    Ok(serde_json::json!({ "success": true, "active": true }))
}

#[tauri::command]
pub fn deactivate_kill_switch_db(state: State<DbState>) -> Result<Value, String> {
    let conn = get_conn(&state)?;
    db::repositories::kill_switch::deactivate(&conn)?;
    Ok(serde_json::json!({ "success": true, "active": false }))
}