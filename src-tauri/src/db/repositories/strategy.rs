use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get(conn: &Connection, name: &str) -> Result<Option<Value>, String> {
    let result = conn.query_row(
        "SELECT id, name, active, pnl, positions, last_signal, config_json, updated_at FROM strategy_state WHERE name = ?1",
        params![name],
        |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "active": row.get::<_, i64>(2)? != 0,
                "pnl": row.get::<_, f64>(3)?,
                "positions": row.get::<_, Option<String>>(4)?,
                "last_signal": row.get::<_, Option<String>>(5)?,
                "config_json": row.get::<_, Option<String>>(6)?,
                "updated_at": row.get::<_, String>(7)?,
            }))
        },
    );
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn upsert(
    conn: &Connection,
    name: &str,
    active: bool,
    pnl: f64,
    positions: Option<&str>,
    last_signal: Option<&str>,
    config_json: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO strategy_state (name, active, pnl, positions, last_signal, config_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(name) DO UPDATE SET active=?2, pnl=?3, positions=?4, last_signal=?5, config_json=?6, updated_at=datetime('now')",
        params![name, active as i64, pnl, positions, last_signal, config_json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, active, pnl, positions, last_signal, config_json, updated_at FROM strategy_state ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "active": row.get::<_, i64>(2)? != 0,
                "pnl": row.get::<_, f64>(3)?,
                "positions": row.get::<_, Option<String>>(4)?,
                "last_signal": row.get::<_, Option<String>>(5)?,
                "config_json": row.get::<_, Option<String>>(6)?,
                "updated_at": row.get::<_, String>(7)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}