use crate::broker::BrokerType;
use crate::prop_firm::{PropFirmConfig, PropFirmPreset, PropFirmRuleProvider, PropFirmRules, RuleSource};
use std::collections::HashMap;
use std::time::Duration;

pub trait RuleSourceTrait: Send + Sync {
    fn fetch_rules(&self, provider: &str) -> Result<PropFirmPreset, String>;
    fn source_name(&self) -> &str;
}

#[derive(Debug, Clone)]
pub struct CachedRules {
    pub preset: PropFirmPreset,
    pub fetched_at_secs: u64,
    pub source: String,
}

pub struct HttpRuleFetcher {
    client: reqwest::Client,
    cache_ttl: Duration,
}

impl HttpRuleFetcher {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
            cache_ttl: Duration::from_secs(3600),
        }
    }

    pub fn with_ttl(mut self, ttl: Duration) -> Self {
        self.cache_ttl = ttl;
        self
    }

    pub async fn fetch_rules_from_url(&self, url: &str) -> Result<PropFirmPreset, String> {
        let response = self.client.get(url)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        let preset: PropFirmPreset = response.json()
            .await
            .map_err(|e| format!("Failed to parse rules JSON: {}", e))?;

        Ok(preset)
    }
}

impl RuleSourceTrait for HttpRuleFetcher {
    fn fetch_rules(&self, provider: &str) -> Result<PropFirmPreset, String> {
        let url = format!("https://rules.quantx.live/api/v1/presets/{}", provider);
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async {
            self.fetch_rules_from_url(&url).await
        })
    }

    fn source_name(&self) -> &str { "http" }
}

pub struct LocalRuleFetcher {
    rules_db: HashMap<String, PropFirmPreset>,
}

impl LocalRuleFetcher {
    pub fn new() -> Self {
        Self {
            rules_db: HashMap::new(),
        }
    }

    pub fn insert(&mut self, key: &str, preset: PropFirmPreset) {
        self.rules_db.insert(key.to_lowercase(), preset);
    }

    pub fn load_from_sqlite(conn: &rusqlite::Connection) -> Result<Self, String> {
        let mut fetcher = Self::new();
        let mut stmt = conn.prepare("SELECT key, value FROM prop_firm_rules")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        }).map_err(|e| format!("Failed to query rules: {}", e))?;

        for row in rows {
            let (key, value) = row.map_err(|e| format!("Row error: {}", e))?;
            let preset: PropFirmPreset = serde_json::from_str(&value)
                .map_err(|e| format!("Failed to parse rule for key {}: {}", key, e))?;
            fetcher.rules_db.insert(key.to_lowercase(), preset);
        }

        Ok(fetcher)
    }
}

impl RuleSourceTrait for LocalRuleFetcher {
    fn fetch_rules(&self, provider: &str) -> Result<PropFirmPreset, String> {
        self.rules_db.get(&provider.to_lowercase())
            .cloned()
            .ok_or_else(|| format!("Provider '{}' not found in local rules", provider))
    }

    fn source_name(&self) -> &str { "local" }
}

pub struct CombinedRuleFetcher {
    local: LocalRuleFetcher,
    http: HttpRuleFetcher,
    cache: HashMap<String, CachedRules>,
    cache_ttl: Duration,
}

impl CombinedRuleFetcher {
    pub fn new() -> Self {
        Self {
            local: LocalRuleFetcher::new(),
            http: HttpRuleFetcher::new(),
            cache: HashMap::new(),
            cache_ttl: Duration::from_secs(3600),
        }
    }

    pub fn with_local(mut self, local: LocalRuleFetcher) -> Self {
        self.local = local;
        self
    }

    pub fn with_cache_ttl(mut self, ttl: Duration) -> Self {
        self.cache_ttl = ttl;
        self
    }

    pub fn fetch_rules(&mut self, provider: &str) -> Result<(PropFirmPreset, RuleSource), String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        if let Some(cached) = self.cache.get(&provider.to_lowercase()) {
            if (now - cached.fetched_at_secs) < self.cache_ttl.as_secs() {
                let source = RuleSource::Combined;
                return Ok((cached.preset.clone(), source));
            }
        }

        if let Ok(preset) = self.local.fetch_rules(provider) {
            self.cache.insert(provider.to_lowercase(), CachedRules {
                preset: preset.clone(),
                fetched_at_secs: now,
                source: "local".to_string(),
            });
            return Ok((preset, RuleSource::LocalDb));
        }

        let rt = tokio::runtime::Handle::current();
        let result = rt.block_on(async {
            self.http.fetch_rules_from_url(&format!("https://rules.quantx.live/api/v1/presets/{}", provider)).await
        });

        match result {
            Ok(preset) => {
                self.cache.insert(provider.to_lowercase(), CachedRules {
                    preset: preset.clone(),
                    fetched_at_secs: now,
                    source: "http".to_string(),
                });
                Ok((preset, RuleSource::RemoteUrl(format!("https://rules.quantx.live/api/v1/presets/{}", provider))))
            }
            Err(e) => Err(format!("Failed to fetch rules from any source: {}", e)),
        }
    }
}

pub fn get_broker_restrictions(broker: &BrokerType) -> Vec<String> {
    match broker {
        BrokerType::AlpacaPaper | BrokerType::AlpacaLive => vec![
            "NO_SHORTING_LOW_FLOAT".to_string(),
            "PDT_RULE_APPLIES".to_string(),
        ],
        BrokerType::IBKR => vec![
            "REQUIRES_MARGIN".to_string(),
            "PDT_RULE_APPLIES".to_string(),
        ],
        BrokerType::Schwab => vec![
            "PDT_RULE_APPLIES".to_string(),
            "REQUIRES_MARGIN".to_string(),
        ],
        BrokerType::TastyTrade => vec![
            "OPTIONS_ALLOWED".to_string(),
        ],
        BrokerType::TradeStation => vec![
            "PDT_RULE_APPLIES".to_string(),
        ],
        BrokerType::ETrade => vec![
            "PDT_RULE_APPLIES".to_string(),
        ],
        BrokerType::Paper | BrokerType::TradingView => vec![],
    }
}

pub fn build_rules_with_broker_restrictions(
    preset: &PropFirmPreset,
    broker: &BrokerType,
) -> PropFirmRules {
    let restrictions = get_broker_restrictions(broker);
    let broker_key = format!("{:?}", broker);
    let mut broker_map: HashMap<String, Vec<String>> = HashMap::new();
    broker_map.insert(broker_key, restrictions);

    PropFirmRules {
        preset: preset.clone(),
        source: RuleSource::BuiltIn,
        fetched_at: Some(chrono::Utc::now().to_rfc3339()),
        expires_at: None,
        broker_restrictions: broker_map,
    }
}

pub async fn fetch_rules_from_url(url: &str) -> Result<PropFirmConfig, String> {
    let fetcher = HttpRuleFetcher::new();
    let preset = fetcher.fetch_rules_from_url(url).await?;
    let provider = PresetProvider { preset: preset.clone() };
    Ok(provider.config())
}

struct PresetProvider {
    preset: PropFirmPreset,
}

impl PropFirmRuleProvider for PresetProvider {
    fn name(&self) -> &str { &self.preset.provider }
    fn preset(&self) -> PropFirmPreset { self.preset.clone() }
}