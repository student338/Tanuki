import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, saveConfig } from '@/lib/storage';

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
  const { systemPrompt } = await req.json();
  if (typeof systemPrompt !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  saveConfig({ systemPrompt });
  return NextResponse.json({ ok: true });
}
