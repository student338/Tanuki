'use client';

import { useEffect, useState } from 'react';
import {
  isTauri,
  getDeviceHash,
  getDeviceId,
  getControlCenterUrl,
  setControlCenterUrl,
} from '@/lib/tauri/bridge';

export default function DeviceInfo() {
  const [deviceHash, setDeviceHash] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ccUrl, setCcUrl] = useState<string>('');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    const init = async () => {
      const hash = await getDeviceHash();
      setDeviceHash(hash);

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
    if (!ccUrl.trim()) return;
    setSaving(true);
    try {
      await setControlCenterUrl(ccUrl.trim());
      setSavedUrl(ccUrl.trim());
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

      {deviceHash && (
        <div className="mb-3">
          <p className="text-xs text-gray-400">SHA-512 Hash (first 32 chars)</p>
          <p className="text-sm font-mono truncate">{deviceHash.slice(0, 32)}...</p>
        </div>
      )}

      <div className="border-t border-gray-700 pt-3 mt-3">
        <p className="text-xs text-gray-400 mb-1">Control Center URL</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={ccUrl}
            onChange={(e) => setCcUrl(e.target.value)}
            placeholder="https://your-control-center.example.com"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          />
          <button
            onClick={handleSaveUrl}
            disabled={saving || ccUrl === savedUrl}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
        {savedUrl && (
          <p className="text-xs text-green-400 mt-1">✓ Connected to control center</p>
        )}
      </div>
    </div>
  );
}
