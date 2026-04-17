use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get_all(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn
        .prepare("SELECT id, symbol, qty, side, market_value, cost_basis, unrealized_pl, unrealized_plpc, current_price, avg_entry_price, asset_class, broker, updated_at FROM positions ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "symbol": row.get::<_, String>(1)?,
                "qty": row.get::<_, f64>(2)?,
                "side": row.get::<_, String>(3)?,
                "market_value": row.get::<_, f64>(4)?,
                "cost_basis": row.get::<_, f64>(5)?,
                "unrealized_pl": row.get::<_, f64>(6)?,
                "unrealized_plpc": row.get::<_, f64>(7)?,
                "current_price": row.get::<_, f64>(8)?,
                "avg_entry_price": row.get::<_, f64>(9)?,
                "asset_class": row.get::<_, Option<String>>(10)?,
                "broker": row.get::<_, String>(11)?,
                "updated_at": row.get::<_, String>(12)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn upsert(
    conn: &Connection,
    symbol: &str,
    qty: f64,
    side: &str,
    market_value: f64,
    cost_basis: f64,
    unrealized_pl: f64,
    unrealized_plpc: f64,
    current_price: f64,
    avg_entry_price: f64,
    asset_class: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO positions (symbol, qty, side, market_value, cost_basis, unrealized_pl, unrealized_plpc, current_price, avg_entry_price, asset_class, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
         ON CONFLICT(symbol) DO UPDATE SET qty=?2, side=?3, market_value=?4, cost_basis=?5, unrealized_pl=?6, unrealized_plpc=?7, current_price=?8, avg_entry_price=?9, asset_class=?10, updated_at=datetime('now')",
        params![symbol, qty, side, market_value, cost_basis, unrealized_pl, unrealized_plpc, current_price, avg_entry_price, asset_class],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn clear_all(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM positions", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}