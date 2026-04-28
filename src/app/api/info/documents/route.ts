import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getKnowledgeDocuments, deleteKnowledgeDocument } from '@/lib/storage';
import { embedAndSaveDocument } from '@/lib/knowledge-base';
import { randomUUID } from 'crypto';

/**
 * GET /api/info/documents
 * Returns all knowledge-base documents (without embedding vectors to keep
 * the response lean).  Requires admin role.
 *
 * POST /api/info/documents
 * Add a new document to the knowledge base and compute its embedding.
 * Body: { title: string; content: string; tags?: string[] }
 * Requires admin role.
 *
 * DELETE /api/info/documents
 * Remove a document by ID.
 * Body: { id: string }
 * Requires admin role.
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const docs = getKnowledgeDocuments().map(({ id, title, content, tags, createdAt }) => ({
    id,
    title,
    content,
    tags,
    createdAt,
  }));
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, content, tags } = body as { title?: string; content?: string; tags?: string[] };

  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  const doc = await embedAndSaveDocument({
    id: randomUUID(),
    title: title.trim(),
    content: content.trim(),
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString(),
  });

  // Return without the embedding vector
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { embedding: _emb, ...docWithoutEmbedding } = doc;
  return NextResponse.json(docWithoutEmbedding, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const deleted = deleteKnowledgeDocument(id);
  if (!deleted) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
