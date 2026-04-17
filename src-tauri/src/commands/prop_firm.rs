use crate::prop_firm::{PropFirmConfig, PropFirmEngine, PropFirmPhase, PropFirmRuleProvider, PropFirmPreset, PhaseConfig};
use crate::prop_firm::presets::{ftmo::FtmoPreset, topstep::TopstepPreset, lucid::LucidPreset, apex::ApexPreset};
use crate::prop_firm::trailing_drawdown::{TrailingDrawdown, DrawdownMode};
use crate::prop_firm::phase_controller::PhaseController;
use crate::prop_firm::risk_adapter::{PropRiskAdapter, OrderCheck, PortfolioState};
use crate::prop_firm::safety_adapter::{PropSafetyAdapter, SafetySnapshot};
use crate::broker::BrokerType;
use std::sync::Arc;
use tokio::sync::RwLock;

pub type PropFirmRef = Arc<RwLock<Option<PropFirmEngine>>>;

fn get_preset(name: &str) -> Option<PropFirmConfig> {
    match name {
        "ftmo" => Some(FtmoPreset.config()),
        "topstep" => Some(TopstepPreset.config()),
        "lucid" => Some(LucidPreset.config()),
        "apex" => Some(ApexPreset.config()),
        _ => None,
    }
}

fn get_preset_full(name: &str) -> Option<PropFirmPreset> {
    match name {
        "ftmo" => Some(FtmoPreset.preset()),
        "topstep" => Some(TopstepPreset.preset()),
        "lucid" => Some(LucidPreset.preset()),
        "apex" => Some(ApexPreset.preset()),
        _ => None,
    }
}

#[tauri::command]
pub async fn get_prop_firm_presets() -> Result<serde_json::Value, String> {
    let presets = crate::prop_firm::presets::get_all_presets();
    Ok(serde_json::to_value(presets).unwrap_or_default())
}

#[tauri::command]
pub async fn load_prop_firm_preset(preset_name: String, starting_equity: f64) -> Result<serde_json::Value, String> {
    let preset = get_preset_full(&preset_name).ok_or("Unknown preset")?;
    let config = match preset_name.as_str() {
        "ftmo" => FtmoPreset.config(),
        "topstep" => TopstepPreset.config(),
        "lucid" => LucidPreset.config(),
        "apex" => ApexPreset.config(),
        _ => return Err("Unknown preset".to_string()),
    };
    let engine = PropFirmEngine::new(config, starting_equity);
    Ok(serde_json::json!({
        "config": engine.config,
        "phase": engine.phase,
        "starting_equity": engine.starting_equity,
        "preset": preset,
    }))
}

#[tauri::command]
pub async fn fetch_rules_from_url(url: String) -> Result<serde_json::Value, String> {
    let config = crate::prop_firm::rule_fetcher::fetch_rules_from_url(&url).await?;
    Ok(serde_json::to_value(config).unwrap_or_default())
}

#[tauri::command]
pub async fn check_drawdown(preset_name: String, starting_equity: f64, current_equity: f64, high_water_mark: f64) -> Result<serde_json::Value, String> {
    let config = get_preset(&preset_name).ok_or("Unknown preset")?;
    let engine = PropFirmEngine::new(config, starting_equity);
    let mut dd = TrailingDrawdown::new(engine.config.trailing_drawdown * starting_equity, starting_equity);
    dd.equity_high = high_water_mark;
    dd.trailing_limit = high_water_mark - dd.max_drawdown;
    let status = dd.update(current_equity);
    Ok(serde_json::to_value(status).unwrap_or_default())
}

#[tauri::command]
pub async fn check_flatten_required(preset_name: String, starting_equity: f64, current_equity: f64, start_of_day_equity: f64, high_water_mark: f64) -> Result<serde_json::Value, String> {
    let config = get_preset(&preset_name).ok_or("Unknown preset")?;
    let mut engine = PropFirmEngine::new(config, starting_equity);
    engine.high_water_mark = high_water_mark;
    let should_flatten = engine.should_flatten(current_equity, start_of_day_equity);
    Ok(serde_json::json!({ "flatten_required": should_flatten }))
}

