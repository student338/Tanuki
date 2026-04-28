/**
 * Knowledge-base search using dense vector embeddings.
 *
 * Documents are stored in data/knowledge-base.json with their embedding
 * vectors pre-computed.  On query, the query is embedded with the same model
 * and the top-K most similar documents are returned via cosine similarity.
 *
 * Embedding model: Xenova/all-MiniLM-L6-v2 (loaded via @huggingface/transformers)
 * — lightweight (~23 MB), produces 384-dimensional sentence vectors, requires
 * no API key.  Falls back gracefully when the model cannot be loaded.
 */

import { getKnowledgeDocuments, saveKnowledgeDocument, KnowledgeDocument } from './storage';

// ---------------------------------------------------------------------------
// Embedding pipeline (cached across calls)
// ---------------------------------------------------------------------------

interface EmbeddingPipeline {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (input: string | string[], opts: Record<string, unknown>): Promise<any>;
}

let embeddingPipe: EmbeddingPipeline | null = null;

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

async function getEmbeddingPipeline(): Promise<EmbeddingPipeline> {
  if (embeddingPipe) return embeddingPipe;
  const { pipeline } = await import('@huggingface/transformers');
  embeddingPipe = (await pipeline('feature-extraction', EMBEDDING_MODEL)) as EmbeddingPipeline;
  return embeddingPipe;
}

/**
 * Embed a single text string and return the mean-pooled float32 vector.
 * Returns null if the embedding pipeline fails to load.
 */
export async function embedText(text: string): Promise<number[] | null> {
  try {
    const pipe = await getEmbeddingPipeline();
    // The pipeline returns a Tensor; we mean-pool across the token dimension.
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array
    const data: Float32Array = output.data as Float32Array;
    return Array.from(data);
  } catch (err) {
    console.error('[knowledge-base] Embedding failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface KBSearchResult {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  score: number;
}

/**
 * Search the local knowledge base for documents relevant to `query`.
 *
 * @param query  Natural-language query from the student.
 * @param topK   Maximum number of results to return (default 3).
 * @returns      Ranked array of matching documents with cosine-similarity scores.
 */
export async function searchKnowledgeBase(query: string, topK = 3): Promise<KBSearchResult[]> {
  const docs = getKnowledgeDocuments();
  if (docs.length === 0) return [];

  const queryEmbedding = await embedText(query);
  if (!queryEmbedding) {
    // Fallback: return first topK documents without ranking
    return docs.slice(0, topK).map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      tags: d.tags,
      score: 0,
    }));
  }

  // Ensure all documents have embeddings; compute missing ones and persist
  const needsEmbedding = docs.filter((d) => !d.embedding || d.embedding.length === 0);
  for (const doc of needsEmbedding) {
    const emb = await embedText(doc.content);
    if (emb) {
      doc.embedding = emb;
      saveKnowledgeDocument(doc);
    }
  }

  const scored = docs
    .filter((d) => d.embedding && d.embedding.length > 0)
    .map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      tags: d.tags,
      score: cosineSimilarity(queryEmbedding, d.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Embed a document and persist the embedding alongside it so future searches
 * are fast.  Call this after inserting a new document into the KB.
 */
export async function embedAndSaveDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
  const embedding = await embedText(doc.content);
  const updated: KnowledgeDocument = { ...doc, ...(embedding ? { embedding } : {}) };
  saveKnowledgeDocument(updated);
  return updated;
}
