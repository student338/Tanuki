import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, saveConfig, Config } from '@/lib/storage';

/** Only allow http/https scheme to prevent SSRF via internal network URLs. */
function isValidApiBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(getConfig());
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  if (typeof body.systemPrompt !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const existing = getConfig();
  const updated: Config = {
    ...existing,
    systemPrompt: body.systemPrompt,
  };

  if ('apiBaseUrl' in body) {
    const raw = typeof body.apiBaseUrl === 'string' ? body.apiBaseUrl.trim() : '';
    if (raw && !isValidApiBaseUrl(raw)) {
      return NextResponse.json({ error: 'apiBaseUrl must use http or https scheme' }, { status: 400 });
    }
    updated.apiBaseUrl = raw || undefined;
  }
  if ('model' in body) {
    updated.model = typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : undefined;
  }
  if ('localModelId' in body) {
    updated.localModelId = typeof body.localModelId === 'string' && body.localModelId.trim()
      ? body.localModelId.trim()
      : undefined;
  }
  if ('userConfigs' in body) {
    updated.userConfigs = typeof body.userConfigs === 'object' && body.userConfigs !== null
      ? body.userConfigs
      : undefined;
  }

  saveConfig(updated);
  return NextResponse.json({ ok: true });
}