#[tauri::command]
pub async fn check_consistency(preset_name: String, trades: Vec<(f64, f64)>) -> Result<serde_json::Value, String> {
    let config = get_preset(&preset_name).ok_or("Unknown preset")?;
    let total_pnl: f64 = trades.iter().map(|(pnl, _)| *pnl).sum();
    let max_trade = trades.iter().map(|(pnl, _)| pnl.abs()).fold(0.0_f64, f64::max);
    let is_consistent = if total_pnl.abs() > 0.0 {
        max_trade / total_pnl.abs() <= config.consistency_pct
    } else {
        false
    };
    Ok(serde_json::json!({
        "is_consistent": is_consistent,
        "max_trade_pct": if total_pnl.abs() > 0.0 { max_trade / total_pnl.abs() } else { 0.0 }
    }))
}

#[tauri::command]
pub async fn advance_phase(preset_name: String, current_phase: String, starting_equity: f64) -> Result<serde_json::Value, String> {
    let config = get_preset(&preset_name).ok_or("Unknown preset")?;
    let mut engine = PropFirmEngine::new(config, starting_equity);
    engine.phase = match current_phase.as_str() {
        "Phase1" => PropFirmPhase::Phase1,
        "Phase2" => PropFirmPhase::Phase2,
        "Funded" => PropFirmPhase::Funded,
        _ => PropFirmPhase::Phase1,
    };
    let new_phase = engine.advance_phase();
    Ok(serde_json::json!({ "new_phase": new_phase }))
}

#[tauri::command]
pub async fn get_phase_progress(preset_name: String, current_phase: String, starting_equity: f64, current_equity: f64, trading_days: u32) -> Result<serde_json::Value, String> {
    let config = get_preset(&preset_name).ok_or("Unknown preset")?;
    let mut engine = PropFirmEngine::new(config, starting_equity);
    engine.phase = match current_phase.as_str() {
        "Phase1" => PropFirmPhase::Phase1,
        "Phase2" => PropFirmPhase::Phase2,
        "Funded" => PropFirmPhase::Funded,
        _ => PropFirmPhase::Phase1,
    };
    engine.trading_days = trading_days;
    let target = match engine.phase {
        PropFirmPhase::Phase1 => engine.starting_equity * (1.0 + engine.config.profit_target_p1),
        PropFirmPhase::Phase2 => engine.starting_equity * (1.0 + engine.config.profit_target_p2),
        PropFirmPhase::Funded => engine.starting_equity,
    };
    let progress = if target > engine.starting_equity {
        ((current_equity - engine.starting_equity) / (target - engine.starting_equity) * 100.0).clamp(0.0, 100.0)
    } else {
        100.0
    };
    let days_remaining = engine.config.min_trading_days.saturating_sub(engine.trading_days);
    Ok(serde_json::json!({
        "current_phase": engine.phase,
        "profit_target": target,
        "current_equity": current_equity,
        "progress_pct": progress,
        "trading_days_elapsed": engine.trading_days,
        "min_trading_days": engine.config.min_trading_days,
        "days_remaining": days_remaining,
    }))
}

#[tauri::command]
pub async fn create_trailing_drawdown(
    max_drawdown: f64,
    starting_equity: f64,
    mode: Option<String>,
    soft_stop_percent: Option<f64>,
    timezone: Option<String>,
) -> Result<serde_json::Value, String> {
    let drawdown_mode = match mode.as_deref() {
        Some("eod") => DrawdownMode::Eod,
        Some("balance") => DrawdownMode::Balance,
        _ => DrawdownMode::Continuous,
    };

    let mut dd = TrailingDrawdown::new(max_drawdown, starting_equity).with_mode(drawdown_mode);
    if let Some(ssp) = soft_stop_percent {
        dd.soft_stop_percent = ssp;
    }
    if let Some(tz) = &timezone {
        dd.timezone = tz.clone();
    }

    Ok(serde_json::json!({
        "max_drawdown": dd.max_drawdown,
        "starting_equity": dd.starting_equity,
        "mode": format!("{:?}", dd.mode).to_lowercase(),
        "soft_stop_percent": dd.soft_stop_percent,
        "timezone": dd.timezone,
    }))
}

