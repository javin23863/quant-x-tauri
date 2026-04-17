use chrono::Utc;
use serde::{Deserialize, Serialize};
use crate::prop_firm::PhaseConfig;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum Phase {
    Evaluation,
    Verification,
    Challenge,
    Combine,
    Funded,
    Scaling,
}

impl Phase {
    pub fn as_str(&self) -> &'static str {
        match self {
            Phase::Evaluation => "EVALUATION",
            Phase::Verification => "VERIFICATION",
            Phase::Challenge => "CHALLENGE",
            Phase::Combine => "COMBINE",
            Phase::Funded => "FUNDED",
            Phase::Scaling => "SCALING",
        }
    }

    pub fn from_type(phase_type: &str) -> Self {
        match phase_type.to_lowercase().as_str() {
            "evaluation" => Phase::Evaluation,
            "verification" => Phase::Verification,
            "challenge" => Phase::Challenge,
            "combine" => Phase::Combine,
            "funded" => Phase::Funded,
            "scaling" => Phase::Scaling,
            _ => Phase::Evaluation,
        }
    }

    pub fn is_evaluation_like(&self) -> bool {
        matches!(self, Phase::Evaluation | Phase::Challenge | Phase::Combine | Phase::Verification)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionRecord {
    pub from: String,
    pub to: String,
    pub from_type: String,
    pub to_type: String,
    pub timestamp: i64,
    pub reason: String,
    #[serde(default)]
    pub state: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseHistoryEntry {
    pub phase: String,
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionCondition {
    pub condition_type: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionResult {
    pub can_transition: bool,
    pub current_phase: String,
    pub target_phase: Option<String>,
    pub conditions: Vec<ConditionResult>,
    pub reason: String,
    #[serde(default)]
    pub failed_conditions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionResult {
    pub condition_type: String,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseSettings {
    pub phase: String,
    pub name: String,
    #[serde(rename = "type")]
    pub phase_type: String,
    pub risk_per_trade: f64,
    pub position_size_multiplier: f64,
    pub daily_profit_limit: Option<f64>,
    pub daily_loss_limit: Option<f64>,
    pub consistency_enforced: bool,
    pub can_scale: bool,
    pub profit_target: Option<f64>,
    pub max_drawdown: Option<f64>,
    pub duration: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseAdvanceResult {
    pub success: bool,
    pub reason: String,
    #[serde(default)]
    pub previous_phase: Option<String>,
    #[serde(default)]
    pub new_phase: Option<String>,
    #[serde(default)]
    pub failed_conditions: Vec<String>,
    #[serde(default)]
    pub new_settings: Option<PhaseSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseProgressInfo {
    pub phase_name: String,
    pub phase_type: String,
    pub current_phase_index: usize,
    pub total_phases: usize,
    pub profit_target: Option<f64>,
    pub current_profit: f64,
    pub profit_percent: f64,
    pub max_drawdown: Option<f64>,
    pub current_drawdown: f64,
    pub drawdown_percent: f64,
    pub duration: Option<u32>,
    pub elapsed_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvanceState {
    pub total_profit: f64,
    pub max_drawdown: f64,
    pub consistency_passed: bool,
    pub days_traded: u32,
    #[serde(default)]
    pub current_equity: f64,
    #[serde(default)]
    pub scaling_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RiskSettings {
    pub risk_per_trade: f64,
    pub risk_percent: f64,
    pub position_size_multiplier: f64,
    pub max_risk_percent: f64,
    pub phase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyLimits {
    pub profit_limit: Option<f64>,
    pub loss_limit: Option<f64>,
    pub consistency_enforced: bool,
    pub phase: String,
}

pub struct PhaseController {
    pub profit_target: f64,
    pub max_drawdown: f64,
    pub starting_equity: f64,
    phases: Vec<InternalPhase>,
    current_phase_index: usize,
    current_profit: f64,
    current_drawdown: f64,
    elapsed_days: u32,
    pub current_phase: String,
    pub phase_start_time: i64,
    pub phase_history: Vec<PhaseHistoryEntry>,
    transitions: Vec<TransitionRecord>,
    transition_conditions: TransitionConfig,
}

#[derive(Debug, Clone)]
pub(crate) struct InternalPhase {
    name: String,
    phase_type: String,
    duration: Option<u32>,
    profit_target: Option<f64>,
    max_drawdown: Option<f64>,
    risk_per_trade: f64,
    position_size_multiplier: f64,
    daily_profit_limit: Option<f64>,
    daily_loss_limit: Option<f64>,
    consistency_enforced: bool,
    can_scale: bool,
}

#[derive(Debug, Clone)]
struct TransitionConfig {
    evaluation_to_funded: Vec<TransitionCondition>,
    funded_to_scaling: Vec<TransitionCondition>,
    evaluation_all_required: bool,
    funded_all_required: bool,
}

impl InternalPhase {
    fn from_config(p: &PhaseConfig, index: usize) -> Self {
        Self {
            name: p.name.clone(),
            phase_type: p.phase_type.clone(),
            duration: p.duration,
            profit_target: p.profit_target,
            max_drawdown: p.max_drawdown,
            risk_per_trade: if index == 0 { 0.005 } else if index == 1 { 0.01 } else { 0.012 },
            position_size_multiplier: 1.0,
            daily_profit_limit: None,
            daily_loss_limit: None,
            consistency_enforced: p.consistency_enforced,
            can_scale: index > 0,
        }
    }
}

impl PhaseController {
    pub fn new(phases: Vec<PhaseConfig>, profit_target: f64, max_drawdown: f64, starting_equity: f64) -> Self {
        let internal_phases: Vec<InternalPhase> = if phases.is_empty() {
            vec![
                InternalPhase { name: "Evaluation".into(), phase_type: "evaluation".into(), duration: Some(30), profit_target: Some(profit_target), max_drawdown: Some(max_drawdown), risk_per_trade: 0.005, position_size_multiplier: 1.0, daily_profit_limit: Some(0.15), daily_loss_limit: None, consistency_enforced: true, can_scale: false },
                InternalPhase { name: "Funded".into(), phase_type: "funded".into(), duration: None, profit_target: None, max_drawdown: Some(max_drawdown), risk_per_trade: 0.01, position_size_multiplier: 1.0, daily_profit_limit: None, daily_loss_limit: Some(0.03), consistency_enforced: false, can_scale: true },
                InternalPhase { name: "Scaling".into(), phase_type: "scaling".into(), duration: None, profit_target: None, max_drawdown: None, risk_per_trade: 0.012, position_size_multiplier: 1.5, daily_profit_limit: None, daily_loss_limit: Some(0.04), consistency_enforced: false, can_scale: true },
            ]
        } else {
            phases.iter().enumerate().map(|(i, p)| InternalPhase::from_config(p, i)).collect()
        };

        let now = Utc::now().timestamp_millis();
        let (first_type, first_name) = internal_phases.first()
            .map(|p| (p.phase_type.clone(), p.name.clone()))
            .unwrap_or_else(|| ("evaluation".to_string(), "Evaluation".to_string()));

        Self {
            profit_target,
            max_drawdown,
            starting_equity,
            phases: internal_phases,
            current_phase_index: 0,
            current_profit: 0.0,
            current_drawdown: 0.0,
            elapsed_days: 0,
            current_phase: Phase::from_type(&first_type).as_str().to_string(),
            phase_start_time: now,
            phase_history: vec![PhaseHistoryEntry {
                phase: first_name,
                start_time: now,
                end_time: None,
                reason: "Initial phase".to_string(),
            }],
            transitions: vec![],
            transition_conditions: TransitionConfig {
                evaluation_to_funded: vec![
                    TransitionCondition { condition_type: "PROFIT_TARGET_MET".into(), description: "Profit target met".into() },
                    TransitionCondition { condition_type: "DRAWDOWN_WITHIN_LIMIT".into(), description: "Drawdown within limit".into() },
                    TransitionCondition { condition_type: "CONSISTENCY_PASSED".into(), description: "Consistency rule passed".into() },
                ],
                funded_to_scaling: vec![
                    TransitionCondition { condition_type: "EQUITY_THRESHOLD_MET".into(), description: "Equity threshold met".into() },
                ],
                evaluation_all_required: true,
                funded_all_required: true,
            },
        }
    }

    pub fn get_current_phase(&self) -> Option<&InternalPhase> {
        self.phases.get(self.current_phase_index)
    }

    pub fn get_phase_progress(&self) -> PhaseProgressInfo {
        let phase = match self.get_current_phase() {
            Some(p) => p,
            None => return PhaseProgressInfo {
                phase_name: "Unknown".to_string(),
                phase_type: "unknown".to_string(),
                current_phase_index: 0,
                total_phases: self.phases.len(),
                profit_target: None,
                current_profit: self.current_profit,
                profit_percent: 0.0,
                max_drawdown: None,
                current_drawdown: self.current_drawdown,
                drawdown_percent: 0.0,
                duration: None,
                elapsed_days: self.elapsed_days,
            },
        };

        let profit_percent = phase.profit_target
            .map(|t| (self.current_profit / t * 100.0).clamp(0.0, 100.0))
            .unwrap_or(100.0);

        let drawdown_percent = phase.max_drawdown
            .map(|dd| if dd > 0.0 { self.current_drawdown / dd * 100.0 } else { 0.0 })
            .unwrap_or(0.0);

        PhaseProgressInfo {
            phase_name: phase.name.clone(),
            phase_type: phase.phase_type.clone(),
            current_phase_index: self.current_phase_index,
            total_phases: self.phases.len(),
            profit_target: phase.profit_target,
            current_profit: self.current_profit,
            profit_percent,
            max_drawdown: phase.max_drawdown,
            current_drawdown: self.current_drawdown,
            drawdown_percent,
            duration: phase.duration,
            elapsed_days: self.elapsed_days,
        }
    }

    pub fn advance_phase(&mut self, state: &AdvanceState) -> PhaseAdvanceResult {
        let current_phase = match self.get_current_phase() {
            Some(p) => p.clone(),
            None => return PhaseAdvanceResult {
                success: false,
                reason: "No current phase".to_string(),
                previous_phase: None,
                new_phase: None,
                failed_conditions: vec![],
                new_settings: None,
            },
        };

        let next_index = self.current_phase_index + 1;
        if next_index >= self.phases.len() {
            return PhaseAdvanceResult {
                success: false,
                reason: "Already at final phase".to_string(),
                previous_phase: Some(current_phase.name.clone()),
                new_phase: None,
                failed_conditions: vec![],
                new_settings: None,
            };
        }

        let mut failed: Vec<String> = vec![];

        if let Some(pt) = current_phase.profit_target {
            if pt > 0.0 && state.total_profit < pt {
                failed.push("PROFIT_TARGET_MET".to_string());
            }
        }

        if let Some(dd) = current_phase.max_drawdown {
            if dd > 0.0 && state.max_drawdown > dd {
                failed.push("DRAWDOWN_WITHIN_LIMIT".to_string());
            }
        }

        if current_phase.consistency_enforced && !state.consistency_passed {
            failed.push("CONSISTENCY_PASSED".to_string());
        }

        if !failed.is_empty() {
            return PhaseAdvanceResult {
                success: false,
                reason: "Phase conditions not met".to_string(),
                previous_phase: Some(current_phase.name.clone()),
                new_phase: None,
                failed_conditions: failed,
                new_settings: None,
            };
        }

        let now = Utc::now().timestamp_millis();
        let next_phase = self.phases[next_index].clone();
        let transition = TransitionRecord {
            from: current_phase.name.clone(),
            to: next_phase.name.clone(),
            from_type: current_phase.phase_type.clone(),
            to_type: next_phase.phase_type.clone(),
            timestamp: now,
            reason: "Phase target met".to_string(),
            state: Some(serde_json::to_value(state).unwrap_or_default()),
        };
        self.transitions.push(transition);

        if let Some(last) = self.phase_history.last_mut() {
            last.end_time = Some(now);
        }

        let prev_name = current_phase.name.clone();
        self.current_phase_index = next_index;
        self.current_phase = Phase::from_type(&next_phase.phase_type).as_str().to_string();
        self.phase_start_time = now;
        self.current_profit = 0.0;
        self.current_drawdown = 0.0;
        self.elapsed_days = 0;

        self.phase_history.push(PhaseHistoryEntry {
            phase: next_phase.name.clone(),
            start_time: now,
            end_time: None,
            reason: "Phase target met".to_string(),
        });

        PhaseAdvanceResult {
            success: true,
            reason: "Phase advanced".to_string(),
            previous_phase: Some(prev_name),
            new_phase: Some(next_phase.name.clone()),
            failed_conditions: vec![],
            new_settings: Some(self.get_current_phase_settings()),
        }
    }

    pub fn update_state(&mut self, total_profit: f64, max_drawdown: f64, elapsed_days: u32) {
        self.current_profit = total_profit;
        self.current_drawdown = max_drawdown;
        self.elapsed_days = elapsed_days;
    }

    pub fn get_current_phase_settings(&self) -> PhaseSettings {
        let phase = self.get_current_phase();
        match phase {
            Some(p) => PhaseSettings {
                phase: self.current_phase.clone(),
                name: p.name.clone(),
                phase_type: p.phase_type.clone(),
                risk_per_trade: p.risk_per_trade,
                position_size_multiplier: p.position_size_multiplier,
                daily_profit_limit: p.daily_profit_limit,
                daily_loss_limit: p.daily_loss_limit,
                consistency_enforced: p.consistency_enforced,
                can_scale: p.can_scale,
                profit_target: p.profit_target.or_else(|| {
                    if Phase::from_type(&p.phase_type).is_evaluation_like() { Some(self.profit_target) } else { None }
                }),
                max_drawdown: p.max_drawdown.or(Some(self.max_drawdown)),
                duration: p.duration,
            },
            None => PhaseSettings {
                phase: self.current_phase.clone(),
                name: "Unknown".to_string(),
                phase_type: "unknown".to_string(),
                risk_per_trade: 0.005,
                position_size_multiplier: 1.0,
                daily_profit_limit: None,
                daily_loss_limit: None,
                consistency_enforced: false,
                can_scale: false,
                profit_target: None,
                max_drawdown: None,
                duration: None,
            },
        }
    }

    pub fn check_transition(&self, state: &AdvanceState) -> TransitionResult {
        let transition_key = self.get_transition_key();
        let (conditions, all_required) = match transition_key {
            Some("evaluationToFunded") => (&self.transition_conditions.evaluation_to_funded, self.transition_conditions.evaluation_all_required),
            Some("fundedToScaling") => (&self.transition_conditions.funded_to_scaling, self.transition_conditions.funded_all_required),
            _ => return TransitionResult {
                can_transition: false,
                current_phase: self.current_phase.clone(),
                target_phase: self.get_next_phase_name(),
                conditions: vec![],
                reason: "No transition available from current phase".to_string(),
                failed_conditions: vec![],
            },
        };

        let results: Vec<ConditionResult> = conditions.iter().map(|c| {
            let passed = match c.condition_type.as_str() {
                "PROFIT_TARGET_MET" => state.total_profit >= self.profit_target,
                "DRAWDOWN_WITHIN_LIMIT" => state.max_drawdown <= self.max_drawdown,
                "CONSISTENCY_PASSED" => state.consistency_passed,
                "MIN_DAYS_MET" => true,
                "EQUITY_THRESHOLD_MET" => state.current_equity >= state.scaling_threshold,
                _ => true,
            };
            ConditionResult { condition_type: c.condition_type.clone(), passed }
        }).collect();

        let all_passed = results.iter().all(|r| r.passed);
        let can = if all_required { all_passed } else { results.iter().any(|r| r.passed) };
        let failed: Vec<String> = results.iter().filter(|r| !r.passed).map(|r| r.condition_type.clone()).collect();

        TransitionResult {
            can_transition: can,
            current_phase: self.current_phase.clone(),
            target_phase: self.get_next_phase_name(),
            conditions: results,
            reason: if can { "All conditions met".to_string() } else { "Conditions not met".to_string() },
            failed_conditions: failed,
        }
    }

    fn get_transition_key(&self) -> Option<&'static str> {
        let phase_type = self.get_current_phase().map(|p| p.phase_type.as_str())?;
        match phase_type {
            "evaluation" | "challenge" | "combine" | "verification" => Some("evaluationToFunded"),
            "funded" => Some("fundedToScaling"),
            _ => None,
        }
    }

    fn get_next_phase_name(&self) -> Option<String> {
        let next_idx = self.current_phase_index + 1;
        self.phases.get(next_idx).map(|p| p.name.clone())
    }

    pub fn get_risk_settings(&self, account_equity: f64) -> RiskSettings {
        let settings = self.get_current_phase_settings();
        let risk_dollars = (account_equity * settings.risk_per_trade).floor();
        RiskSettings {
            risk_per_trade: risk_dollars,
            risk_percent: settings.risk_per_trade,
            position_size_multiplier: settings.position_size_multiplier,
            max_risk_percent: settings.risk_per_trade * 2.0,
            phase: self.current_phase.clone(),
        }
    }

    pub fn get_daily_limits(&self) -> DailyLimits {
        let settings = self.get_current_phase_settings();
        DailyLimits {
            profit_limit: settings.daily_profit_limit.map(|p| self.profit_target * p),
            loss_limit: settings.daily_loss_limit.map(|l| self.starting_equity * l),
            consistency_enforced: settings.consistency_enforced,
            phase: self.current_phase.clone(),
        }
    }

    pub fn is_evaluation(&self) -> bool {
        self.get_current_phase().map(|p| Phase::from_type(&p.phase_type).is_evaluation_like()).unwrap_or(true)
    }

    pub fn is_funded(&self) -> bool {
        self.get_current_phase().map(|p| p.phase_type == "funded").unwrap_or(false)
    }

    pub fn is_scaling(&self) -> bool {
        self.get_current_phase().map(|p| p.phase_type == "scaling").unwrap_or(false)
    }

    pub fn get_status(&self) -> serde_json::Value {
        serde_json::json!({
            "current_phase": self.current_phase,
            "phase_start_time": self.phase_start_time,
            "profit_target": self.profit_target,
            "max_drawdown": self.max_drawdown,
            "starting_equity": self.starting_equity,
            "settings": self.get_current_phase_settings(),
            "transitions": self.transitions.len(),
            "is_evaluation": self.is_evaluation(),
            "is_funded": self.is_funded(),
            "is_scaling": self.is_scaling()
        })
    }

    pub fn reset(&mut self, phases: Vec<PhaseConfig>, profit_target: Option<f64>, max_drawdown: Option<f64>, starting_equity: Option<f64>) {
        if let Some(pt) = profit_target { self.profit_target = pt; }
        if let Some(dd) = max_drawdown { self.max_drawdown = dd; }
        if let Some(se) = starting_equity { self.starting_equity = se; }

        if !phases.is_empty() {
            self.phases = phases.iter().enumerate().map(|(i, p)| InternalPhase::from_config(p, i)).collect();
        }

        self.current_phase_index = 0;
        self.current_profit = 0.0;
        self.current_drawdown = 0.0;
        self.elapsed_days = 0;
        let first_type = self.phases.first().map(|p| p.phase_type.as_str()).unwrap_or("evaluation");
        let first_name = self.phases.first().map(|p| p.name.as_str()).unwrap_or("Evaluation");
        self.current_phase = Phase::from_type(first_type).as_str().to_string();
        self.phase_start_time = Utc::now().timestamp_millis();
        self.phase_history = vec![PhaseHistoryEntry {
            phase: first_name.to_string(),
            start_time: self.phase_start_time,
            end_time: None,
            reason: "Reset".to_string(),
        }];
        self.transitions = vec![];
    }

    pub fn export(&self) -> serde_json::Value {
        serde_json::json!({
            "current_phase": self.current_phase,
            "phase_start_time": self.phase_start_time,
            "profit_target": self.profit_target,
            "max_drawdown": self.max_drawdown,
            "starting_equity": self.starting_equity,
            "phase_history": self.phase_history,
            "transitions": self.transitions,
            "current_phase_index": self.current_phase_index,
            "current_profit": self.current_profit,
            "current_drawdown": self.current_drawdown,
            "elapsed_days": self.elapsed_days
        })
    }
}