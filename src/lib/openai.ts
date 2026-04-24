import type { StoryOptions } from './storage';

export interface GenerateOptions {
  systemPrompt: string;
  userRequest: string;
  storyOptions?: StoryOptions;
  apiBaseUrl?: string;
  model?: string;
  /**
   * HuggingFace model ID or local directory path for .safetensors model
   * inference.  When set, overrides apiBaseUrl / model and runs generation
   * locally via @huggingface/transformers.
   */
  localModelId?: string;
}

function buildUserMessage(userRequest: string, opts?: StoryOptions): string {
  const parts: string[] = [];

  if (opts?.title) parts.push(`Title: ${opts.title}`);
  if (opts?.genre) parts.push(`Genre: ${opts.genre}`);
  if (opts?.chapterCount && opts.chapterCount > 1) {
    parts.push(`Number of chapters: ${opts.chapterCount}`);
  }
  if (opts?.readingComplexity) {
    parts.push(`Reading complexity level: ${opts.readingComplexity}`);
  }
  if (opts?.vocabularyComplexity) {
    parts.push(`Vocabulary complexity: ${opts.vocabularyComplexity}`);
  }
  if (opts?.plot) parts.push(`Plot outline: ${opts.plot}`);

  parts.push(`Story request: ${userRequest}`);

  return parts.join('\n');
}

export async function generateStory(options: GenerateOptions): Promise<string> {
  const { systemPrompt, userRequest, storyOptions, apiBaseUrl, model, localModelId } = options;
  const apiKey = process.env.OPENAI_API_KEY;

  const userMessage = buildUserMessage(userRequest, storyOptions);

  const chapterCount = storyOptions?.chapterCount ?? 1;
  // Rough token budget: ~300 words (~420 tokens) per chapter
  const maxTokens = Math.min(4000, Math.max(600, chapterCount * 420));

  // ── Local .safetensors model (highest priority) ──────────────────────────
  if (localModelId) {
    const { generateWithLocalModel } = await import('./local-model');
    const prompt = `${systemPrompt}\n\n${userMessage}`;
    return generateWithLocalModel(localModelId, prompt, maxTokens);
  }

  // ── External API (OpenAI or compatible) ─────────────────────────────────
  if (!apiKey && !apiBaseUrl) {
    await new Promise((r) => setTimeout(r, 800));
    return `Once upon a time in a land far away, there was a great adventure waiting to unfold. [This is a demo story since no API key is configured. Your request was: "${userRequest}"] The end.`;
  }

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({
    apiKey: apiKey ?? 'no-key',
    ...(apiBaseUrl ? { baseURL: apiBaseUrl } : {}),
  });

  const response = await client.chat.completions.create({
    model: model ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content ?? 'Story generation failed.';
}
