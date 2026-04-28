import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchKnowledgeBase } from '@/lib/knowledge-base';
import { searchWeb } from '@/lib/web-search';

/**
 * POST /api/info/search
 *
 * Body: { query: string }
 *
 * Runs the query against both the local knowledge base (embedding similarity)
 * and the web (DuckDuckGo instant answers) in parallel, then returns the
 * combined results to the client / generate endpoint.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { query } = body as { query?: string };
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const [knowledgeResults, webResults] = await Promise.all([
    searchKnowledgeBase(query.trim(), 3),
    searchWeb(query.trim(), 5),
  ]);

  return NextResponse.json({ knowledgeResults, webResults });
}
