pub mod broker;
pub mod commands;
pub mod db;
pub mod ws;
pub mod data;
pub mod prop_firm;
pub mod tray;

use std::sync::Arc;
use tokio::sync::RwLock;

use commands::broker::{ActiveBroker, KillSwitchState as BrokerKillSwitch};
use commands::kill_switch::{KillSwitchRef, KillSwitchState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let active_broker: ActiveBroker = Arc::new(RwLock::new(None));
    let broker_kill_switch: BrokerKillSwitch = Arc::new(RwLock::new(false));
    let kill_switch_state: KillSwitchRef = Arc::new(RwLock::new(KillSwitchState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(active_broker)
        .manage(broker_kill_switch)
        .manage(kill_switch_state)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            db::init_db(&app_handle)?;

            dotenv::dotenv().ok();

            tray::create_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::broker::get_connection_status,
            commands::broker::place_order,
            commands::broker::cancel_order,
            commands::broker::get_positions,
            commands::broker::get_orders,
            commands::broker::get_account,
            commands::broker::start_trading,
            commands::broker::stop_trading,
            commands::broker::switch_broker,
            commands::broker::activate_kill_switch,
            commands::broker::deactivate_kill_switch,
            commands::broker::get_equity,
            commands::broker::get_buying_power,
            commands::broker::check_pdt_status,
            commands::db::get_positions_db,
            commands::db::save_position,
            commands::db::clear_positions,
            commands::db::save_order,
            commands::db::get_orders_db,
            commands::db::update_order_status,
            commands::db::get_trade_history,
            commands::db::save_trade,
            commands::db::get_bars,
            commands::db::save_bars,
            commands::db::save_config,
            commands::db::load_config,
            commands::db::get_kill_switch_state,
            commands::db::activate_kill_switch_db,
            commands::db::deactivate_kill_switch_db,
            commands::market_data::subscribe_bars,
            commands::market_data::unsubscribe_bars,
            commands::market_data::get_historical_bars,
            commands::market_data::get_market_status,
            commands::kill_switch::get_kill_switch,
            commands::kill_switch::activate_kill_switch_cmd,
            commands::kill_switch::deactivate_kill_switch_cmd,
            commands::prop_firm::get_prop_firm_presets,
            commands::prop_firm::load_prop_firm_preset,
            commands::prop_firm::fetch_rules_from_url,
            commands::prop_firm::check_drawdown,
            commands::prop_firm::check_flatten_required,
            commands::prop_firm::check_consistency,
            commands::prop_firm::advance_phase,
            commands::prop_firm::get_phase_progress,
            commands::prop_firm::create_trailing_drawdown,
            commands::prop_firm::update_trailing_drawdown,
            commands::prop_firm::create_phase_controller,
            commands::prop_firm::check_risk_adapter,
            commands::prop_firm::check_safety_adapter,
            commands::prop_firm::get_broker_restrictions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Quant X");
}