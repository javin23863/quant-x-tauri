use crate::prop_firm::{PropFirmPreset, PropFirmRuleProvider, PresetRules, ConsistencyRule, InstrumentRestrictions, TradingRestrictions, FundedConfig, FundedDrawdown, ScalingLevel, ScalingPlan, StrategyConfig, RiskConfig, BufferZone, DailyRiskConfig, PhaseConfig};

pub struct FtmoPreset;

impl PropFirmRuleProvider for FtmoPreset {
    fn name(&self) -> &str { "FTMO" }

    fn preset(&self) -> PropFirmPreset {
        PropFirmPreset {
            name: "FTMO 50K Challenge".to_string(),
            provider: "FTMO".to_string(),
            url: Some("https://ftmo.com".to_string()),
            account_size: 50000.0,
            rules: PresetRules {
                profit_target: 5000.0,
                max_loss_limit: 5000.0,
                daily_loss_limit: Some(2500.0),
                consistency_rule: ConsistencyRule {
                    max_day_percent: None,
                    description: "No consistency rule".to_string(),
                    enforcement: "strict".to_string(),
                },
                min_trading_days: Some(4),
                time_limit: Some(30),
                payout: 0.80,
                instruments: InstrumentRestrictions {
                    futures: None,
                    forex: Some(vec!["EURUSD".into(), "GBPUSD".into(), "USDJPY".into(), "XAUUSD".into()]),
                    stocks: None,
                    indices: Some(vec!["US30".into(), "US500".into(), "US100".into(), "GER30".into()]),
                },
                restrictions: TradingRestrictions {
                    news_trading: true,
                    overnight_holding: true,
                    weekend_holding: false,
                    scaling: true,
                },
            },
            funded: FundedConfig {
                scaling: ScalingPlan {
                    levels: vec![
                        ScalingLevel { threshold: 50000.0, max_contracts: 2, description: None },
                        ScalingLevel { threshold: 60000.0, max_contracts: 3, description: None },
                        ScalingLevel { threshold: 75000.0, max_contracts: 4, description: None },
                        ScalingLevel { threshold: 100000.0, max_contracts: 5, description: None },
                    ],
                    description: None,
                },
                funded_drawdown: Some(FundedDrawdown {
                    drawdown_type: "relative".to_string(),
                    amount: 5000.0,
                    description: None,
                }),
                payout_schedule: None,
            },
            strategy: StrategyConfig {
                micros_first: true,
                max_risk_per_trade: 25.0,
                daily_target_min: 250.0,
                daily_target_max: 750.0,
                smoothness_target: 0.80,
                max_drawdown_percent: None,
                max_contracts: None,
                profit_pacing: None,
            },
            risk: RiskConfig {
                soft_stop_percent: 0.60,
                buffer_zone: BufferZone {
                    caution: 0.45,
                    reduce: 0.30,
                    critical: 0.15,
                    halt: 0.00,
                },
                daily_risk: DailyRiskConfig {
                    max_trades: 5,
                    max_loss_per_trade: 75.0,
                    cooldown_after_loss: 20,
                },
            },
            phases: vec![
                PhaseConfig {
                    name: "Challenge".to_string(),
                    phase_type: "challenge".to_string(),
                    duration: Some(30),
                    profit_target: Some(5000.0),
                    max_drawdown: Some(5000.0),
                    consistency_enforced: false,
                },
                PhaseConfig {
                    name: "Verification".to_string(),
                    phase_type: "verification".to_string(),
                    duration: Some(60),
                    profit_target: Some(2500.0),
                    max_drawdown: Some(5000.0),
                    consistency_enforced: false,
                },
                PhaseConfig {
                    name: "FTMO Trader".to_string(),
                    phase_type: "funded".to_string(),
                    duration: None,
                    profit_target: None,
                    max_drawdown: Some(5000.0),
                    consistency_enforced: false,
                },
            ],
            metadata: serde_json::json!({
                "created": "2026-03-29",
                "version": "1.0.0",
                "notes": "FTMO 50K Challenge - 2-phase process (Challenge + Verification)"
            }),
        }
    }
}