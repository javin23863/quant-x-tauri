use crate::broker::{BrokerAdapter, BrokerError, OrderRequest, OrderResult, Position, AccountInfo};
use crate::broker::env;

pub struct TradeStationAdapter {
    _api_key: String,
    _secret: String,
    _env: String,
}

impl TradeStationAdapter {
    pub fn new() -> Self {
        let (api_key, secret, env) = env::load_tradestation_config();
        Self { _api_key: api_key, _secret: secret, _env: env }
    }
}

impl BrokerAdapter for TradeStationAdapter {
    fn submit_order(&self, _order: OrderRequest) -> Result<OrderResult, BrokerError> { Err(BrokerError::NotImplemented) }
    fn cancel_order(&self, _order_id: &str) -> Result<bool, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_position(&self, _symbol: &str) -> Result<Option<Position>, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_positions(&self) -> Result<Vec<Position>, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_account(&self) -> Result<AccountInfo, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_equity(&self) -> Result<f64, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_cash(&self) -> Result<f64, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_buying_power(&self) -> Result<f64, BrokerError> { Err(BrokerError::NotImplemented) }
    fn is_live(&self) -> bool { false }
    fn name(&self) -> &str { "TradeStation" }
}