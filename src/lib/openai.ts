import type { StoryOptions } from './storage';

/**
 * Admin-controlled content maturity descriptions injected into the system
 * prompt to restrict or allow themes in generated stories.
 */
const MATURITY_INSTRUCTIONS: Record<number, string> = {
  1: 'Write extremely safe, gentle content appropriate for very young children (ages 3–5). Use only uplifting, happy themes. Avoid all conflict, threats, scary imagery, or negative emotions.',
  2: 'Write child-safe content appropriate for ages 6–10. Mild conflict is acceptable but must resolve happily. Avoid violence, frightening themes, romance, or any adult topics.',
  3: 'Write content appropriate for preteens (ages 10–13). Adventure and mild tension are acceptable. Avoid graphic violence, romantic content, or mature themes.',
  4: 'Write content appropriate for teenagers (ages 13–17). Relatable teen themes, mild conflict, and light friendship/romance are acceptable. Avoid graphic violence, explicit content, or adult themes.',
  5: 'Write content appropriate for young adults (ages 16+). Complex themes, moral ambiguity, and mature storylines are acceptable. Avoid explicit sexual content or graphic gore.',
};

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
  /**
   * Admin-set content maturity level (1–5).  Appended to the system prompt
   * to guide the model toward age-appropriate content.
   * Defaults to 2 (child-safe) when not provided.
   */
  contentMaturityLevel?: number;
}

function buildUserMessage(userRequest: string, opts?: StoryOptions): string {
  const parts: string[] = [];

  if (opts?.title) parts.push(`Title: ${opts.title}`);
  if (opts?.genre) parts.push(`Genre: ${opts.genre}`);
  if (opts?.chapterCount && opts.chapterCount > 1) {
    parts.push(`Number of chapters: ${opts.chapterCount}`);
  }
  if (opts?.readingLevel) {
    parts.push(`Reading level: ${opts.readingLevel}`);
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
  const { systemPrompt, userRequest, storyOptions, apiBaseUrl, model, localModelId, contentMaturityLevel } = options;
  const apiKey = process.env.OPENAI_API_KEY;

  const userMessage = buildUserMessage(userRequest, storyOptions);

  const level = contentMaturityLevel !== undefined && contentMaturityLevel >= 1 && contentMaturityLevel <= 5
    ? contentMaturityLevel
    : 2;
  const maturityInstruction = MATURITY_INSTRUCTIONS[level];
  const effectiveSystemPrompt = `${systemPrompt}\n\nContent safety: ${maturityInstruction}`;

  const chapterCount = storyOptions?.chapterCount ?? 1;
  // Allow unrestricted token output — ~420 tokens (~300 words) per chapter
  const maxTokens = Math.max(600, chapterCount * 420);

  // ── Local .safetensors model (highest priority) ──────────────────────────
  if (localModelId) {
    const { generateWithLocalModel } = await import('./local-model');
    const prompt = `${effectiveSystemPrompt}\n\n${userMessage}`;
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
      { role: 'system', content: effectiveSystemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content ?? 'Story generation failed.';
}
