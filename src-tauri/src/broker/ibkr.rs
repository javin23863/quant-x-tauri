use crate::broker::{BrokerAdapter, BrokerError, OrderRequest, OrderResult, Position, AccountInfo};
use crate::broker::env;

pub struct IbkrAdapter {
    _host: String,
    _port: u16,
    _client_id: u32,
    _paper: bool,
}

impl IbkrAdapter {
    pub fn new() -> Self {
        let (host, port, client_id, paper) = env::load_ibkr_config();
        Self { _host: host, _port: port, _client_id: client_id, _paper: paper }
    }
}

impl BrokerAdapter for IbkrAdapter {
    fn submit_order(&self, _order: OrderRequest) -> Result<OrderResult, BrokerError> { Err(BrokerError::NotImplemented) }
    fn cancel_order(&self, _order_id: &str) -> Result<bool, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_position(&self, _symbol: &str) -> Result<Option<Position>, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_positions(&self) -> Result<Vec<Position>, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_account(&self) -> Result<AccountInfo, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_equity(&self) -> Result<f64, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_cash(&self) -> Result<f64, BrokerError> { Err(BrokerError::NotImplemented) }
    fn get_buying_power(&self) -> Result<f64, BrokerError> { Err(BrokerError::NotImplemented) }
    fn is_live(&self) -> bool { false }
    fn name(&self) -> &str { "IBKR" }
}