'use client';

import { useEffect, useState } from 'react';
import {
  isTauri,
  getModelStatus,
  loadModel,
  unloadModel,
  getSystemInfo,
  getOptimalCtxSize,
  getGpuLayers,
  type ModelStatus,
  type SystemInfo,
} from '@/lib/tauri';

export default function LocalModelManager() {
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [modelPath, setModelPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctxSize, setCtxSize] = useState<number | null>(null);
  const [gpuLayers, setGpuLayers] = useState<number | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    const init = async () => {
      const status = await getModelStatus();
      if (status) setModelStatus(status);

      const info = await getSystemInfo();
      if (info) setSystemInfo(info);

      const ctx = await getOptimalCtxSize();
      if (ctx) setCtxSize(ctx);

      const layers = await getGpuLayers();
      if (layers !== null) setGpuLayers(layers);
    };

    init();
  }, []);

  if (!isTauri()) {
    return null; // Don't render in browser mode
  }

  const handleLoad = async () => {
    if (!modelPath.trim()) {
      setError('Please enter a model path');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const status = await loadModel(modelPath, ctxSize ?? undefined, gpuLayers ?? undefined);
      if (status) {
        setModelStatus(status);
      } else {
        setError('Failed to load model');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUnload = async () => {
    await unloadModel();
    setModelStatus({ loaded: false, model_path: null, ctx_size: null, gpu_layers: null });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 text-white">
      <h3 className="text-lg font-semibold mb-3">🦙 Local Model (llama.cpp)</h3>

      {/* System Info */}
      {systemInfo && (
        <div className="text-xs text-gray-400 mb-3 space-y-1">
          <p>RAM: {Math.round(systemInfo.total_ram_mb / 1024)}GB | CPUs: {systemInfo.cpu_count}</p>
          <p>GPU: {systemInfo.gpu_available ? (systemInfo.gpu_name ?? 'Available') : 'None'}</p>
          <p>OS: {systemInfo.os} ({systemInfo.arch})</p>
          <p>Optimal ctx: {ctxSize} | GPU layers: {gpuLayers}</p>
        </div>
      )}

      {/* Model Status */}
      {modelStatus?.loaded ? (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-sm text-green-300">Model loaded</span>
          </div>
          <p className="text-xs text-gray-400 truncate">{modelStatus.model_path}</p>
          <button
            onClick={handleUnload}
            className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Unload Model
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={modelPath}
            onChange={(e) => setModelPath(e.target.value)}
            placeholder="Path to .gguf or .safetensors file"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400">Context Size</label>
              <input
                type="number"
                value={ctxSize ?? ''}
                onChange={(e) => setCtxSize(parseInt(e.target.value) || null)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400">GPU Layers</label>
              <input
                type="number"
                value={gpuLayers ?? ''}
                onChange={(e) => setGpuLayers(parseInt(e.target.value) || null)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleLoad}
            disabled={loading}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
          >
            {loading ? 'Loading model...' : 'Load Model'}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
