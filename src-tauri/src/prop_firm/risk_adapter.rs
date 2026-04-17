use crate::prop_firm::PropFirmEngine;
use crate::prop_firm::trailing_drawdown::TrailingDrawdown;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderCheck {
    pub order_symbol: String,
    pub order_side: String,
    pub order_qty: f64,
    pub order_price: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioState {
    pub equity: f64,
    pub total_value: f64,
    pub positions: Vec<PositionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionInfo {
    pub symbol: String,
    pub qty: f64,
    pub side: String,
    pub market_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Violation {
    pub violation_type: String,
    pub reason: String,
    pub hard_block: bool,
    #[serde(default)]
    pub size_multiplier: f64,
    #[serde(default)]
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderCheckResult {
    pub approved: bool,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub primary_violation: Option<String>,
    #[serde(default)]
    pub all_violations: Vec<Violation>,
    #[serde(default)]
    pub size_multiplier: f64,
    #[serde(default)]
    pub reduced_size: Option<f64>,
}

impl Default for OrderCheckResult {
    fn default() -> Self {
        Self {
            approved: true,
            reason: None,
            primary_violation: None,
            all_violations: vec![],
            size_multiplier: 1.0,
            reduced_size: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlattenCheck {
    pub required: bool,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RiskAdapterState {
    pub daily_pnl: f64,
    pub session_start_equity: Option<f64>,
    pub violations_count: usize,
    #[serde(default)]
    pub last_check: Option<serde_json::Value>,
}

pub struct PropRiskAdapter {
    pub engine: PropFirmEngine,
    pub trailing_drawdown: Option<TrailingDrawdown>,
    pub auto_flatten: bool,
    state: RiskAdapterState,
}

impl PropRiskAdapter {
    pub fn new(engine: PropFirmEngine) -> Self {
        Self {
            engine,
            trailing_drawdown: None,
            auto_flatten: true,
            state: RiskAdapterState::default(),
        }
    }

    pub fn with_trailing_drawdown(mut self, dd: TrailingDrawdown) -> Self {
        self.trailing_drawdown = Some(dd);
        self
    }

    pub fn with_auto_flatten(mut self, auto_flatten: bool) -> Self {
        self.auto_flatten = auto_flatten;
        self
    }

    pub fn check_order(&mut self, order: &OrderCheck, portfolio: &PortfolioState, _context: &serde_json::Value) -> OrderCheckResult {
        let mut violations: Vec<Violation> = vec![];
        let mut size_multiplier = 1.0;
        let equity = if portfolio.equity > 0.0 { portfolio.equity } else { portfolio.total_value };

        if let Some(dd) = &mut self.trailing_drawdown {
            let dd_status = dd.update(equity);
            if dd_status.breached {
                violations.push(Violation {
                    violation_type: "TRAILING_DRAWDOWN_BREACH".to_string(),
                    reason: format!("Trailing drawdown breach - equity {} below limit {}", equity, dd_status.trailing_limit),
                    hard_block: true,
                    size_multiplier: 0.0,
                    details: serde_json::json!({
                        "equity": equity,
                        "trailing_limit": dd_status.trailing_limit,
                        "current_drawdown": dd_status.current_drawdown,
                    }),
                });
            } else {
                let rec = dd.get_size_multiplier();
                if rec.multiplier < size_multiplier {
                    size_multiplier = rec.multiplier;
                }
                if dd_status.in_buffer_zone {
                    // Buffer zone warning - can continue but with caution
                }
            }
        }

        let config = &self.engine.config;
        if (portfolio.equity - equity).abs() / portfolio.equity >= config.max_daily_loss {
            violations.push(Violation {
                violation_type: "DAILY_LOSS_BREACH".to_string(),
                reason: format!("Daily loss exceeds {}% limit", config.max_daily_loss * 100.0),
                hard_block: true,
                size_multiplier: 0.0,
                details: serde_json::json!({}),
            });
        }

        if config.news_filter || config.overnight_filter || config.weekend_filter {
            // These are checked externally; we just flag the rule exists
        }

        if !violations.is_empty() {
            let primary = violations.first().unwrap().violation_type.clone();
            let hard_block = violations.iter().any(|v| v.hard_block);
            let mult = if hard_block { 0.0 } else { size_multiplier };
            let reason = violations.iter().map(|v| v.reason.as_str()).collect::<Vec<_>>().join("; ");

            self.state.violations_count += violations.len();
            self.state.last_check = Some(serde_json::json!({
                "approved": false,
                "violations": violations.len()
            }));

            OrderCheckResult {
                approved: false,
                reason: Some(reason),
                primary_violation: Some(primary),
                all_violations: violations,
                size_multiplier: mult,
                reduced_size: if mult < 1.0 { Some((order.order_qty * mult).floor()) } else { None },
            }
        } else {
            let reduced = if size_multiplier < 1.0 {
                Some((order.order_qty * size_multiplier).floor())
            } else {
                None
            };

            self.state.last_check = Some(serde_json::json!({
                "approved": true,
                "size_multiplier": size_multiplier
            }));

            OrderCheckResult {
                approved: true,
                reason: None,
                primary_violation: None,
                all_violations: vec![],
                size_multiplier,
                reduced_size: reduced,
            }
        }
    }

    pub fn check_flatten_required(&self) -> FlattenCheck {
        if let Some(dd) = &self.trailing_drawdown {
            let halt = dd.should_halt();
            if halt.halt {
                return FlattenCheck {
                    required: true,
                    reason: Some(halt.reason.unwrap_or_else(|| "Trailing drawdown breached".to_string())),
                    source: Some("trailingDrawdown".to_string()),
                };
            }
        }

        FlattenCheck {
            required: false,
            reason: None,
            source: None,
        }
    }

    pub fn auto_flatten(&mut self, reason: &str) -> FlattenCheck {
        FlattenCheck {
            required: true,
            reason: Some(reason.to_string()),
            source: Some("riskAdapter".to_string()),
        }
    }

    pub fn update_equity(&mut self, equity: f64, pnl: f64) {
        if self.state.session_start_equity.is_none() {
            self.state.session_start_equity = Some(equity);
        }
        if let Some(dd) = &mut self.trailing_drawdown {
            dd.update(equity);
        }
        self.state.daily_pnl += pnl;
        self.engine.update_high_water_mark(equity);
    }

    pub fn get_position_size_recommendation(&self, order: &OrderCheck, portfolio: &PortfolioState) -> PositionSizeRecommendation {
        let mut recommendations: Vec<SizeSource> = vec![];
        let _equity = if portfolio.equity > 0.0 { portfolio.equity } else { portfolio.total_value };

        if let Some(dd) = &self.trailing_drawdown {
            let rec = dd.get_size_multiplier();
            recommendations.push(SizeSource {
                source: "trailingDrawdown".to_string(),
                multiplier: rec.multiplier,
                action: rec.action,
                reason: rec.reason,
            });
        }

        let min_mult = recommendations.iter().map(|r| r.multiplier).fold(1.0, f64::min);
        let primary = recommendations.iter().find(|r| (r.multiplier - min_mult).abs() < f64::EPSILON);

        PositionSizeRecommendation {
            multiplier: min_mult,
            primary_source: primary.map(|r| r.source.clone()),
            recommendations,
            original_size: order.order_qty,
            recommended_size: (order.order_qty * min_mult).floor(),
        }
    }

    pub fn get_status(&self) -> RiskAdapterState {
        self.state.clone()
    }

    pub fn reset(&mut self) {
        self.state = RiskAdapterState::default();
        if let Some(dd) = &mut self.trailing_drawdown {
            dd.reset(None);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeSource {
    pub source: String,
    pub multiplier: f64,
    pub action: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionSizeRecommendation {
    pub multiplier: f64,
    pub primary_source: Option<String>,
    pub recommendations: Vec<SizeSource>,
    pub original_size: f64,
    pub recommended_size: f64,
}