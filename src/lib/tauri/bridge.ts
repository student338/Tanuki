/**
 * Tauri bridge module - provides typed access to Tauri backend commands.
 * Falls back gracefully when running in a regular browser (non-Tauri).
 */

// Check if we're running inside Tauri
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Invoke a Tauri command. Returns null if not in Tauri context.
 */
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;

  try {
    // Dynamic import to avoid build issues when Tauri API is not available
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);
    return null;
  }
}

// ---- Device Identity ----

export async function getDeviceHash(): Promise<string | null> {
  return invoke<string>('get_device_hash');
}

export async function getDeviceId(): Promise<string | null> {
  return invoke<string>('get_device_id');
}

// ---- Sync Engine ----

export interface SyncStatus {
  is_online: boolean;
  control_center_url: string | null;
  last_sync: string | null;
  pending_mutations: number;
}

export async function getSyncStatus(): Promise<SyncStatus | null> {
  return invoke<SyncStatus>('get_sync_status');
}

export async function setControlCenterUrl(url: string): Promise<void> {
  await invoke('set_control_center_url', { url });
}

export async function getControlCenterUrl(): Promise<string | null> {
  return invoke<string | null>('get_control_center_url');
}

export async function queueMutation(mutationType: string, payload: string): Promise<number | null> {
  return invoke<number>('queue_mutation', { mutationType, payload });
}

export interface Mutation {
  id: number;
  mutation_type: string;
  payload: string;
  created_at: string;
  synced: boolean;
}

export async function getPendingMutations(): Promise<Mutation[] | null> {
  return invoke<Mutation[]>('get_pending_mutations');
}

export async function forceSync(): Promise<boolean | null> {
  return invoke<boolean>('force_sync');
}

export async function getLocalConfig(): Promise<string | null> {
  return invoke<string>('get_local_config');
}

export async function setLocalConfig(config: string): Promise<void> {
  await invoke('set_local_config', { config });
}

// ---- LLM Sidecar ----

export interface ModelStatus {
  loaded: boolean;
  model_path: string | null;
  ctx_size: number | null;
  gpu_layers: number | null;
}

export async function loadModel(
  modelPath: string,
  ctxSize?: number,
  gpuLayers?: number,
): Promise<ModelStatus | null> {
  return invoke<ModelStatus>('load_model', {
    modelPath,
    ctxSize: ctxSize ?? null,
    gpuLayers: gpuLayers ?? null,
  });
}

export async function unloadModel(): Promise<void> {
  await invoke('unload_model');
}

export async function generateText(
  prompt: string,
  maxTokens?: number,
  temperature?: number,
): Promise<string | null> {
  return invoke<string>('generate_text', {
    prompt,
    maxTokens: maxTokens ?? null,
    temperature: temperature ?? null,
  });
}

export async function getModelStatus(): Promise<ModelStatus | null> {
  return invoke<ModelStatus>('get_model_status');
}

// ---- System Info ----

export interface SystemInfo {
  total_ram_mb: number;
  available_ram_mb: number;
  cpu_count: number;
  gpu_available: boolean;
  gpu_name: string | null;
  os: string;
  arch: string;
}

export async function getSystemInfo(): Promise<SystemInfo | null> {
  return invoke<SystemInfo>('get_system_info');
}

export async function getOptimalCtxSize(): Promise<number | null> {
  return invoke<number>('get_optimal_ctx_size');
}

export async function getGpuLayers(): Promise<number | null> {
  return invoke<number>('get_gpu_layers');
}
