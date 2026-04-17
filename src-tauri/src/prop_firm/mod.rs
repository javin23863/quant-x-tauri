pub mod presets;
pub mod rule_fetcher;
pub mod risk_adapter;
pub mod safety_adapter;
pub mod trailing_drawdown;
pub mod phase_controller;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PropFirmPhase {
    Phase1,
    Phase2,
    Funded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsistencyRule {
    pub max_day_percent: Option<f64>,
    pub description: String,
    #[serde(default = "default_consistency_enforcement")]
    pub enforcement: String,
}

fn default_consistency_enforcement() -> String {
    "strict".to_string()
}

impl Default for ConsistencyRule {
    fn default() -> Self {
        Self {
            max_day_percent: None,
            description: "No consistency rule".to_string(),
            enforcement: "strict".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstrumentRestrictions {
    pub futures: Option<Vec<String>>,
    pub forex: Option<Vec<String>>,
    pub stocks: Option<Vec<String>>,
    pub indices: Option<Vec<String>>,
}

impl Default for InstrumentRestrictions {
    fn default() -> Self {
        Self {
            futures: None,
            forex: None,
            stocks: None,
            indices: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingRestrictions {
    pub news_trading: bool,
    pub overnight_holding: bool,
    pub weekend_holding: bool,
    pub scaling: bool,
}

impl Default for TradingRestrictions {
    fn default() -> Self {
        Self {
            news_trading: true,
            overnight_holding: true,
            weekend_holding: false,
            scaling: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScalingLevel {
    pub threshold: f64,
    pub max_contracts: u32,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScalingPlan {
    pub levels: Vec<ScalingLevel>,
    #[serde(default)]
    pub description: Option<String>,
}

impl Default for ScalingPlan {
    fn default() -> Self {
        Self {
            levels: vec![],
            description: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FundedDrawdown {
    #[serde(rename = "type", default)]
    pub drawdown_type: String,
    #[serde(default)]
    pub amount: f64,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutSchedule {
    #[serde(default = "default_payout_frequency")]
    pub frequency: String,
    #[serde(default = "default_payout_method")]
    pub method: String,
    #[serde(default)]
    pub minimum: Option<f64>,
}

fn default_payout_frequency() -> String { "monthly".to_string() }
fn default_payout_method() -> String { "bank_transfer".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FundedConfig {
    #[serde(default)]
    pub scaling: ScalingPlan,
    #[serde(default)]
    pub funded_drawdown: Option<FundedDrawdown>,
    #[serde(default)]
    pub payout_schedule: Option<PayoutSchedule>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StrategyConfig {
    #[serde(default)]
    pub micros_first: bool,
    #[serde(default)]
    pub max_risk_per_trade: f64,
    #[serde(default)]
    pub daily_target_min: f64,
    #[serde(default)]
    pub daily_target_max: f64,
    #[serde(default)]
    pub smoothness_target: f64,
    #[serde(default)]
    pub max_drawdown_percent: Option<f64>,
    #[serde(default)]
    pub max_contracts: Option<serde_json::Value>,
    #[serde(default)]
    pub profit_pacing: Option<ProfitPacing>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfitPacing {
    pub daily_target_min: f64,
    pub daily_target_max: f64,
    pub multiplier: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferZone {
    pub caution: f64,
    pub reduce: f64,
    pub critical: f64,
    pub halt: f64,
}

impl Default for BufferZone {
    fn default() -> Self {
        Self { caution: 0.50, reduce: 0.30, critical: 0.15, halt: 0.00 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRiskConfig {
    pub max_trades: u32,
    pub max_loss_per_trade: f64,
    pub cooldown_after_loss: u32,
}

impl Default for DailyRiskConfig {
    fn default() -> Self {
        Self { max_trades: 5, max_loss_per_trade: 50.0, cooldown_after_loss: 15 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskConfig {
    pub soft_stop_percent: f64,
    #[serde(default)]
    pub buffer_zone: BufferZone,
    #[serde(default)]
    pub daily_risk: DailyRiskConfig,
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            soft_stop_percent: 0.70,
            buffer_zone: BufferZone::default(),
            daily_risk: DailyRiskConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetRules {
    pub profit_target: f64,
    pub max_loss_limit: f64,
    pub daily_loss_limit: Option<f64>,
    #[serde(default)]
    pub consistency_rule: ConsistencyRule,
    pub min_trading_days: Option<u32>,
    pub time_limit: Option<u32>,
    pub payout: f64,
    #[serde(default)]
    pub instruments: InstrumentRestrictions,
    #[serde(default)]
    pub restrictions: TradingRestrictions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub phase_type: String,
    #[serde(default)]
    pub duration: Option<u32>,
    #[serde(default)]
    pub profit_target: Option<f64>,
    #[serde(default)]
    pub max_drawdown: Option<f64>,
    #[serde(default = "default_true")]
    pub consistency_enforced: bool,
}

fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropFirmPreset {
    pub name: String,
    pub provider: String,
    #[serde(default)]
    pub url: Option<String>,
    pub account_size: f64,
    pub rules: PresetRules,
    #[serde(default)]
    pub funded: FundedConfig,
    #[serde(default)]
    pub strategy: StrategyConfig,
    #[serde(default)]
    pub risk: RiskConfig,
    pub phases: Vec<PhaseConfig>,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

pub trait PropFirmRuleProvider: Send + Sync {
    fn name(&self) -> &str;
    fn preset(&self) -> PropFirmPreset;

    fn config(&self) -> PropFirmConfig {
        let p = self.preset();
        PropFirmConfig {
            name: p.name.clone(),
            max_daily_loss: p.rules.daily_loss_limit
                .map(|l| l / p.account_size)
                .unwrap_or(0.05),
            max_total_loss: p.rules.max_loss_limit / p.account_size,
            max_position_size: p.strategy.max_risk_per_trade / p.rules.max_loss_limit.max(1.0),
            max_positions: 1,
            trailing_drawdown: p.rules.max_loss_limit / p.account_size,
            profit_target_p1: p.rules.profit_target / p.account_size,
            profit_target_p2: p.phases.get(1)
                .and_then(|ph| ph.profit_target)
                .map(|t| t / p.account_size)
                .unwrap_or(0.05),
            min_trading_days: p.rules.min_trading_days.unwrap_or(5),
            consistency_pct: p.rules.consistency_rule.max_day_percent.unwrap_or(1.0),
            news_filter: !p.rules.restrictions.news_trading,
            overnight_filter: !p.rules.restrictions.overnight_holding,
            weekend_filter: !p.rules.restrictions.weekend_holding,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropFirmConfig {
    pub name: String,
    pub max_daily_loss: f64,
    pub max_total_loss: f64,
    pub max_position_size: f64,
    pub max_positions: u32,
    pub trailing_drawdown: f64,
    pub profit_target_p1: f64,
    pub profit_target_p2: f64,
    pub min_trading_days: u32,
    pub consistency_pct: f64,
    pub news_filter: bool,
    pub overnight_filter: bool,
    pub weekend_filter: bool,
}

impl Default for PropFirmConfig {
    fn default() -> Self {
        Self {
            name: "Default".to_string(),
            max_daily_loss: 0.05,
            max_total_loss: 0.10,
            max_position_size: 0.02,
            max_positions: 1,
            trailing_drawdown: 0.05,
            profit_target_p1: 0.10,
            profit_target_p2: 0.05,
            min_trading_days: 5,
            consistency_pct: 0.20,
            news_filter: false,
            overnight_filter: false,
            weekend_filter: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropFirmRules {
    pub preset: PropFirmPreset,
    pub source: RuleSource,
    pub fetched_at: Option<String>,
    pub expires_at: Option<String>,
    #[serde(default)]
    pub broker_restrictions: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RuleSource {
    BuiltIn,
    LocalDb,
    RemoteUrl(String),
    Combined,
}

pub struct PropFirmEngine {
    pub config: PropFirmConfig,
    pub phase: PropFirmPhase,
    pub starting_equity: f64,
    pub high_water_mark: f64,
    pub trading_days: u32,
}

impl PropFirmEngine {
    pub fn new(config: PropFirmConfig, starting_equity: f64) -> Self {
        Self {
            config,
            phase: PropFirmPhase::Phase1,
            starting_equity,
            high_water_mark: starting_equity,
            trading_days: 0,
        }
    }

    pub fn update_high_water_mark(&mut self, equity: f64) {
        if equity > self.high_water_mark {
            self.high_water_mark = equity;
        }
    }

    pub fn trailing_drawdown_distance(&self) -> f64 {
        self.high_water_mark * (1.0 - self.config.trailing_drawdown)
    }

    pub fn is_drawdown_breached(&self, equity: f64) -> bool {
        equity < self.trailing_drawdown_distance()
    }

    pub fn is_profit_target_met(&self, equity: f64) -> bool {
        let target = match self.phase {
            PropFirmPhase::Phase1 => self.starting_equity * (1.0 + self.config.profit_target_p1),
            PropFirmPhase::Phase2 => self.starting_equity * (1.0 + self.config.profit_target_p2),
            PropFirmPhase::Funded => f64::INFINITY,
        };
        equity >= target
    }

    pub fn advance_phase(&mut self) -> Option<PropFirmPhase> {
        self.phase = match &self.phase {
            PropFirmPhase::Phase1 => PropFirmPhase::Phase2,
            PropFirmPhase::Phase2 => PropFirmPhase::Funded,
            PropFirmPhase::Funded => return None,
        };
        Some(self.phase.clone())
    }

    pub fn should_flatten(&self, equity: f64, start_of_day_equity: f64) -> bool {
        let config = &self.config;
        (start_of_day_equity - equity) / start_of_day_equity >= config.max_daily_loss
            || (self.starting_equity - equity) / self.starting_equity >= config.max_total_loss
            || self.is_drawdown_breached(equity)
    }
}