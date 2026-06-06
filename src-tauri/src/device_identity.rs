use rand::RngCore;
use sha2::{Digest, Sha512};
use std::fs;
use std::path::{Path, PathBuf};

const IDENTITY_FILE: &str = "device_identity.json";

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DeviceIdentity {
    /// The raw 64-byte secret (hex-encoded)
    pub secret: String,
    /// SHA-512 hash of the secret (hex-encoded, 128 chars)
    pub hash: String,
    /// Unique device ID (UUID v4)
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

    // Generate new identity
    let mut secret_bytes = [0u8; 64]; // 512 bits
    rand::thread_rng().fill_bytes(&mut secret_bytes);
    let secret_hex = hex_encode(&secret_bytes);

    // Compute SHA-512 of the secret
    let mut hasher = Sha512::new();
    hasher.update(&secret_bytes);
    let hash_result = hasher.finalize();
    let hash_hex = hex_encode(&hash_result);

    let identity = DeviceIdentity {
        secret: secret_hex,
        hash: hash_hex,
        device_id: uuid::Uuid::new_v4().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    // Persist to disk
    if let Ok(json) = serde_json::to_string_pretty(&identity) {
        let _ = fs::write(&path, json);
    }

    identity
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Tauri command: Get the device's SHA-512 hash
#[tauri::command]
pub fn get_device_hash(app_handle: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let identity = ensure_device_identity(&data_dir);
    Ok(identity.hash)
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
