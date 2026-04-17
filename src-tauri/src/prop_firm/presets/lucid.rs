use crate::prop_firm::{PropFirmPreset, PropFirmRuleProvider, PresetRules, ConsistencyRule, InstrumentRestrictions, TradingRestrictions, FundedConfig, FundedDrawdown, ScalingLevel, ScalingPlan, StrategyConfig, RiskConfig, BufferZone, DailyRiskConfig, ProfitPacing, PhaseConfig, PayoutSchedule};

pub struct LucidPreset;

impl PropFirmRuleProvider for LucidPreset {
    fn name(&self) -> &str { "Lucid Trading" }

    fn preset(&self) -> PropFirmPreset {
        PropFirmPreset {
            name: "LucidFlex 50K".to_string(),
            provider: "Lucid Trading".to_string(),
            url: Some("https://lucidtrading.com/#plans".to_string()),
            account_size: 50000.0,
            rules: PresetRules {
                profit_target: 3000.0,
                max_loss_limit: 2000.0,
                daily_loss_limit: None,
                consistency_rule: ConsistencyRule {
                    max_day_percent: Some(0.50),
                    description: "Largest day profit cannot exceed 50% of total profit".to_string(),
                    enforcement: "strict".to_string(),
                },
                min_trading_days: None,
                time_limit: None,
                payout: 0.90,
                instruments: InstrumentRestrictions {
                    futures: Some(vec!["ES".into(), "NQ".into(), "MES".into(), "MNQ".into(), "CL".into(), "GC".into(), "ZN".into()]),
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
                        ScalingLevel { threshold: 55000.0, max_contracts: 2, description: Some("First scale".to_string()) },
                        ScalingLevel { threshold: 60000.0, max_contracts: 3, description: Some("Second scale".to_string()) },
                        ScalingLevel { threshold: 70000.0, max_contracts: 4, description: Some("Third scale".to_string()) },
                        ScalingLevel { threshold: 80000.0, max_contracts: 5, description: Some("Fourth scale".to_string()) },
                        ScalingLevel { threshold: 100000.0, max_contracts: 6, description: Some("Fifth scale".to_string()) },
                    ],
                    description: Some("Contract limit increases as equity grows".to_string()),
                },
                funded_drawdown: Some(FundedDrawdown {
                    drawdown_type: "trailing".to_string(),
                    amount: 2000.0,
                    description: Some("Trailing drawdown continues in funded phase".to_string()),
                }),
                payout_schedule: Some(PayoutSchedule {
                    frequency: "biweekly".to_string(),
                    method: "bank_transfer".to_string(),
                    minimum: Some(500.0),
                }),
            },
            strategy: StrategyConfig {
                micros_first: true,
                max_risk_per_trade: 10.0,
                daily_target_min: 150.0,
                daily_target_max: 450.0,
                smoothness_target: 0.85,
                max_drawdown_percent: Some(0.60),
                max_contracts: Some(serde_json::json!({"evaluation": 4, "funded": 2})),
                profit_pacing: Some(ProfitPacing {
                    daily_target_min: 200.0,
                    daily_target_max: 400.0,
                    multiplier: 1.0,
                }),
            },
            risk: RiskConfig {
                soft_stop_percent: 0.70,
                buffer_zone: BufferZone {
                    caution: 0.50,
                    reduce: 0.30,
                    critical: 0.20,
                    halt: 0.00,
                },
                daily_risk: DailyRiskConfig {
                    max_trades: 5,
                    max_loss_per_trade: 50.0,
                    cooldown_after_loss: 15,
                },
            },
            phases: vec![
                PhaseConfig {
                    name: "Evaluation".to_string(),
                    phase_type: "evaluation".to_string(),
                    duration: None,
                    profit_target: Some(3000.0),
                    max_drawdown: Some(2000.0),
                    consistency_enforced: true,
                },
                PhaseConfig {
                    name: "Funded".to_string(),
                    phase_type: "funded".to_string(),
                    duration: None,
                    profit_target: None,
                    max_drawdown: Some(2000.0),
                    consistency_enforced: false,
                },
                PhaseConfig {
                    name: "Scaling".to_string(),
                    phase_type: "scaling".to_string(),
                    duration: None,
                    profit_target: None,
                    max_drawdown: None,
                    consistency_enforced: false,
                },
            ],
            metadata: serde_json::json!({
                "created": "2026-03-29",
                "version": "1.0.0",
                "notes": "LucidFlex 50K evaluation - no time limit, 90% payout, trailing drawdown",
                "tags": ["futures", "no-time-limit", "trailing-drawdown", "consistency-rule"]
            }),
        }
    }
}