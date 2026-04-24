import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, LockableField, StoryDefaults } from '@/lib/storage';

export interface StudentConfigResponse {
  lockedFields: LockableField[];
  defaults: StoryDefaults;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = getConfig();
  const userCfg = config.userConfigs?.[user.username];

  const response: StudentConfigResponse = {
    lockedFields: userCfg?.lockedFields ?? [],
    defaults: userCfg?.defaults ?? {},
  };

  return NextResponse.json(response);
}
