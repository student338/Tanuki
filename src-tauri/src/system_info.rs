use serde::Serialize;
use sysinfo::System;

#[derive(Serialize, Clone, Debug)]
pub struct SystemInfo {
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
    pub cpu_count: usize,
    pub gpu_available: bool,
    pub gpu_name: Option<String>,
    pub os: String,
    pub arch: String,
}

pub fn detect_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_ram_mb = sys.total_memory() / (1024 * 1024);
    let available_ram_mb = sys.available_memory() / (1024 * 1024);
    let cpu_count = sys.cpus().len();

    // Basic GPU detection (check for common GPU-related env vars or known paths)
    let gpu_available = detect_gpu_available();
    let gpu_name = if gpu_available {
        detect_gpu_name()
    } else {
        None
    };

    SystemInfo {
        total_ram_mb,
        available_ram_mb,
        cpu_count,
        gpu_available,
        gpu_name,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

fn detect_gpu_available() -> bool {
    // Check for NVIDIA
    if std::path::Path::new("/usr/bin/nvidia-smi").exists() {
        return true;
    }
    // Check for CUDA
    if std::env::var("CUDA_HOME").is_ok() || std::env::var("CUDA_PATH").is_ok() {
        return true;
    }
    // Check for ROCm (AMD)
    if std::path::Path::new("/opt/rocm").exists() {
        return true;
    }
    // Check for Metal (macOS) - always available on Apple Silicon
    #[cfg(target_os = "macos")]
    {
        return true;
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

fn detect_gpu_name() -> Option<String> {
    // Try nvidia-smi
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name", "--format=csv,noheader"])
        .output()
    {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() {
                return Some(name);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        return Some("Apple Metal GPU".to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

/// Calculate optimal context size based on available system RAM.
/// These thresholds balance model quality (larger context = better coherence)
/// against memory pressure. Each context token consumes ~0.5-2KB depending on
/// model architecture, so we scale conservatively to avoid OOM.
pub fn calculate_optimal_ctx_size(total_ram_mb: u64) -> u32 {
    match total_ram_mb {
        0..=4095 => 512,
        4096..=7999 => 2048,
        8000..=15999 => 4096,
        16000..=31999 => 8192,
        _ => 16384,
    }
}

/// Calculate the number of GPU layers to offload.
/// Note: For NVIDIA/AMD, this uses system RAM as a heuristic proxy for VRAM
/// since querying VRAM programmatically requires vendor-specific APIs.
/// In practice, users can override this via the UI. macOS Metal always offloads
/// all layers since unified memory is shared between CPU and GPU.
pub fn calculate_gpu_layers(info: &SystemInfo) -> u32 {
    if !info.gpu_available {
        return 0;
    }

    // For macOS with Metal, offload most layers
    if info.os == "macos" {
        return 999; // llama.cpp will cap at actual model layers
    }

    // For NVIDIA/AMD, use a conservative default
    // In production, this would query VRAM via nvidia-smi
    match info.total_ram_mb {
        0..=7999 => 20,
        8000..=15999 => 35,
        16000..=31999 => 50,
        _ => 80,
    }
}

// ---- Tauri Commands ----

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(detect_system_info())
}

#[tauri::command]
pub fn get_optimal_ctx_size() -> Result<u32, String> {
    let info = detect_system_info();
    Ok(calculate_optimal_ctx_size(info.total_ram_mb))
}

#[tauri::command]
pub fn get_gpu_layers() -> Result<u32, String> {
    let info = detect_system_info();
    Ok(calculate_gpu_layers(&info))
}
