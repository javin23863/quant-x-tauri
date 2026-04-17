use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
    let start_paper = MenuItem::with_id(app, "start_paper", "Start Paper Trading", true, None::<&str>)?;
    let start_live = MenuItem::with_id(app, "start_live", "Start Live Trading", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop Trading", true, None::<&str>)?;
    let kill = MenuItem::with_id(app, "kill", "Kill Switch", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show,
        &start_paper,
        &start_live,
        &stop,
        &kill,
        &sep1,
        &quit,
    ])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Quant X");

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let _tray = builder
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "start_paper" => {
                let _ = app.emit("trading:start", serde_json::json!({ "broker": "AlpacaPaper" }));
            }
            "start_live" => {
                let _ = app.emit("trading:start", serde_json::json!({ "broker": "AlpacaLive" }));
            }
            "stop" => {
                let _ = app.emit("trading:stop", ());
            }
            "kill" => {
                let _ = app.emit("kill-switch:activate", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}