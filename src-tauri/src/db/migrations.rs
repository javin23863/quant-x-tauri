use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    migration_001_create_tables(conn)?;
    Ok(())
}

fn migration_001_create_tables(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            qty REAL NOT NULL,
            side TEXT NOT NULL,
            market_value REAL NOT NULL DEFAULT 0,
            cost_basis REAL NOT NULL DEFAULT 0,
            unrealized_pl REAL NOT NULL DEFAULT 0,
            unrealized_plpc REAL NOT NULL DEFAULT 0,
            current_price REAL NOT NULL DEFAULT 0,
            avg_entry_price REAL NOT NULL DEFAULT 0,
            asset_class TEXT,
            broker TEXT NOT NULL DEFAULT 'paper',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            broker_order_id TEXT NOT NULL,
            client_order_id TEXT,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            qty REAL NOT NULL,
            order_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new',
            limit_price REAL,
            stop_price REAL,
            time_in_force TEXT NOT NULL DEFAULT 'day',
            filled_qty REAL NOT NULL DEFAULT 0,
            filled_at TEXT,
            broker TEXT NOT NULL DEFAULT 'paper',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS trade_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            qty REAL NOT NULL,
            entry_price REAL NOT NULL,
            exit_price REAL NOT NULL,
            pnl REAL NOT NULL,
            pnl_pct REAL NOT NULL,
            commission REAL NOT NULL DEFAULT 0,
            broker TEXT NOT NULL DEFAULT 'paper',
            opened_at TEXT,
            closed_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume REAL NOT NULL DEFAULT 0,
            trade_count INTEGER NOT NULL DEFAULT 0,
            vwap REAL,
            timeframe TEXT NOT NULL DEFAULT '1Min'
        );

        CREATE TABLE IF NOT EXISTS strategy_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            active INTEGER NOT NULL DEFAULT 0,
            pnl REAL NOT NULL DEFAULT 0,
            positions TEXT,
            last_signal TEXT,
            config_json TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS prop_firm_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            preset_name TEXT NOT NULL,
            phase TEXT NOT NULL DEFAULT 'phase1',
            equity_start REAL NOT NULL DEFAULT 0,
            equity_high REAL NOT NULL DEFAULT 0,
            drawdown_current REAL NOT NULL DEFAULT 0,
            daily_pnl REAL NOT NULL DEFAULT 0,
            drawdown_mode TEXT NOT NULL DEFAULT 'closed',
            rules_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS kill_switch (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            active INTEGER NOT NULL DEFAULT 0,
            reason TEXT,
            activated_at TEXT,
            deactivated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            dismissed INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
        CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_trade_history_symbol ON trade_history(symbol);
        CREATE INDEX IF NOT EXISTS idx_bars_symbol_timestamp ON bars(symbol, timestamp);
        CREATE INDEX IF NOT EXISTS idx_strategy_state_name ON strategy_state(name);
        CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);
        CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp);
        "
    )?;
    Ok(())
}