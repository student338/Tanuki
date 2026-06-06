use serde::Serialize;
use std::process::Child;
use std::sync::Mutex;
use tauri::Manager;

static MODEL_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

#[derive(Serialize, Clone, Debug)]
pub struct ModelStatus {
    pub loaded: bool,
    pub model_path: Option<String>,
    pub ctx_size: Option<u32>,
    pub gpu_layers: Option<u32>,
}

static MODEL_PATH: Mutex<Option<String>> = Mutex::new(None);

/// Tauri command: Load a .gguf/.safetensors model using llama.cpp sidecar
#[tauri::command]
pub async fn load_model(
    app_handle: tauri::AppHandle,
    model_path: String,
    ctx_size: Option<u32>,
    gpu_layers: Option<u32>,
) -> Result<ModelStatus, String> {
    // Unload any existing model first
    unload_model_internal()?;

    let sys_info = crate::system_info::detect_system_info();
    let effective_ctx = ctx_size.unwrap_or_else(|| crate::system_info::calculate_optimal_ctx_size(sys_info.total_ram_mb));
    let effective_gpu_layers = gpu_layers.unwrap_or_else(|| crate::system_info::calculate_gpu_layers(&sys_info));

    // Resolve sidecar binary path
    let sidecar_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("binaries")
        .join(get_sidecar_name());

    // Build command arguments
    let mut args = vec![
        "--model".to_string(),
        model_path.clone(),
        "--ctx-size".to_string(),
        effective_ctx.to_string(),
        "--host".to_string(),
        "127.0.0.1".to_string(),
        "--port".to_string(),
        "8847".to_string(),
    ];

    if effective_gpu_layers > 0 {
        args.push("--n-gpu-layers".to_string());
        args.push(effective_gpu_layers.to_string());
    }

    // Start llama-server process
    let child = std::process::Command::new(&sidecar_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to start llama-server: {}", e))?;

    *MODEL_PROCESS.lock().unwrap() = Some(child);
    *MODEL_PATH.lock().unwrap() = Some(model_path.clone());

    // Wait a moment for server to start
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    Ok(ModelStatus {
        loaded: true,
        model_path: Some(model_path),
        ctx_size: Some(effective_ctx),
        gpu_layers: Some(effective_gpu_layers),
    })
}

/// Tauri command: Unload the current model
#[tauri::command]
pub fn unload_model() -> Result<(), String> {
    unload_model_internal()
}

fn unload_model_internal() -> Result<(), String> {
    let mut process = MODEL_PROCESS.lock().unwrap();
    if let Some(ref mut child) = *process {
        child.kill().ok();
        child.wait().ok();
    }
    *process = None;
    *MODEL_PATH.lock().unwrap() = None;
    Ok(())
}

/// Tauri command: Generate text using the loaded model
#[tauri::command]
pub async fn generate_text(
    prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> Result<String, String> {
    let is_loaded = MODEL_PROCESS.lock().unwrap().is_some();
    if !is_loaded {
        return Err("No model loaded. Call load_model first.".to_string());
    }

    let client = reqwest::Client::new();
    let max_tok = max_tokens.unwrap_or(512);
    let temp = temperature.unwrap_or(0.7);

    let response = client
        .post("http://127.0.0.1:8847/completion")
        .json(&serde_json::json!({
            "prompt": prompt,
            "n_predict": max_tok,
            "temperature": temp,
            "stop": ["\n\n\n", "</s>", "<|im_end|>"],
            "stream": false,
        }))
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Failed to reach llama-server: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("llama-server returned status: {}", response.status()));
    }

    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let content = body["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(content)
}

/// Tauri command: Get current model status
#[tauri::command]
pub fn get_model_status() -> Result<ModelStatus, String> {
    let loaded = MODEL_PROCESS.lock().unwrap().is_some();
    let path = MODEL_PATH.lock().unwrap().clone();

    Ok(ModelStatus {
        loaded,
        model_path: path,
        ctx_size: None,
        gpu_layers: None,
    })
}

fn get_sidecar_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "llama-server.exe"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "llama-server"
    }
}
