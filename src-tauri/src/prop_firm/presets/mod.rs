pub mod ftmo;
pub mod topstep;
pub mod lucid;
pub mod apex;

use crate::prop_firm::{PropFirmPreset, PropFirmRuleProvider};

pub fn get_all_presets() -> Vec<PropFirmPreset> {
    vec![
        ftmo::FtmoPreset.preset(),
        topstep::TopstepPreset.preset(),
        lucid::LucidPreset.preset(),
        apex::ApexPreset.preset(),
    ]
}

pub fn get_preset_by_name(name: &str) -> Option<PropFirmPreset> {
    let lower = name.to_lowercase();
    let presets = get_all_presets();
    presets.into_iter().find(|p| {
        p.name.to_lowercase() == lower
        || p.provider.to_lowercase() == lower
        || p.name.to_lowercase().contains(&lower)
    })
}

pub fn get_preset_by_id(id: &str) -> Option<PropFirmPreset> {
    match id {
        "ftmo_50k_challenge" | "ftmo_challenge" => Some(ftmo::FtmoPreset.preset()),
        "topstep_50k_trader" | "topstep_eval_safe" | "topstep_funded_safe" => Some(topstep::TopstepPreset.preset()),
        "lucid_50k_flex" | "lucidflex_50k" => Some(lucid::LucidPreset.preset()),
        "apex_50k_eval" | "apex_trader_funding" => Some(apex::ApexPreset.preset()),
        _ => None,
    }
}