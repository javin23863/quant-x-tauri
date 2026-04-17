use crate::prop_firm::PropFirmEngine;
use crate::prop_firm::phase_controller::PhaseController;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PhaseType {
    Evaluation,
    Funded,
    Scaling,
}

impl Default for PhaseType {
    fn default() -> Self { PhaseType::Evaluation }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectedViolation {
    pub violation_type: String,
    pub reason: String,
    pub hard_block: bool,
    #[serde(default)]
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyOrderResult {
    pub allowed: bool,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub breach: Option<String>,
    #[serde(default)]
    pub all_breaches: Vec<SafetyBreach>,
    #[serde(default)]
    pub warnings: Vec<SafetyWarning>,
    #[serde(default)]
    pub soft_stop_status: Option<SoftStopStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyBreach {
    pub breach_type: String,
    pub reason: String,
    #[serde(default)]
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyWarning {
    pub warning_type: String,
    pub reason: String,
    #[serde(default)]
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SoftStopStatus {
    pub drawdown_percent: f64,
    pub threshold: f64,
    pub triggered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedAction {
    pub recommended_action: String,
    pub all_actions: Vec<ActionItem>,
    #[serde(default)]
    pub status: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionItem {
    pub priority: u32,
    pub action: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetySnapshot {
    pub equity: f64,
    pub total_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyStatus {
    pub daily_pnl: f64,
    pub daily_pnl_limit: Option<f64>,
    pub daily_pnl_warning: Option<f64>,
    pub start_of_day_equity: Option<f64>,
    pub current_equity: Option<f64>,
    pub trade_count: u32,
    pub soft_stop_triggered: bool,
    pub soft_stop_percent: f64,
    pub warnings_count: usize,
    pub flatten_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyExport {
    pub daily_pnl_limit: Option<f64>,
    pub daily_pnl_warning: Option<f64>,
    pub start_of_day_equity: Option<f64>,
    pub current_equity: Option<f64>,
    pub daily_pnl: f64,
    pub trade_count: u32,
    pub soft_stop_triggered: bool,
    pub soft_stop_percent: f64,
}

struct DailyPnlCheck {
    allowed: bool,
    warning: bool,
    breach_type: String,
    reason: String,
    daily_pnl: f64,
    limit: f64,
}

struct SoftStopCheck {
    allowed: bool,
    warning: bool,
    reason: Option<String>,
}

pub struct PropSafetyAdapter {
    pub engine: PropFirmEngine,
    pub phase_controller: Option<PhaseController>,
    pub daily_pnl_limit: Option<f64>,
    pub daily_pnl_warning: Option<f64>,
    pub soft_stop_percent: f64,
    pub auto_flatten: bool,
    start_of_day_equity: Option<f64>,
    current_equity: Option<f64>,
    daily_pnl: f64,
    trade_count: u32,
    soft_stop_triggered: bool,
    warnings: Vec<SafetyWarning>,
    injected_violations: Vec<InjectedViolation>,
    injected_warnings: Vec<InjectedViolation>,
    flatten_required: bool,
    flatten_reason: Option<String>,
}

impl PropSafetyAdapter {
    pub fn new(engine: PropFirmEngine) -> Self {
        let daily_limit = engine.starting_equity * engine.config.max_daily_loss;
        Self {
            engine,
            phase_controller: None,
            daily_pnl_limit: Some(daily_limit),
            daily_pnl_warning: Some(daily_limit * 0.7),
            soft_stop_percent: 0.70,
            auto_flatten: true,
            start_of_day_equity: None,
            current_equity: None,
            daily_pnl: 0.0,
            trade_count: 0,
            soft_stop_triggered: false,
            warnings: vec![],
            injected_violations: vec![],
            injected_warnings: vec![],
            flatten_required: false,
            flatten_reason: None,
        }
    }

    pub fn with_daily_limit(mut self, limit: Option<f64>) -> Self {
        self.daily_pnl_limit = limit;
        self.daily_pnl_warning = limit.map(|l| l * 0.7);
        self
    }

    pub fn with_soft_stop(mut self, percent: f64) -> Self {
        self.soft_stop_percent = percent;
        self
    }

    pub fn with_phase_controller(mut self, pc: PhaseController) -> Self {
        self.phase_controller = Some(pc);
        self
    }

    pub fn check_order(&mut self, snapshot: &SafetySnapshot) -> SafetyOrderResult {
        let mut warnings: Vec<SafetyWarning> = vec![];
        let mut breaches: Vec<SafetyBreach> = vec![];

        if let Some(latest) = self.injected_violations.last() {
            return SafetyOrderResult {
                allowed: false,
                reason: Some(latest.reason.clone()),
                breach: Some(latest.violation_type.clone()),
                all_breaches: vec![SafetyBreach {
                    breach_type: latest.violation_type.clone(),
                    reason: latest.reason.clone(),
                    details: latest.details.clone(),
                }],
                warnings: vec![],
                soft_stop_status: None,
            };
        }

        let pnl_check = self.check_daily_pnl(snapshot);
        if !pnl_check.allowed {
            breaches.push(SafetyBreach {
                breach_type: pnl_check.breach_type,
                reason: pnl_check.reason,
                details: serde_json::json!({
                    "daily_pnl": pnl_check.daily_pnl,
                    "limit": pnl_check.limit,
                }),
            });
        } else if pnl_check.warning {
            warnings.push(SafetyWarning {
                warning_type: pnl_check.breach_type,
                reason: pnl_check.reason,
                details: serde_json::json!({
                    "daily_pnl": pnl_check.daily_pnl,
                    "limit": pnl_check.limit,
                }),
            });
        }

        let soft_check = self.check_soft_stop(snapshot);
        if !soft_check.allowed {
            breaches.push(SafetyBreach {
                breach_type: "SOFT_STOP_BREACH".to_string(),
                reason: soft_check.reason.unwrap_or_default(),
                details: serde_json::json!({}),
            });
        } else if soft_check.warning {
            warnings.push(SafetyWarning {
                warning_type: "SOFT_STOP_WARNING".to_string(),
                reason: soft_check.reason.unwrap_or_default(),
                details: serde_json::json!({}),
            });
        }

        if !breaches.is_empty() {
            let reason = breaches.iter().map(|b| b.reason.as_str()).collect::<Vec<_>>().join("; ");
            SafetyOrderResult {
                allowed: false,
                reason: Some(reason),
                breach: Some(breaches[0].breach_type.clone()),
                all_breaches: breaches,
                warnings,
                soft_stop_status: None,
            }
        } else {
            let status = if self.start_of_day_equity.unwrap_or(0.0) > 0.0 && self.current_equity.unwrap_or(0.0) > 0.0 {
                Some(SoftStopStatus {
                    drawdown_percent: ((self.start_of_day_equity.unwrap_or(0.0) - self.current_equity.unwrap_or(0.0)) / self.start_of_day_equity.unwrap_or(1.0)) * 100.0,
                    threshold: self.soft_stop_percent,
                    triggered: self.soft_stop_triggered,
                })
            } else {
                None
            };
            SafetyOrderResult {
                allowed: true,
                reason: None,
                breach: None,
                all_breaches: vec![],
                warnings,
                soft_stop_status: status,
            }
        }
    }

    fn check_daily_pnl(&mut self, snapshot: &SafetySnapshot) -> DailyPnlCheck {
        let limit = match self.daily_pnl_limit {
            Some(l) => l,
            None => return DailyPnlCheck { allowed: true, warning: false, breach_type: String::new(), reason: String::new(), daily_pnl: 0.0, limit: 0.0 },
        };

        let current_equity = snapshot.equity;
        let start_equity = self.start_of_day_equity.unwrap_or(current_equity);
        let daily_pnl = current_equity - start_equity;

        if daily_pnl < -limit.abs() {
            DailyPnlCheck {
                allowed: false,
                warning: false,
                breach_type: "DAILY_PNL_BREACH".to_string(),
                reason: format!("Daily P&L breach: {:.2} exceeds limit of -{:.2}", daily_pnl, limit.abs()),
                daily_pnl,
                limit,
            }
        } else if let Some(warning_limit) = self.daily_pnl_warning {
            if daily_pnl < -warning_limit.abs() {
                DailyPnlCheck {
                    allowed: true,
                    warning: true,
                    breach_type: "DAILY_PNL_WARNING".to_string(),
                    reason: format!("Daily P&L warning: {:.2} approaching limit", daily_pnl),
                    daily_pnl,
                    limit,
                }
            } else {
                DailyPnlCheck { allowed: true, warning: false, breach_type: String::new(), reason: String::new(), daily_pnl, limit }
            }
        } else {
            DailyPnlCheck { allowed: true, warning: false, breach_type: String::new(), reason: String::new(), daily_pnl, limit }
        }
    }

    fn check_soft_stop(&mut self, snapshot: &SafetySnapshot) -> SoftStopCheck {
        let current_equity = snapshot.equity;
        let start_equity = self.start_of_day_equity.unwrap_or(current_equity);

        if start_equity <= 0.0 {
            return SoftStopCheck { allowed: true, warning: false, reason: None };
        }

        let drawdown_pct = ((start_equity - current_equity) / start_equity) * 100.0;
        let hard_stop_threshold = self.soft_stop_percent * 100.0 * 1.43;

        if drawdown_pct >= hard_stop_threshold {
            if self.auto_flatten {
                self.flatten_all(&format!("Soft stop hard breach: drawdown {:.1}%", drawdown_pct));
            }
            SoftStopCheck {
                allowed: false,
                warning: false,
                reason: Some(format!("Soft stop hard breach: drawdown {:.1}% exceeds {:.0}%", drawdown_pct, hard_stop_threshold)),
            }
        } else if drawdown_pct >= self.soft_stop_percent * 100.0 {
            self.soft_stop_triggered = true;
            SoftStopCheck {
                allowed: true,
                warning: true,
                reason: Some(format!("Soft stop warning: drawdown {:.1}% at {:.0}% threshold", drawdown_pct, self.soft_stop_percent * 100.0)),
            }
        } else {
            SoftStopCheck { allowed: true, warning: false, reason: None }
        }
    }

    pub fn update_equity(&mut self, equity: f64) {
        if self.start_of_day_equity.is_none() {
            self.start_of_day_equity = Some(equity);
        }
        self.current_equity = Some(equity);
        self.daily_pnl = equity - self.start_of_day_equity.unwrap_or(equity);
    }

    pub fn record_trade(&mut self) {
        self.trade_count += 1;
    }

    pub fn reset_daily_counters(&mut self) {
        self.start_of_day_equity = self.current_equity.or(self.start_of_day_equity);
        self.daily_pnl = 0.0;
        self.trade_count = 0;
        self.soft_stop_triggered = false;
        self.warnings = vec![];
    }

    pub fn inject_violation(&mut self, violation: InjectedViolation) {
        if violation.hard_block {
            self.injected_violations.push(violation);
        } else {
            self.injected_warnings.push(violation);
        }
    }

    pub fn flatten_all(&mut self, reason: &str) {
        self.flatten_required = true;
        self.flatten_reason = Some(reason.to_string());
    }

    pub fn is_flatten_required(&self) -> bool {
        self.flatten_required
    }

    pub fn get_flatten_reason(&self) -> Option<&str> {
        self.flatten_reason.as_deref()
    }

    pub fn clear_flatten_flag(&mut self) {
        self.flatten_required = false;
        self.flatten_reason = None;
    }

    pub fn get_status(&self) -> SafetyStatus {
        SafetyStatus {
            daily_pnl: self.daily_pnl,
            daily_pnl_limit: self.daily_pnl_limit,
            daily_pnl_warning: self.daily_pnl_warning,
            start_of_day_equity: self.start_of_day_equity,
            current_equity: self.current_equity,
            trade_count: self.trade_count,
            soft_stop_triggered: self.soft_stop_triggered,
            soft_stop_percent: self.soft_stop_percent,
            warnings_count: self.warnings.len(),
            flatten_required: self.flatten_required,
        }
    }

    pub fn get_recommended_action(&self) -> RecommendedAction {
        let mut actions: Vec<ActionItem> = vec![];

        if let Some(limit) = self.daily_pnl_limit {
            if self.daily_pnl < 0.0 && limit > 0.0 {
                let pct_to_limit = self.daily_pnl.abs() / limit;
                if pct_to_limit >= 0.9 {
                    actions.push(ActionItem { priority: 1, action: "HALT".to_string(), reason: "Daily P&L limit nearly reached".to_string() });
                } else if pct_to_limit >= 0.7 {
                    actions.push(ActionItem { priority: 2, action: "REDUCE_SIZE".to_string(), reason: "Approaching daily P&L limit".to_string() });
                }
            }
        }

        if self.soft_stop_triggered {
            actions.push(ActionItem { priority: 2, action: "CAUTION".to_string(), reason: "Soft stop triggered - reduce risk".to_string() });
        }

        actions.sort_by_key(|a| a.priority);

        RecommendedAction {
            recommended_action: actions.first().map(|a| a.action.clone()).unwrap_or_else(|| "NORMAL".to_string()),
            all_actions: actions,
            status: serde_json::to_value(self.get_status()).unwrap_or_default(),
        }
    }

    pub fn export(&self) -> SafetyExport {
        SafetyExport {
            daily_pnl_limit: self.daily_pnl_limit,
            daily_pnl_warning: self.daily_pnl_warning,
            start_of_day_equity: self.start_of_day_equity,
            current_equity: self.current_equity,
            daily_pnl: self.daily_pnl,
            trade_count: self.trade_count,
            soft_stop_triggered: self.soft_stop_triggered,
            soft_stop_percent: self.soft_stop_percent,
        }
    }
}