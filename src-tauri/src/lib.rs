use tauri::Manager;

#[tauri::command]
fn get_overdue() -> Vec<serde_json::Value> { vec![] }

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![get_overdue])
    .setup(|app| {
      let win = app.get_webview_window("reminders").unwrap();
      let _ = win.hide();
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error running CyberGo");
}
