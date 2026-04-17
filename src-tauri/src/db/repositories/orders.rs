use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get_all(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn
        .prepare("SELECT id, broker_order_id, client_order_id, symbol, side, qty, order_type, status, limit_price, stop_price, time_in_force, filled_qty, filled_at, broker, created_at, updated_at FROM orders ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "broker_order_id": row.get::<_, String>(1)?,
                "client_order_id": row.get::<_, Option<String>>(2)?,
                "symbol": row.get::<_, String>(3)?,
                "side": row.get::<_, String>(4)?,
                "qty": row.get::<_, f64>(5)?,
                "order_type": row.get::<_, String>(6)?,
                "status": row.get::<_, String>(7)?,
                "limit_price": row.get::<_, Option<f64>>(8)?,
                "stop_price": row.get::<_, Option<f64>>(9)?,
                "time_in_force": row.get::<_, String>(10)?,
                "filled_qty": row.get::<_, f64>(11)?,
                "filled_at": row.get::<_, Option<String>>(12)?,
                "broker": row.get::<_, String>(13)?,
                "created_at": row.get::<_, String>(14)?,
                "updated_at": row.get::<_, String>(15)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn insert(
    conn: &Connection,
    broker_order_id: &str,
    client_order_id: Option<&str>,
    symbol: &str,
    side: &str,
    qty: f64,
    order_type: &str,
    status: &str,
    limit_price: Option<f64>,
    stop_price: Option<f64>,
    time_in_force: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO orders (broker_order_id, client_order_id, symbol, side, qty, order_type, status, limit_price, stop_price, time_in_force) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![broker_order_id, client_order_id, symbol, side, qty, order_type, status, limit_price, stop_price, time_in_force],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

pub fn update_status(conn: &Connection, id: i64, status: &str, filled_qty: Option<f64>, filled_at: Option<&str>) -> Result<(), String> {
    conn.execute(
        "UPDATE orders SET status = ?1, filled_qty = COALESCE(?2, filled_qty), filled_at = COALESCE(?3, filled_at), updated_at = datetime('now') WHERE id = ?4",
        params![status, filled_qty, filled_at, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}