use crate::prop_firm::{PropFirmPreset, PropFirmRuleProvider, PresetRules, ConsistencyRule, InstrumentRestrictions, TradingRestrictions, FundedConfig, FundedDrawdown, ScalingLevel, ScalingPlan, StrategyConfig, RiskConfig, BufferZone, DailyRiskConfig, PhaseConfig};

pub struct ApexPreset;

impl PropFirmRuleProvider for ApexPreset {
    fn name(&self) -> &str { "Apex Trader Funding" }

    fn preset(&self) -> PropFirmPreset {
        PropFirmPreset {
            name: "Apex 50K Evaluation".to_string(),
            provider: "Apex Trader Funding".to_string(),
            url: Some("https://apextraderfunding.com".to_string()),
            account_size: 50000.0,
            rules: PresetRules {
                profit_target: 3000.0,
                max_loss_limit: 2500.0,
                daily_loss_limit: Some(1250.0),
                consistency_rule: ConsistencyRule {
                    max_day_percent: None,
                    description: "No consistency rule".to_string(),
                    enforcement: "strict".to_string(),
                },
                min_trading_days: None,
                time_limit: None,
                payout: 0.80,
                instruments: InstrumentRestrictions {
                    futures: Some(vec!["ES".into(), "NQ".into(), "MES".into(), "MNQ".into(), "CL".into(), "GC".into(), "ZN".into(), "RTY".into(), "YM".into()]),
                    forex: None,
                    stocks: None,
                    indices: None,
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
                        ScalingLevel { threshold: 50000.0, max_contracts: 2, description: Some("Starting".to_string()) },
                        ScalingLevel { threshold: 55000.0, max_contracts: 3, description: Some("First scale".to_string()) },
                        ScalingLevel { threshold: 60000.0, max_contracts: 4, description: Some("Second scale".to_string()) },
                        ScalingLevel { threshold: 70000.0, max_contracts: 5, description: Some("Third scale".to_string()) },
                    ],
                    description: Some("Apex scaling plan".to_string()),
                },
                funded_drawdown: Some(FundedDrawdown {
                    drawdown_type: "trailing".to_string(),
                    amount: 2500.0,
                    description: Some("Trailing drawdown in funded phase".to_string()),
                }),
                payout_schedule: None,
            },
            strategy: StrategyConfig {
                micros_first: true,
                max_risk_per_trade: 20.0,
                daily_target_min: 150.0,
                daily_target_max: 450.0,
                smoothness_target: 0.80,
                max_drawdown_percent: None,
                max_contracts: None,
                profit_pacing: None,
            },
            risk: RiskConfig {
                soft_stop_percent: 0.65,
                buffer_zone: BufferZone {
                    caution: 0.45,
                    reduce: 0.30,
                    critical: 0.15,
                    halt: 0.00,
                },
                daily_risk: DailyRiskConfig {
                    max_trades: 5,
                    max_loss_per_trade: 60.0,
                    cooldown_after_loss: 20,
                },
            },
            phases: vec![
                PhaseConfig {
                    name: "Evaluation".to_string(),
                    phase_type: "evaluation".to_string(),
                    duration: None,
                    profit_target: Some(3000.0),
                    max_drawdown: Some(2500.0),
                    consistency_enforced: false,
                },
                PhaseConfig {
                    name: "Funded".to_string(),
                    phase_type: "funded".to_string(),
                    duration: None,
                    profit_target: None,
                    max_drawdown: Some(2500.0),
                    consistency_enforced: false,
                },
            ],
            metadata: serde_json::json!({
                "created": "2026-04-09",
                "version": "1.0.0",
                "notes": "Apex Trader Funding 50K Evaluation - trailing drawdown, 80% payout, news trading allowed",
                "tags": ["futures", "trailing-drawdown", "no-consistency-rule", "news-allowed"]
            }),
        }
    }
}