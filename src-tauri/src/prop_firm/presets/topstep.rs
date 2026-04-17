use crate::prop_firm::{PropFirmPreset, PropFirmRuleProvider, PresetRules, ConsistencyRule, InstrumentRestrictions, TradingRestrictions, FundedConfig, FundedDrawdown, ScalingLevel, ScalingPlan, StrategyConfig, RiskConfig, BufferZone, DailyRiskConfig, PhaseConfig};

pub struct TopstepPreset;

impl PropFirmRuleProvider for TopstepPreset {
    fn name(&self) -> &str { "TopStep Trading" }

    fn preset(&self) -> PropFirmPreset {
        PropFirmPreset {
            name: "TopStep Trader 50K".to_string(),
            provider: "TopStep Trading".to_string(),
            url: Some("https://topsteptrader.com".to_string()),
            account_size: 50000.0,
            rules: PresetRules {
                profit_target: 3000.0,
                max_loss_limit: 2000.0,
                daily_loss_limit: Some(1000.0),
                consistency_rule: ConsistencyRule {
                    max_day_percent: None,
                    description: "No consistency rule - profit however you want".to_string(),
                    enforcement: "strict".to_string(),
                },
                min_trading_days: None,
                time_limit: None,
                payout: 0.80,
                instruments: InstrumentRestrictions {
                    futures: Some(vec!["ES".into(), "NQ".into(), "MES".into(), "MNQ".into(), "CL".into(), "GC".into(), "ZN".into(), "ZB".into(), "RTY".into()]),
                    forex: None,
                    stocks: None,
                    indices: None,
                },
                restrictions: TradingRestrictions {
                    news_trading: false,
                    overnight_holding: true,
                    weekend_holding: false,
                    scaling: true,
                },
            },
            funded: FundedConfig {
                scaling: ScalingPlan {
                    levels: vec![
                        ScalingLevel { threshold: 50000.0, max_contracts: 2, description: None },
                        ScalingLevel { threshold: 55000.0, max_contracts: 3, description: None },
                        ScalingLevel { threshold: 60000.0, max_contracts: 4, description: None },
                        ScalingLevel { threshold: 70000.0, max_contracts: 5, description: None },
                    ],
                    description: None,
                },
                funded_drawdown: Some(FundedDrawdown {
                    drawdown_type: "daily_trailing".to_string(),
                    amount: 2000.0,
                    description: None,
                }),
                payout_schedule: None,
            },
            strategy: StrategyConfig {
                micros_first: true,
                max_risk_per_trade: 15.0,
                daily_target_min: 100.0,
                daily_target_max: 300.0,
                smoothness_target: 0.75,
                max_drawdown_percent: None,
                max_contracts: None,
                profit_pacing: None,
            },
            risk: RiskConfig {
                soft_stop_percent: 0.50,
                buffer_zone: BufferZone {
                    caution: 0.40,
                    reduce: 0.25,
                    critical: 0.15,
                    halt: 0.00,
                },
                daily_risk: DailyRiskConfig {
                    max_trades: 3,
                    max_loss_per_trade: 100.0,
                    cooldown_after_loss: 30,
                },
            },
            phases: vec![
                PhaseConfig {
                    name: "Combine".to_string(),
                    phase_type: "combine".to_string(),
                    duration: None,
                    profit_target: Some(3000.0),
                    max_drawdown: Some(2000.0),
                    consistency_enforced: false,
                },
                PhaseConfig {
                    name: "Funded".to_string(),
                    phase_type: "funded".to_string(),
                    duration: None,
                    profit_target: None,
                    max_drawdown: Some(2000.0),
                    consistency_enforced: false,
                },
            ],
            metadata: serde_json::json!({
                "created": "2026-03-29",
                "version": "1.0.0",
                "notes": "TopStep 50K Combine - daily loss limit + trailing drawdown"
            }),
        }
    }
}