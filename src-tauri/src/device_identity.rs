use std::fs;
use std::path::{Path, PathBuf};

const IDENTITY_FILE: &str = "device_identity.json";

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DeviceIdentity {
    /// Unique device ID (UUID v4) — the per-device identity
    pub device_id: String,
    /// Timestamp of creation
    pub created_at: String,
}

fn identity_path(data_dir: &Path) -> PathBuf {
    data_dir.join(IDENTITY_FILE)
}

/// Ensures a device identity exists. Creates one if missing.
pub fn ensure_device_identity(data_dir: &Path) -> DeviceIdentity {
    let path = identity_path(data_dir);

    if path.exists() {
        if let Ok(contents) = fs::read_to_string(&path) {
            if let Ok(identity) = serde_json::from_str::<DeviceIdentity>(&contents) {
                return identity;
            }
        }
    }

    let identity = DeviceIdentity {
        device_id: uuid::Uuid::new_v4().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    // Persist to disk
    if let Ok(json) = serde_json::to_string_pretty(&identity) {
        let _ = fs::write(&path, json);
    }

    identity
}

/// Tauri command: Get the device's unique ID
#[tauri::command]
pub fn get_device_id(app_handle: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let identity = ensure_device_identity(&data_dir);
    Ok(identity.device_id)
}
