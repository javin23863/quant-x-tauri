use chrono::{Utc, FixedOffset};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DrawdownMode {
    Continuous,
    Eod,
    Balance,
}

impl Default for DrawdownMode {
    fn default() -> Self { DrawdownMode::Continuous }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawdownHistoryEntry {
    pub timestamp: i64,
    pub equity: f64,
    pub high_water_mark: f64,
    pub trailing_limit: f64,
    pub drawdown: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrailingDrawdown {
    pub max_drawdown: f64,
    pub starting_equity: f64,
    pub soft_stop_percent: f64,
    pub mode: DrawdownMode,
    pub timezone: String,
    pub equity_high: f64,
    pub trailing_limit: f64,
    pub current_equity: f64,
    pub current_drawdown: f64,
    pub peak_equity: f64,
    pub valley_equity: f64,
    pub starting_balance: f64,
    pub last_eod_date: Option<String>,
    pub history: Vec<DrawdownHistoryEntry>,
}

impl TrailingDrawdown {
    pub fn new(max_drawdown: f64, starting_equity: f64) -> Self {
        let starting_balance = starting_equity;
        let equity_high = starting_equity;
        let trailing_limit = starting_equity - max_drawdown;
        let now = Utc::now().timestamp_millis();
        Self {
            max_drawdown,
            starting_equity,
            soft_stop_percent: 0.70,
            mode: DrawdownMode::Continuous,
            timezone: "America/New_York".to_string(),
            equity_high,
            trailing_limit,
            current_equity: starting_equity,
            current_drawdown: 0.0,
            peak_equity: starting_equity,
            valley_equity: starting_equity,
            starting_balance,
            last_eod_date: None,
            history: vec![DrawdownHistoryEntry {
                timestamp: now,
                equity: starting_equity,
                high_water_mark: equity_high,
                trailing_limit,
                drawdown: 0.0,
            }],
        }
    }

    pub fn with_mode(mut self, mode: DrawdownMode) -> Self {
        self.mode = mode;
        match &self.mode {
            DrawdownMode::Balance => {
                self.equity_high = self.starting_balance;
                self.trailing_limit = self.starting_balance - self.max_drawdown;
            }
            _ => {
                self.equity_high = self.starting_equity;
                self.trailing_limit = self.starting_equity - self.max_drawdown;
            }
        }
        self
    }

    pub fn with_soft_stop(mut self, percent: f64) -> Self {
        self.soft_stop_percent = percent;
        self
    }

    pub fn with_timezone(mut self, tz: &str) -> Self {
        self.timezone = tz.to_string();
        self
    }

    fn get_today_in_timezone(&self) -> String {
        let offset = match self.timezone.as_str() {
            "America/New_York" => FixedOffset::west_opt(5 * 3600).unwrap(),
            "America/Chicago" => FixedOffset::west_opt(6 * 3600).unwrap(),
            "America/Denver" => FixedOffset::west_opt(7 * 3600).unwrap(),
            "America/Los_Angeles" => FixedOffset::west_opt(8 * 3600).unwrap(),
            "Europe/London" => FixedOffset::east_opt(0).unwrap(),
            "Europe/Berlin" => FixedOffset::east_opt(3600).unwrap(),
            "Asia/Tokyo" => FixedOffset::east_opt(9 * 3600).unwrap(),
            "Asia/Hong_Kong" => FixedOffset::east_opt(8 * 3600).unwrap(),
            "Australia/Sydney" => FixedOffset::east_opt(11 * 3600).unwrap(),
            _ => FixedOffset::west_opt(5 * 3600).unwrap(),
        };
        let now = Utc::now().with_timezone(&offset);
        now.format("%Y-%m-%d").to_string()
    }

    fn update_peak_valley(&mut self, equity: f64) {
        if equity > self.peak_equity {
            self.peak_equity = equity;
        }
        if equity < self.valley_equity {
            self.valley_equity = equity;
        }
    }

    pub fn update(&mut self, equity: f64) -> DrawdownStatus {
        self.current_equity = equity;

        match &self.mode {
            DrawdownMode::Balance => {
                self.equity_high = self.starting_balance;
                self.trailing_limit = self.starting_balance - self.max_drawdown;
            }
            DrawdownMode::Eod => {
                let today_str = self.get_today_in_timezone();
                if self.last_eod_date.as_ref() != Some(&today_str) {
                    if self.last_eod_date.is_some() {
                        self.equity_high = self.equity_high.max(self.peak_equity);
                        self.trailing_limit = self.equity_high - self.max_drawdown;
                    }
                    self.last_eod_date = Some(today_str);
                }
            }
            DrawdownMode::Continuous => {
                if equity > self.equity_high {
                    self.equity_high = equity;
                    self.trailing_limit = self.equity_high - self.max_drawdown;
                }
            }
        }

        self.update_peak_valley(equity);
        self.current_drawdown = self.equity_high - equity;

        let buffer = equity - self.trailing_limit;
        let buffer_percent = if self.max_drawdown > 0.0 { buffer / self.max_drawdown } else { 0.0 };
        let breached = equity <= self.trailing_limit;
        let in_buffer_zone = buffer_percent < (1.0 - self.soft_stop_percent);

        let entry = DrawdownHistoryEntry {
            timestamp: Utc::now().timestamp_millis(),
            equity,
            high_water_mark: self.equity_high,
            trailing_limit: self.trailing_limit,
            drawdown: self.current_drawdown,
        };
        self.history.push(entry);

        DrawdownStatus {
            equity,
            equity_high: self.equity_high,
            current_drawdown: self.current_drawdown,
            trailing_limit: self.trailing_limit,
            buffer,
            buffer_percent,
            breached,
            in_buffer_zone,
            buffer_zone_percent: buffer_percent,
        }
    }

    pub fn force_eod_reset(&mut self, equity: f64) {
        self.equity_high = self.equity_high.max(equity);
        self.trailing_limit = self.equity_high - self.max_drawdown;
        self.current_drawdown = self.equity_high - self.current_equity;
    }

    pub fn get_soft_stop(&self) -> SoftStopInfo {
        let soft_stop_equity = self.equity_high - (self.max_drawdown * self.soft_stop_percent);
        let hard_stop_equity = self.trailing_limit;
        SoftStopInfo {
            soft_stop_equity,
            hard_stop_equity,
            soft_stop_percent: self.soft_stop_percent,
            distance_to_soft_stop: self.current_equity - soft_stop_equity,
            distance_to_hard_stop: self.current_equity - hard_stop_equity,
            recommended_action: self.get_recommended_action(),
        }
    }

    fn get_recommended_action(&self) -> &'static str {
        let buffer_percent = if self.current_equity > self.trailing_limit && self.max_drawdown > 0.0 {
            (self.current_equity - self.trailing_limit) / self.max_drawdown
        } else {
            0.0
        };

        if buffer_percent <= 0.0 {
            "HALT"
        } else if buffer_percent < 0.20 {
            "CRITICAL"
        } else if buffer_percent < 0.30 {
            "REDUCE_SIZE"
        } else if buffer_percent < 0.50 {
            "CAUTION"
        } else {
            "NORMAL"
        }
    }

    pub fn get_size_multiplier(&self) -> SizeRecommendation {
        let buffer_percent = if self.max_drawdown > 0.0 {
            (self.current_equity - self.trailing_limit) / self.max_drawdown
        } else {
            1.0
        };

        if buffer_percent <= 0.0 {
            return SizeRecommendation {
                multiplier: 0.0,
                action: "HALT".to_string(),
                buffer_percent,
                reason: "Drawdown breach - stop trading".to_string(),
            };
        }

        let multiplier = (buffer_percent / 0.50).min(1.0).max(0.10);
        let action = self.get_recommended_action();

        SizeRecommendation {
            multiplier,
            action: action.to_string(),
            buffer_percent,
            reason: format!("Buffer at {:.1}% - {}", buffer_percent * 100.0, action.to_lowercase().replace('_', " ")),
        }
    }

    pub fn should_halt(&self) -> HaltStatus {
        let breached = self.current_equity <= self.trailing_limit;
        let buffer_percent = if self.max_drawdown > 0.0 {
            (self.current_equity - self.trailing_limit) / self.max_drawdown
        } else {
            1.0
        };

        HaltStatus {
            halt: breached,
            reason: if breached { Some("Drawdown breach - below trailing limit".to_string()) } else { None },
            buffer_percent,
            equity: self.current_equity,
            trailing_limit: self.trailing_limit,
        }
    }

    pub fn get_stats(&self) -> DrawdownStats {
        if self.history.is_empty() {
            return DrawdownStats { empty: true, ..Default::default() };
        }

        let drawdowns: Vec<f64> = self.history.iter().map(|h| h.drawdown).collect();
        let max_dd = drawdowns.iter().cloned().fold(0.0_f64, f64::max);
        let avg_dd = drawdowns.iter().sum::<f64>() / drawdowns.len() as f64;

        let time_in_buffer = self.history.iter().filter(|h| {
            let pct = if self.max_drawdown > 0.0 {
                (h.equity - h.trailing_limit) / self.max_drawdown
            } else {
                1.0
            };
            pct < (1.0 - self.soft_stop_percent)
        }).count();

        let buffer_pct = if self.max_drawdown > 0.0 {
            (self.current_equity - self.trailing_limit) / self.max_drawdown
        } else {
            1.0
        };

        DrawdownStats {
            empty: false,
            current_drawdown: self.current_drawdown,
            max_drawdown: max_dd,
            avg_drawdown: avg_dd,
            peak_equity: self.peak_equity,
            valley_equity: self.valley_equity,
            equity_high: self.equity_high,
            trailing_limit: self.trailing_limit,
            current_buffer: self.current_equity - self.trailing_limit,
            buffer_percent: buffer_pct,
            time_in_buffer_zone: if !self.history.is_empty() { time_in_buffer as f64 / self.history.len() as f64 } else { 0.0 },
            history_length: self.history.len(),
            mode: format!("{:?}", self.mode).to_lowercase(),
            timezone: self.timezone.clone(),
            last_eod_date: self.last_eod_date.clone(),
        }
    }

    pub fn reset(&mut self, starting_equity: Option<f64>) {
        if let Some(se) = starting_equity {
            self.starting_equity = se;
        }
        self.starting_balance = match &self.mode {
            DrawdownMode::Balance => self.starting_balance,
            _ => self.starting_equity,
        };
        match &self.mode {
            DrawdownMode::Balance => {
                self.equity_high = self.starting_balance;
                self.trailing_limit = self.starting_balance - self.max_drawdown;
            }
            _ => {
                self.equity_high = self.starting_equity;
                self.trailing_limit = self.starting_equity - self.max_drawdown;
            }
        }
        self.current_equity = self.starting_equity;
        self.current_drawdown = 0.0;
        self.peak_equity = self.starting_equity;
        self.valley_equity = self.starting_equity;
        self.last_eod_date = None;
        self.history = vec![DrawdownHistoryEntry {
            timestamp: Utc::now().timestamp_millis(),
            equity: self.starting_equity,
            high_water_mark: self.equity_high,
            trailing_limit: self.trailing_limit,
            drawdown: 0.0,
        }];
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawdownStatus {
    pub equity: f64,
    pub equity_high: f64,
    pub current_drawdown: f64,
    pub trailing_limit: f64,
    pub buffer: f64,
    pub buffer_percent: f64,
    pub breached: bool,
    pub in_buffer_zone: bool,
    pub buffer_zone_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftStopInfo {
    pub soft_stop_equity: f64,
    pub hard_stop_equity: f64,
    pub soft_stop_percent: f64,
    pub distance_to_soft_stop: f64,
    pub distance_to_hard_stop: f64,
    pub recommended_action: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeRecommendation {
    pub multiplier: f64,
    pub action: String,
    pub buffer_percent: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HaltStatus {
    pub halt: bool,
    pub reason: Option<String>,
    pub buffer_percent: f64,
    pub equity: f64,
    pub trailing_limit: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DrawdownStats {
    pub empty: bool,
    #[serde(default)]
    pub current_drawdown: f64,
    #[serde(default)]
    pub max_drawdown: f64,
    #[serde(default)]
    pub avg_drawdown: f64,
    #[serde(default)]
    pub peak_equity: f64,
    #[serde(default)]
    pub valley_equity: f64,
    #[serde(default)]
    pub equity_high: f64,
    #[serde(default)]
    pub trailing_limit: f64,
    #[serde(default)]
    pub current_buffer: f64,
    #[serde(default)]
    pub buffer_percent: f64,
    #[serde(default)]
    pub time_in_buffer_zone: f64,
    #[serde(default)]
    pub history_length: usize,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub timezone: String,
    #[serde(default)]
    pub last_eod_date: Option<String>,
}