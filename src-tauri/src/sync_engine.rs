use crate::device_identity;
use chrono::Utc;
use reqwest::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Manager;

static IS_ONLINE: AtomicBool = AtomicBool::new(false);

const BROADCAST_INTERVAL_SECS: u64 = 180; // 3 minutes
const SYNC_DB_FILE: &str = "sync_queue.db";
const CONFIG_FILE: &str = "local_config.json";
const CONTROL_CENTER_FILE: &str = "control_center.json";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Mutation {
    pub id: i64,
    pub mutation_type: String,
    pub payload: String,
    pub created_at: String,
    pub synced: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SyncStatus {
    pub is_online: bool,
    pub control_center_url: Option<String>,
    pub last_sync: Option<String>,
    pub pending_mutations: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ControlCenterConfig {
    url: String,
    /// The control center hash — identifies which control center this device belongs to
    hash: String,
    auth_token: Option<String>,
    paired_at: Option<String>,
}

fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join(SYNC_DB_FILE)
}

fn config_path(data_dir: &Path) -> PathBuf {
    data_dir.join(CONFIG_FILE)
}

fn control_center_path(data_dir: &Path) -> PathBuf {
    data_dir.join(CONTROL_CENTER_FILE)
}

fn init_db(data_dir: &Path) -> Result<Connection, String> {
    let conn = Connection::open(db_path(data_dir)).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS mutations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mutation_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            synced INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            synced_at TEXT NOT NULL,
            mutations_count INTEGER NOT NULL,
            success INTEGER NOT NULL
        );",
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn get_cc_config(data_dir: &Path) -> Option<ControlCenterConfig> {
    let path = control_center_path(data_dir);
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
    } else {
        None
    }
}

fn save_cc_config(data_dir: &Path, config: &ControlCenterConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(control_center_path(data_dir), json).map_err(|e| e.to_string())
}

/// Background loop: broadcasts control center hash and syncs pending mutations
pub async fn start_broadcast_loop(app_handle: tauri::AppHandle, data_dir: PathBuf) {
    let client = Client::new();

    loop {
        tokio::time::sleep(Duration::from_secs(BROADCAST_INTERVAL_SECS)).await;

        let cc_config = get_cc_config(&data_dir);
        let Some(cc) = cc_config else {
            continue;
        };

        let identity = device_identity::ensure_device_identity(&data_dir);

        // Attempt broadcast / heartbeat
        let broadcast_result = client
            .post(format!("{}/api/devices/heartbeat", cc.url))
            .json(&serde_json::json!({
                "control_center_hash": cc.hash,
                "timestamp": Utc::now().to_rfc3339(),
            }))
            .timeout(Duration::from_secs(10))
            .send()
            .await;


        let was_online = IS_ONLINE.load(Ordering::Relaxed);
        let now_online = broadcast_result.is_ok()
            && broadcast_result
                .as_ref()
                .map(|r| r.status().is_success())
                .unwrap_or(false);

        IS_ONLINE.store(now_online, Ordering::Relaxed);

        // If we just came back online, sync all pending mutations
        if now_online && !was_online {
            let _ = sync_pending_mutations(&client, &data_dir, &cc, &cc.hash).await;
            // Also pull latest config from control center
            let _ = pull_config_from_cc(&client, &data_dir, &cc, &cc.hash).await;
        } else if now_online {
            // Regular sync of any pending mutations
            let _ = sync_pending_mutations(&client, &data_dir, &cc, &cc.hash).await;
        }

        // Emit sync status event to frontend
        let _ = app_handle.emit("sync-status-changed", now_online);
    }
}

