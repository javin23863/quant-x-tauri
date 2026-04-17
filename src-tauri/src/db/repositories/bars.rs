use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn get_bars(conn: &Connection, symbol: &str, timeframe: Option<&str>, limit: u32) -> Result<Vec<Value>, String> {
    let query = if timeframe.is_some() {
        "SELECT id, symbol, timestamp, open, high, low, close, volume, trade_count, vwap, timeframe FROM bars WHERE symbol = ?1 AND timeframe = ?2 ORDER BY timestamp DESC LIMIT ?3"
    } else {
        "SELECT id, symbol, timestamp, open, high, low, close, volume, trade_count, vwap, timeframe FROM bars WHERE symbol = ?1 ORDER BY timestamp DESC LIMIT ?2"
    };
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let rows: Vec<Value> = if let Some(tf) = timeframe {
        stmt.query_map(params![symbol, tf, limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "symbol": row.get::<_, String>(1)?,
                "timestamp": row.get::<_, String>(2)?,
                "open": row.get::<_, f64>(3)?,
                "high": row.get::<_, f64>(4)?,
                "low": row.get::<_, f64>(5)?,
                "close": row.get::<_, f64>(6)?,
                "volume": row.get::<_, f64>(7)?,
                "trade_count": row.get::<_, i64>(8)?,
                "vwap": row.get::<_, Option<f64>>(9)?,
                "timeframe": row.get::<_, String>(10)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map(params![symbol, limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "symbol": row.get::<_, String>(1)?,
                "timestamp": row.get::<_, String>(2)?,
                "open": row.get::<_, f64>(3)?,
                "high": row.get::<_, f64>(4)?,
                "low": row.get::<_, f64>(5)?,
                "close": row.get::<_, f64>(6)?,
                "volume": row.get::<_, f64>(7)?,
                "trade_count": row.get::<_, i64>(8)?,
                "vwap": row.get::<_, Option<f64>>(9)?,
                "timeframe": row.get::<_, String>(10)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    };
    Ok(rows)
}

pub fn save_bars(conn: &Connection, bars: &[Value]) -> Result<(), String> {
    for bar in bars {
        conn.execute(
            "INSERT OR REPLACE INTO bars (symbol, timestamp, open, high, low, close, volume, trade_count, vwap, timeframe) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                bar["symbol"].as_str().unwrap_or(""),
                bar["timestamp"].as_str().unwrap_or(""),
                bar["open"].as_f64().unwrap_or(0.0),
                bar["high"].as_f64().unwrap_or(0.0),
                bar["low"].as_f64().unwrap_or(0.0),
                bar["close"].as_f64().unwrap_or(0.0),
                bar["volume"].as_f64().unwrap_or(0.0),
                bar["trade_count"].as_i64().unwrap_or(0),
                bar["vwap"].as_f64(),
                bar["timeframe"].as_str().unwrap_or("1Min"),
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}