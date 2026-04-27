import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, LockableField, StoryDefaults, getEffectiveMaturitySettings, getEffectiveMaturityRange } from '@/lib/storage';

export interface StudentConfigResponse {
  lockedFields: LockableField[];
  defaults: StoryDefaults;
  maturityRange: { min: number; max: number };
  contentMaturityLevel: number;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = getConfig();
  const userCfg = config.userConfigs?.[user.username];
  const { contentMaturityLevel } = getEffectiveMaturitySettings(user.username);
  const maturityRange = getEffectiveMaturityRange(user.username);

  const response: StudentConfigResponse = {
    lockedFields: userCfg?.lockedFields ?? [],
    defaults: userCfg?.defaults ?? {},
    maturityRange,
    contentMaturityLevel,
  };

  return NextResponse.json(response);
}
