use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get_history(conn: &Connection, symbol: Option<&str>, limit: u32) -> Result<Vec<Value>, String> {
    let query = if symbol.is_some() {
        "SELECT id, symbol, side, qty, entry_price, exit_price, pnl, pnl_pct, commission, broker, opened_at, closed_at FROM trade_history WHERE symbol = ?1 ORDER BY closed_at DESC LIMIT ?2"
    } else {
        "SELECT id, symbol, side, qty, entry_price, exit_price, pnl, pnl_pct, commission, broker, opened_at, closed_at FROM trade_history ORDER BY closed_at DESC LIMIT ?1"
    };
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let rows: Vec<Value> = if let Some(sym) = symbol {
        stmt.query_map(params![sym, limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "symbol": row.get::<_, String>(1)?,
                "side": row.get::<_, String>(2)?,
                "qty": row.get::<_, f64>(3)?,
                "entry_price": row.get::<_, f64>(4)?,
                "exit_price": row.get::<_, f64>(5)?,
                "pnl": row.get::<_, f64>(6)?,
                "pnl_pct": row.get::<_, f64>(7)?,
                "commission": row.get::<_, f64>(8)?,
                "broker": row.get::<_, String>(9)?,
                "opened_at": row.get::<_, Option<String>>(10)?,
                "closed_at": row.get::<_, String>(11)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map(params![limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "symbol": row.get::<_, String>(1)?,
                "side": row.get::<_, String>(2)?,
                "qty": row.get::<_, f64>(3)?,
                "entry_price": row.get::<_, f64>(4)?,
                "exit_price": row.get::<_, f64>(5)?,
                "pnl": row.get::<_, f64>(6)?,
                "pnl_pct": row.get::<_, f64>(7)?,
                "commission": row.get::<_, f64>(8)?,
                "broker": row.get::<_, String>(9)?,
                "opened_at": row.get::<_, Option<String>>(10)?,
                "closed_at": row.get::<_, String>(11)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    };
    Ok(rows)
}

pub fn insert(
    conn: &Connection,
    symbol: &str,
    side: &str,
    qty: f64,
    entry_price: f64,
    exit_price: f64,
    pnl: f64,
    pnl_pct: f64,
    commission: f64,
    opened_at: Option<&str>,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO trade_history (symbol, side, qty, entry_price, exit_price, pnl, pnl_pct, commission, opened_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![symbol, side, qty, entry_price, exit_price, pnl, pnl_pct, commission, opened_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}