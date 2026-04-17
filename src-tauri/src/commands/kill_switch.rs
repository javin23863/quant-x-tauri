use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

pub type KillSwitchRef = Arc<RwLock<KillSwitchState>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillSwitchState {
    pub active: bool,
    pub reason: Option<String>,
    pub activated_at: Option<String>,
    pub deactivated_at: Option<String>,
}

impl Default for KillSwitchState {
    fn default() -> Self {
        Self {
            active: false,
            reason: None,
            activated_at: None,
            deactivated_at: None,
        }
    }
}

#[tauri::command]
pub async fn get_kill_switch(state: tauri::State<'_, KillSwitchRef>) -> Result<serde_json::Value, String> {
    let guard = state.read().await;
    Ok(serde_json::to_value(&*guard).unwrap_or_default())
}

#[tauri::command]
pub async fn activate_kill_switch_cmd(state: tauri::State<'_, KillSwitchRef>, reason: Option<String>) -> Result<serde_json::Value, String> {
    let mut guard = state.write().await;
    guard.active = true;
    guard.reason = reason;
    guard.activated_at = Some(chrono::Utc::now().to_rfc3339());
    guard.deactivated_at = None;
    Ok(serde_json::to_value(&*guard).unwrap_or_default())
}

#[tauri::command]
pub async fn deactivate_kill_switch_cmd(state: tauri::State<'_, KillSwitchRef>) -> Result<serde_json::Value, String> {
    let mut guard = state.write().await;
    guard.active = false;
    guard.reason = None;
    guard.deactivated_at = Some(chrono::Utc::now().to_rfc3339());
    Ok(serde_json::to_value(&*guard).unwrap_or_default())
}