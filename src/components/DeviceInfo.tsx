'use client';

import { useEffect, useState } from 'react';
import {
  isTauri,
  getControlCenterHash,
  getDeviceId,
  getControlCenterUrl,
  setControlCenterUrl,
} from '@/lib/tauri/bridge';

export default function DeviceInfo() {
  const [controlCenterHash, setControlCenterHash] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ccUrl, setCcUrl] = useState<string>('');
  const [ccHash, setCcHash] = useState<string>('');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    const init = async () => {
      const hash = await getControlCenterHash();
      setControlCenterHash(hash);

      const id = await getDeviceId();
      setDeviceId(id);

      const url = await getControlCenterUrl();
      if (url) {
        setCcUrl(url);
        setSavedUrl(url);
      }
    };

    init();
  }, []);

  if (!isTauri()) return null;

  const handleSaveUrl = async () => {
    if (!ccUrl.trim() || !ccHash.trim()) return;
    setSaving(true);
    try {
      await setControlCenterUrl(ccUrl.trim(), ccHash.trim());
      setSavedUrl(ccUrl.trim());
      setControlCenterHash(ccHash.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 text-white">
      <h3 className="text-lg font-semibold mb-3">🔗 Device Identity</h3>

      {deviceId && (
        <div className="mb-2">
          <p className="text-xs text-gray-400">Device ID</p>
          <p className="text-sm font-mono truncate">{deviceId}</p>
        </div>
      )}

      {controlCenterHash && (
        <div className="mb-3">
          <p className="text-xs text-gray-400">Control Center Hash</p>
          <p className="text-sm font-mono truncate">{controlCenterHash}</p>
        </div>
      )}

      <div className="border-t border-gray-700 pt-3 mt-3">
        <p className="text-xs text-gray-400 mb-1">Control Center URL</p>
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={ccUrl}
            onChange={(e) => setCcUrl(e.target.value)}
            placeholder="https://your-control-center.example.com"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          />
          <input
            type="text"
            value={ccHash}
            onChange={(e) => setCcHash(e.target.value)}
            placeholder="Control center hash"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          />
          <button
            onClick={handleSaveUrl}
            disabled={saving || !ccUrl.trim() || !ccHash.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
          >
            {saving ? '...' : 'Pair'}
          </button>
        </div>
        {savedUrl && (
          <p className="text-xs text-green-400 mt-1">✓ Paired with control center</p>
        )}
      </div>
    </div>
  );
}