async fn sync_pending_mutations(
    client: &Client,
    data_dir: &Path,
    cc: &ControlCenterConfig,
    control_center_hash: &str,
) -> Result<(), String> {
    let conn = init_db(data_dir)?;
    let identity = device_identity::ensure_device_identity(data_dir);

    let mut stmt = conn
        .prepare("SELECT id, mutation_type, payload, created_at FROM mutations WHERE synced = 0 ORDER BY id ASC")
        .map_err(|e| e.to_string())?;

    let mutations: Vec<Mutation> = stmt
        .query_map([], |row| {
            Ok(Mutation {
                id: row.get(0)?,
                mutation_type: row.get(1)?,
                payload: row.get(2)?,
                created_at: row.get(3)?,
                synced: false,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if mutations.is_empty() {
        return Ok(());
    }

    // Send batch to control center
    let response = client
        .post(format!("{}/api/devices/sync", cc.url))
        .json(&serde_json::json!({
            "control_center_hash": control_center_hash,
            "device_id": identity.device_id,
            "mutations": mutations,
            "auth_token": cc.auth_token,
        }))
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        // Mark all sent mutations as synced
        let ids: Vec<i64> = mutations.iter().map(|m| m.id).collect();
        for id in ids {
            conn.execute("UPDATE mutations SET synced = 1 WHERE id = ?1", params![id])
                .ok();
        }

        // Log the sync
        conn.execute(
            "INSERT INTO sync_log (synced_at, mutations_count, success) VALUES (?1, ?2, 1)",
            params![Utc::now().to_rfc3339(), mutations.len()],
        )
        .ok();
    }

    Ok(())
}

async fn pull_config_from_cc(
    client: &Client,
    data_dir: &Path,
    cc: &ControlCenterConfig,
    control_center_hash: &str,
) -> Result<(), String> {
    let identity = device_identity::ensure_device_identity(data_dir);
    let response = client
        .get(format!("{}/api/devices/config", cc.url))
        .query(&[
            ("control_center_hash", control_center_hash),
            ("device_id", &identity.device_id),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let body = response.text().await.map_err(|e| e.to_string())?;
        fs::write(config_path(data_dir), body).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ---- Tauri Commands ----

#[tauri::command]
pub fn get_sync_status(app_handle: tauri::AppHandle) -> Result<SyncStatus, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let conn = init_db(&data_dir)?;

    let pending: usize = conn
        .query_row(
            "SELECT COUNT(*) FROM mutations WHERE synced = 0",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let last_sync: Option<String> = conn
        .query_row(
            "SELECT synced_at FROM sync_log WHERE success = 1 ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    let cc = get_cc_config(&data_dir);

    Ok(SyncStatus {
        is_online: IS_ONLINE.load(Ordering::Relaxed),
        control_center_url: cc.map(|c| c.url),
        last_sync,
        pending_mutations: pending,
    })
}

#[tauri::command]
pub fn set_control_center_url(app_handle: tauri::AppHandle, url: String, hash: String) -> Result<(), String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let config = ControlCenterConfig {
        url,
        hash,
        auth_token: None,
        paired_at: Some(Utc::now().to_rfc3339()),
    };
    save_cc_config(&data_dir, &config)
}

#[tauri::command]
pub fn get_control_center_url(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(get_cc_config(&data_dir).map(|c| c.url))
}

#[tauri::command]
pub fn get_control_center_hash(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(get_cc_config(&data_dir).map(|c| c.hash))
}

#[tauri::command]
pub fn queue_mutation(
    app_handle: tauri::AppHandle,
    mutation_type: String,
    payload: String,
) -> Result<i64, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let conn = init_db(&data_dir)?;

    conn.execute(
        "INSERT INTO mutations (mutation_type, payload, created_at) VALUES (?1, ?2, ?3)",
        params![mutation_type, payload, Utc::now().to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_pending_mutations(app_handle: tauri::AppHandle) -> Result<Vec<Mutation>, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let conn = init_db(&data_dir)?;

    let mut stmt = conn
        .prepare("SELECT id, mutation_type, payload, created_at FROM mutations WHERE synced = 0 ORDER BY id ASC")
        .map_err(|e| e.to_string())?;

    let mutations = stmt
        .query_map([], |row| {
            Ok(Mutation {
                id: row.get(0)?,
                mutation_type: row.get(1)?,
                payload: row.get(2)?,
                created_at: row.get(3)?,
                synced: false,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(mutations)
}

#[tauri::command]
pub async fn force_sync(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let cc = get_cc_config(&data_dir).ok_or("No control center configured")?;
    let client = Client::new();

    let hash = cc.hash.clone();
    sync_pending_mutations(&client, &data_dir, &cc, &hash).await?;
    pull_config_from_cc(&client, &data_dir, &cc, &hash).await?;

    IS_ONLINE.store(true, Ordering::Relaxed);
    Ok(true)
}

#[tauri::command]
pub fn get_local_config(app_handle: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = config_path(&data_dir);
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub fn set_local_config(app_handle: tauri::AppHandle, config: String) -> Result<(), String> {
    let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::write(config_path(&data_dir), &config).map_err(|e| e.to_string())?;

    // Also queue as a mutation for syncing to control center
    let conn = init_db(&data_dir)?;
    conn.execute(
        "INSERT INTO mutations (mutation_type, payload, created_at) VALUES (?1, ?2, ?3)",
        params!["config_update", config, Utc::now().to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