#[tauri::command]
pub async fn update_trailing_drawdown(
    max_drawdown: f64,
    starting_equity: f64,
    current_equity: f64,
    mode: Option<String>,
    soft_stop_percent: Option<f64>,
) -> Result<serde_json::Value, String> {
    let drawdown_mode = match mode.as_deref() {
        Some("eod") => DrawdownMode::Eod,
        Some("balance") => DrawdownMode::Balance,
        _ => DrawdownMode::Continuous,
    };

    let mut dd = TrailingDrawdown::new(max_drawdown, starting_equity).with_mode(drawdown_mode);
    if let Some(ssp) = soft_stop_percent {
        dd.soft_stop_percent = ssp;
    }

    let status = dd.update(current_equity);
    Ok(serde_json::to_value(status).unwrap_or_default())
}

#[tauri::command]
pub async fn create_phase_controller(
    preset_name: String,
    starting_equity: f64,
) -> Result<serde_json::Value, String> {
    let preset = get_preset_full(&preset_name).ok_or("Unknown preset")?;
    let phases: Vec<PhaseConfig> = preset.phases.clone();
    let pc = PhaseController::new(phases, preset.rules.profit_target, preset.rules.max_loss_limit, starting_equity);
    Ok(serde_json::json!({
        "status": pc.get_status(),
    }))
}

#[tauri::command]
pub async fn check_risk_adapter(
    preset_name: String,
    starting_equity: f64,
    equity: f64,
    total_value: f64,
    order_symbol: String,
    order_qty: f64,
    _high_water_mark: f64,
) -> Result<serde_json::Value, String> {
    let config = get_preset(&preset_name).ok_or("Unknown preset")?;
    let engine = PropFirmEngine::new(config, starting_equity);

    let dd = TrailingDrawdown::new(engine.config.trailing_drawdown * starting_equity, starting_equity);

    let mut adapter = PropRiskAdapter::new(engine).with_trailing_drawdown(dd);

    let order = OrderCheck {
        order_symbol,
        order_side: "buy".to_string(),
        order_qty,
        order_price: None,
    };
    let portfolio = PortfolioState {
        equity,
        total_value,
        positions: vec![],
    };

    let result = adapter.check_order(&order, &portfolio, &serde_json::json!({}));
    Ok(serde_json::to_value(result).unwrap_or_default())
}

#[tauri::command]
pub async fn check_safety_adapter(
    preset_name: String,
    starting_equity: f64,
    equity: f64,
) -> Result<serde_json::Value, String> {
    let config = get_preset(&preset_name).ok_or("Unknown preset")?;
    let engine = PropFirmEngine::new(config, starting_equity);

    let mut adapter = PropSafetyAdapter::new(engine);
    adapter.update_equity(equity);

    let snapshot = SafetySnapshot { equity, total_value: equity };
    let result = adapter.check_order(&snapshot);
    Ok(serde_json::to_value(result).unwrap_or_default())
}

#[tauri::command]
pub async fn get_broker_restrictions(broker: String) -> Result<serde_json::Value, String> {
    let broker_type = match broker.as_str() {
        "AlpacaPaper" => BrokerType::AlpacaPaper,
        "AlpacaLive" => BrokerType::AlpacaLive,
        "IBKR" => BrokerType::IBKR,
        "Schwab" => BrokerType::Schwab,
        "TastyTrade" => BrokerType::TastyTrade,
        "TradeStation" => BrokerType::TradeStation,
        "ETrade" => BrokerType::ETrade,
        _ => BrokerType::Paper,
    };
    let restrictions = crate::prop_firm::rule_fetcher::get_broker_restrictions(&broker_type);
    Ok(serde_json::json!({ "broker": broker, "restrictions": restrictions }))
}