use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get(conn: &Connection, preset_name: &str) -> Result<Option<Value>, String> {
    let result = conn.query_row(
        "SELECT id, preset_name, phase, equity_start, equity_high, drawdown_current, daily_pnl, drawdown_mode, rules_json, created_at, updated_at FROM prop_firm_state WHERE preset_name = ?1",
        params![preset_name],
        |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "preset_name": row.get::<_, String>(1)?,
                "phase": row.get::<_, String>(2)?,
                "equity_start": row.get::<_, f64>(3)?,
                "equity_high": row.get::<_, f64>(4)?,
                "drawdown_current": row.get::<_, f64>(5)?,
                "daily_pnl": row.get::<_, f64>(6)?,
                "drawdown_mode": row.get::<_, String>(7)?,
                "rules_json": row.get::<_, Option<String>>(8)?,
                "created_at": row.get::<_, String>(9)?,
                "updated_at": row.get::<_, String>(10)?,
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
    preset_name: &str,
    phase: &str,
    equity_start: f64,
    equity_high: f64,
    drawdown_current: f64,
    daily_pnl: f64,
    drawdown_mode: &str,
    rules_json: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO prop_firm_state (preset_name, phase, equity_start, equity_high, drawdown_current, daily_pnl, drawdown_mode, rules_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
         ON CONFLICT(preset_name) DO UPDATE SET phase=?2, equity_start=?3, equity_high=?4, drawdown_current=?5, daily_pnl=?6, drawdown_mode=?7, rules_json=?8, updated_at=datetime('now')",
        params![preset_name, phase, equity_start, equity_high, drawdown_current, daily_pnl, drawdown_mode, rules_json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn
        .prepare("SELECT id, preset_name, phase, equity_start, equity_high, drawdown_current, daily_pnl, drawdown_mode, rules_json, created_at, updated_at FROM prop_firm_state ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "preset_name": row.get::<_, String>(1)?,
                "phase": row.get::<_, String>(2)?,
                "equity_start": row.get::<_, f64>(3)?,
                "equity_high": row.get::<_, f64>(4)?,
                "drawdown_current": row.get::<_, f64>(5)?,
                "daily_pnl": row.get::<_, f64>(6)?,
                "drawdown_mode": row.get::<_, String>(7)?,
                "rules_json": row.get::<_, Option<String>>(8)?,
                "created_at": row.get::<_, String>(9)?,
                "updated_at": row.get::<_, String>(10)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}