mod device_identity;
mod sync_engine;
mod llm_sidecar;
mod system_info;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize device identity on first run
            let data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            device_identity::ensure_device_identity(&data_dir);

            // Start background broadcast task
            let data_dir_clone = data_dir.clone();
            tauri::async_runtime::spawn(async move {
                sync_engine::start_broadcast_loop(app_handle, data_dir_clone).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            device_identity::get_device_id,
            sync_engine::get_sync_status,
            sync_engine::set_control_center_url,
            sync_engine::get_control_center_url,
            sync_engine::get_control_center_hash,
            sync_engine::queue_mutation,
            sync_engine::get_pending_mutations,
            sync_engine::force_sync,
            sync_engine::get_local_config,
            sync_engine::set_local_config,
            llm_sidecar::load_model,
            llm_sidecar::unload_model,
            llm_sidecar::generate_text,
            llm_sidecar::get_model_status,
            system_info::get_system_info,
            system_info::get_optimal_ctx_size,
            system_info::get_gpu_layers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
