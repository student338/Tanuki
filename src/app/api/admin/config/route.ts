import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, saveConfig, Config } from '@/lib/storage';

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
    updated.apiBaseUrl = typeof body.apiBaseUrl === 'string' && body.apiBaseUrl.trim()
      ? body.apiBaseUrl.trim()
      : undefined;
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

  if ('readingLevelRange' in body) {
    if (
      body.readingLevelRange !== null &&
      typeof body.readingLevelRange === 'object' &&
      typeof body.readingLevelRange.min === 'string' &&
      typeof body.readingLevelRange.max === 'string'
    ) {
      updated.readingLevelRange = { min: body.readingLevelRange.min, max: body.readingLevelRange.max };
    } else {
      updated.readingLevelRange = undefined;
    }
  }

  saveConfig(updated);
  return NextResponse.json({ ok: true });
}
