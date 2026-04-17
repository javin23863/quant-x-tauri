use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get_all(conn: &Connection, dismissed_only: Option<bool>) -> Result<Vec<Value>, String> {
    let query = match dismissed_only {
        Some(true) => "SELECT id, type, title, message, timestamp, dismissed FROM notifications WHERE dismissed = 1 ORDER BY timestamp DESC",
        Some(false) => "SELECT id, type, title, message, timestamp, dismissed FROM notifications WHERE dismissed = 0 ORDER BY timestamp DESC",
        None => "SELECT id, type, title, message, timestamp, dismissed FROM notifications ORDER BY timestamp DESC",
    };
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "type": row.get::<_, String>(1)?,
                "title": row.get::<_, String>(2)?,
                "message": row.get::<_, String>(3)?,
                "timestamp": row.get::<_, String>(4)?,
                "dismissed": row.get::<_, i64>(5)? != 0,
            }))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn insert(conn: &Connection, n_type: &str, title: &str, message: &str) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO notifications (type, title, message) VALUES (?1, ?2, ?3)",
        params![n_type, title, message],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

pub fn dismiss(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE notifications SET dismissed = 1 WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn dismiss_all(conn: &Connection) -> Result<(), String> {
    conn.execute("UPDATE notifications SET dismissed = 1 WHERE dismissed = 0", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}