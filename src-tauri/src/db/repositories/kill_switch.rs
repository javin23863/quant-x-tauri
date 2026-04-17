use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get_state(conn: &Connection) -> Result<Value, String> {
    let result = conn.query_row(
        "SELECT active, reason, activated_at, deactivated_at FROM kill_switch WHERE id = 1",
        [],
        |row| {
            Ok(json!({
                "active": row.get::<_, i64>(0)? != 0,
                "reason": row.get::<_, Option<String>>(1)?,
                "activated_at": row.get::<_, Option<String>>(2)?,
                "deactivated_at": row.get::<_, Option<String>>(3)?,
            }))
        },
    );
    match result {
        Ok(val) => Ok(val),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(json!({"active": false, "reason": null, "activated_at": null, "deactivated_at": null})),
        Err(e) => Err(e.to_string()),
    }
}

pub fn activate(conn: &Connection, reason: Option<&str>) -> Result<(), String> {
    let exist_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM kill_switch WHERE id = 1", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if exist_count == 0 {
        conn.execute(
            "INSERT INTO kill_switch (id, active, reason, activated_at) VALUES (1, 1, ?1, datetime('now'))",
            params![reason],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE kill_switch SET active = 1, reason = ?1, activated_at = datetime('now'), deactivated_at = NULL WHERE id = 1",
            params![reason],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn deactivate(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "UPDATE kill_switch SET active = 0, deactivated_at = datetime('now') WHERE id = 1",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}