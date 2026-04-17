use thiserror::Error;

#[derive(Error, Debug)]
pub enum BrokerError {
    #[error("Not implemented for this broker")]
    NotImplemented,

    #[error("Authentication failed: {0}")]
    Authentication(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Network error: {0}")]
    Network(String),

    #[error("Order rejected: {0}")]
    OrderRejected(String),

    #[error("Order not found: {0}")]
    OrderNotFound(String),

    #[error("Invalid order: {0}")]
    InvalidOrder(String),

    #[error("Position not found: {0}")]
    PositionNotFound(String),

    #[error("Account error: {0}")]
    AccountError(String),

    #[error("Kill switch active: {0}")]
    KillSwitchActive(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("JSON parse error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Database error: {0}")]
    DbError(String),

    #[error("Retry exhausted: {0}")]
    RetryExhausted(String),

    #[error("PDT restricted: {0}")]
    PdtRestricted(String),

    #[error("Fill pending: order {0} accepted but not yet filled")]
    FillPending(String),

    #[error("Market closed")]
    MarketClosed,

    #[error("No position for symbol: {0}")]
    NoPosition(String),
}

impl From<BrokerError> for String {
    fn from(e: BrokerError) -> String {
        e.to_string()
    }
}