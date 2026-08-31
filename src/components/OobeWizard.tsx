'use client';

import { useEffect, useState } from 'react';
import {
  isTauri,
  getLocalConfig,
  setLocalConfig,
  getDeviceId,
  getControlCenterUrl,
  setControlCenterUrl,
  getModelStatus,
  loadModel,
  getSystemInfo,
  getOptimalCtxSize,
  getGpuLayers,
  type ModelStatus,
  type SystemInfo,
} from '@/lib/tauri';

type Step = 'welcome' | 'control-center' | 'local-model' | 'done';

interface OobeWizardProps {
  /** Called when OOBE is finished or skipped — parent should continue normal flow. */
  onComplete: () => void;
}

/**
 * First-run Out-of-Box Experience for the local (Tauri) build of Tanuki.
 * Renders only inside Tauri and only until setup has been completed once.
 * The completion flag is stored in the Tauri local_config.json store.
 */
export default function OobeWizard({ onComplete }: OobeWizardProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Control center fields
  const [ccUrl, setCcUrl] = useState('');
  const [ccHash, setCcHash] = useState('');
  const [pairing, setPairing] = useState(false);
  const [paired, setPaired] = useState(false);

  // Local model fields
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [modelPath, setModelPath] = useState('');
  const [ctxSize, setCtxSize] = useState<number | null>(null);
  const [gpuLayers, setGpuLayers] = useState<number | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    (async () => {
      try {
        const raw = await getLocalConfig();
        const cfg = raw ? JSON.parse(raw) : {};
        if (cfg.oobeCompleted) return; // already done — stay hidden
        setVisible(true);

        const id = await getDeviceId();
        if (id) setDeviceId(id);

        const existingUrl = await getControlCenterUrl();
        if (existingUrl) {
          setCcUrl(existingUrl);
          setPaired(true);
        }
      } catch {
        // Malformed config — still show OOBE so the user can set things up.
        setVisible(true);
      }
    })();
  }, []);

  // Load system info lazily when reaching the model step.
  useEffect(() => {
    if (!visible || step !== 'local-model') return;
    (async () => {
      const [info, status, ctx, layers] = await Promise.all([
        getSystemInfo(),
        getModelStatus(),
        getOptimalCtxSize(),
        getGpuLayers(),
      ]);
      if (info) setSystemInfo(info);
      if (status) setModelStatus(status);
      if (ctx) setCtxSize(ctx);
      if (layers !== null) setGpuLayers(layers);
    })();
  }, [visible, step]);

  if (!visible) return null;

  async function markComplete() {
    try {
      const raw = await getLocalConfig();
      const cfg = raw ? JSON.parse(raw) : {};
      cfg.oobeCompleted = true;
      await setLocalConfig(JSON.stringify(cfg));
    } catch {
      // Non-fatal: worst case OOBE shows again next launch.
    }
    setVisible(false);
    onComplete();
  }

  async function handlePair() {
    if (!ccUrl.trim() || !ccHash.trim()) return;
    setPairing(true);
    try {
      await setControlCenterUrl(ccUrl.trim(), ccHash.trim());
      setPaired(true);
    } finally {
      setPairing(false);
    }
  }

  async function handleLoadModel() {
    if (!modelPath.trim()) {
      setModelError('Enter a path to a .gguf or .safetensors model file.');
      return;
    }
    setModelLoading(true);
    setModelError(null);
    try {
      const status = await loadModel(modelPath.trim(), ctxSize ?? undefined, gpuLayers ?? undefined);
      if (status) setModelStatus(status);
      else setModelError('Failed to load model. Check the path and try again.');
    } catch (err) {
      setModelError(String(err));
    } finally {
      setModelLoading(false);
    }
  }

  const steps: Step[] = ['welcome', 'control-center', 'local-model', 'done'];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 p-4 overflow-y-auto">
      {/* Decorative orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-purple-500 rounded-full opacity-20 blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-pink-500 rounded-full opacity-20 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-lg bg-white/[0.08] backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-white/20">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? 'w-8 bg-indigo-400' : i < stepIndex ? 'w-4 bg-indigo-400/60' : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>

        {step === 'welcome' && (
          <div className="text-center">
            <div className="text-6xl mb-4">🦝</div>
            <h1 className="text-3xl font-bold text-white">Welcome to Tanuki Stories</h1>
            <p className="text-purple-200 mt-3">
              This is the local edition — stories are generated on this device. Let&apos;s take a
              minute to set things up.
            </p>
            {deviceId && (
              <p className="text-xs text-purple-300/70 mt-4 font-mono truncate">
                Device ID: {deviceId}
              </p>
            )}
            <button
              onClick={() => setStep('control-center')}
              className="mt-8 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all min-h-[44px]"
            >
              Get Started →
            </button>
            <button
              onClick={markComplete}
              className="mt-3 w-full text-purple-300 hover:text-white text-sm py-2 transition-colors"
            >
              Skip setup
            </button>
          </div>
        )}

        {step === 'control-center' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">☁️ Pair a Control Center</h2>
            <p className="text-purple-200 text-sm mb-5">
              Optional. Pairing lets this device sync stories and receive configuration from a
              central Tanuki server when online. You can skip this and pair later from Settings.
            </p>
            <div className="space-y-3">
              <input
                type="url"
                value={ccUrl}
                onChange={(e) => setCcUrl(e.target.value)}
                placeholder="Control Center URL (https://…)"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <input
                type="text"
                value={ccHash}
                onChange={(e) => setCcHash(e.target.value)}
                placeholder="Control center hash"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              {paired && <p className="text-sm text-green-300">✓ Paired with control center</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('local-model')}
                className="flex-1 text-purple-300 hover:text-white py-3 rounded-xl border border-white/20 transition-colors min-h-[44px]"
              >
                Skip
              </button>
              <button
                onClick={paired ? () => setStep('local-model') : handlePair}
                disabled={pairing || (!paired && (!ccUrl.trim() || !ccHash.trim()))}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all min-h-[44px]"
              >
                {pairing ? 'Pairing…' : paired ? 'Continue →' : 'Pair'}
              </button>
            </div>
          </div>
        )}

        {step === 'local-model' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">🦙 Local Story Model</h2>
            <p className="text-purple-200 text-sm mb-4">
              Optional. Load a local LLM (.gguf / .safetensors) to generate stories entirely
              on-device. You can also do this later from Settings.
            </p>
            {systemInfo && (
              <p className="text-xs text-purple-300/80 mb-3">
                RAM: {Math.round(systemInfo.total_ram_mb / 1024)}GB · CPUs: {systemInfo.cpu_count} ·
                GPU: {systemInfo.gpu_available ? (systemInfo.gpu_name ?? 'Available') : 'None'}
                {ctxSize ? ` · ctx ${ctxSize}` : ''}
                {gpuLayers !== null ? ` · ${gpuLayers} GPU layers` : ''}
              </p>
            )}
            {modelStatus?.loaded ? (
              <div>
                <p className="text-sm text-green-300 mb-1">✓ Model loaded</p>
                <p className="text-xs text-purple-300/70 truncate">{modelStatus.model_path}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={modelPath}
                  onChange={(e) => setModelPath(e.target.value)}
                  placeholder="Path to model file"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {modelError && <p className="text-xs text-red-300">{modelError}</p>}
                <button
                  onClick={handleLoadModel}
                  disabled={modelLoading}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {modelLoading ? 'Loading model…' : 'Load Model'}
                </button>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('done')}
                className="flex-1 text-purple-300 hover:text-white py-3 rounded-xl border border-white/20 transition-colors min-h-[44px]"
              >
                Skip
              </button>
              <button
                onClick={() => setStep('done')}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all min-h-[44px]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white">You&apos;re all set!</h2>
            <p className="text-purple-200 mt-3">
              Setup is complete. Sign in to start creating stories — everything runs locally on
              this device.
            </p>
            <button
              onClick={markComplete}
              className="mt-8 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all min-h-[44px]"
            >
              Finish →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
