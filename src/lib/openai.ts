import type { StoryOptions, StoryPlan } from './storage';
import { MATURITY_LEVEL_DEFAULT } from './safety';

/**
 * Admin-controlled content maturity descriptions injected into the system
 * prompt to restrict or allow themes in generated stories.
 * Level 6 (None) intentionally has no entry — no safety clause is added.
 */
const MATURITY_INSTRUCTIONS: Record<number, string> = {
  1: 'Write extremely safe, gentle content appropriate for very young children (ages 3-5). Use only uplifting, happy themes. Avoid all conflict, threats, scary imagery, or negative emotions.',
  2: 'Write child-safe content appropriate for ages 6-10. Mild conflict is acceptable but must resolve happily. Avoid violence, frightening themes, romance, or any adult topics.',
  3: 'Write content appropriate for preteens (ages 10-13). Adventure and mild tension are acceptable. Avoid graphic violence, romantic content, or mature themes.',
  4: 'Write content appropriate for teenagers (ages 13-17). Relatable teen themes, mild conflict, and light friendship/romance are acceptable. Avoid graphic violence, explicit content, or adult themes.',
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
   * Admin-set content maturity level (1–6).  Appended to the system prompt
   * to guide the model toward age-appropriate content.
   * Level 6 = "None" (no safety clause added).
   * Defaults to 2 (child-safe) when not provided.
   */
  contentMaturityLevel?: number;
  /**
   * Topics to explicitly exclude from the generated story.
   * Accumulated from global, classroom, and per-student settings.
   */
  blockedTopics?: string[];
  /**
   * Optional text extracted from a base story or uploaded PDF.
   * Injected into the prompt so the generated story is inspired by or
   * continues the source material.
   */
  baseStoryContext?: string;
  /**
   * When true, switches generation from fiction to nonfiction ("Info Mode").
   * The system prompt and user message are adjusted so the model writes a
   * factual article / report rather than a story.
   */
  infoMode?: boolean;
  /**
   * Factual context gathered from the local knowledge base and/or web search.
   * Injected into the prompt when infoMode is true so the model grounds its
   * response in real information.
   */
  knowledgeContext?: string;
  /** Pre-approved story plan to include in the generation prompt. */
  plan?: StoryPlan;
  /** 0-based index of the chapter being generated (for chapter-by-chapter mode). */
  chapterIndex?: number;
  /** Previously generated chapters, for context when writing subsequent chapters. */
  previousChapters?: string[];
  /** Optional student revision note for the current chapter. */
  revisionNote?: string;
}

export interface PlanOptions {
  systemPrompt: string;
  userRequest: string;
  storyOptions?: StoryOptions;
  apiBaseUrl?: string;
  model?: string;
  localModelId?: string;
  contentMaturityLevel?: number;
  blockedTopics?: string[];
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

function buildInfoUserMessage(userRequest: string, knowledgeContext: string | undefined, opts?: StoryOptions): string {
  const parts: string[] = [];

  if (opts?.title) parts.push(`Title: ${opts.title}`);
  if (opts?.chapterCount && opts.chapterCount > 1) {
    parts.push(`Number of sections: ${opts.chapterCount}`);
  }
  if (opts?.readingLevel) parts.push(`Reading level: ${opts.readingLevel}`);
  if (opts?.readingComplexity) parts.push(`Reading complexity level: ${opts.readingComplexity}`);
  if (opts?.vocabularyComplexity) parts.push(`Vocabulary complexity: ${opts.vocabularyComplexity}`);

  if (knowledgeContext && knowledgeContext.trim()) {
    parts.push(`Reference information:\n${knowledgeContext.trim()}`);
  }

  parts.push(`Topic: ${userRequest}`);

  return parts.join('\n\n');
}

export async function generateStory(options: GenerateOptions): Promise<string> {
  const { systemPrompt, userRequest, storyOptions, apiBaseUrl, model, localModelId, contentMaturityLevel, blockedTopics, infoMode, knowledgeContext } = options;
  const apiKey = process.env.OPENAI_API_KEY;

  const userMessage = infoMode
    ? buildInfoUserMessage(userRequest, knowledgeContext, storyOptions)
    : buildUserMessage(userRequest, storyOptions);

  // Build effective system prompt with maturity and topic-blocking clauses
  const basePrompt = infoMode
    ? 'You are a knowledgeable nonfiction writer. Write an accurate, engaging, well-structured nonfiction article or report based on the provided topic and reference information. Use only factual information — do not invent facts. Structure the writing clearly with an introduction, body sections, and a conclusion.'
    : systemPrompt;

  const promptParts: string[] = [basePrompt];

  if (!infoMode) {
    promptParts.push('Write only the narrative text of the story — do not begin with phrases like "Here is your story:", "Sure!", "Certainly!", or any other preamble. Start directly with the story content.');
  }

  const level = contentMaturityLevel !== undefined && contentMaturityLevel >= 1 && contentMaturityLevel <= 6
    ? contentMaturityLevel
    : MATURITY_LEVEL_DEFAULT;
  const maturityInstruction = MATURITY_INSTRUCTIONS[level]; // undefined for level 6 (None)
  if (maturityInstruction) {
    promptParts.push(`Content safety: ${maturityInstruction}`);
  }

  if (blockedTopics && blockedTopics.length > 0) {
    promptParts.push(`Do not include content about the following topics: ${blockedTopics.join(', ')}.`);
  }

  const effectiveSystemPrompt = promptParts.join('\n\n');

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
    if (infoMode) {
      return `[Demo nonfiction article — no API key configured. Topic: "${userRequest}"]\n\nThis is where a factual, well-researched article about "${userRequest}" would appear. Configure an API key in your .env.local file to enable real generation.`;
    }
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

// ── Planning stage ────────────────────────────────────────────────────────────

const PLAN_SYSTEM_PROMPT = `You are a creative story planner. Given a story request, create a concise five-part story plan in JSON. Return ONLY valid JSON with exactly these keys: "exposition", "risingAction", "climax", "fallingAction", "resolution". Each value should be 1-3 sentences summarising that narrative beat. Do not include any other text outside the JSON object.`;

/** Generate a five-part story plan for the given request. */
export async function planStory(options: PlanOptions): Promise<StoryPlan> {
  const { userRequest, storyOptions, apiBaseUrl, model, localModelId, contentMaturityLevel, blockedTopics } = options;
  const apiKey = process.env.OPENAI_API_KEY;

  const parts: string[] = [PLAN_SYSTEM_PROMPT];

  const level = contentMaturityLevel !== undefined && contentMaturityLevel >= 1 && contentMaturityLevel <= 6
    ? contentMaturityLevel
    : MATURITY_LEVEL_DEFAULT;
  const maturityInstruction = MATURITY_INSTRUCTIONS[level];
  if (maturityInstruction) parts.push(`Content safety: ${maturityInstruction}`);
  if (blockedTopics && blockedTopics.length > 0) {
    parts.push(`Do not include content about the following topics: ${blockedTopics.join(', ')}.`);
  }

  const systemPrompt = parts.join('\n\n');
  const userMessage = buildUserMessage(userRequest, storyOptions);

  const demoPlan: StoryPlan = {
    exposition: `We are introduced to the main character and the world of "${userRequest}".`,
    risingAction: 'The protagonist faces a growing challenge that tests their courage and resolve.',
    climax: 'The tension reaches its peak in a dramatic confrontation or turning point.',
    fallingAction: 'The aftermath of the climax unfolds as the character begins to heal or rebuild.',
    resolution: 'Peace is restored and the character emerges transformed by their journey.',
  };

  if (!apiKey && !apiBaseUrl) {
    await new Promise((r) => setTimeout(r, 500));
    return demoPlan;
  }

  if (localModelId) {
    const { generateWithLocalModel } = await import('./local-model');
    const prompt = `${systemPrompt}\n\n${userMessage}`;
    const raw = await generateWithLocalModel(localModelId, prompt, 400);
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as StoryPlan;
    } catch { /* fall through to demo */ }
    return demoPlan;
  }

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({
    apiKey: apiKey ?? 'no-key',
    ...(apiBaseUrl ? { baseURL: apiBaseUrl } : {}),
  });

  try {
    const response = await client.chat.completions.create({
      model: model ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 500,
    });
    const raw = response.choices[0]?.message?.content ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as StoryPlan;
  } catch { /* fall through to demo */ }
  return demoPlan;
}

// ── Chapter streaming ─────────────────────────────────────────────────────────

function buildChapterUserMessage(
  userRequest: string,
  opts: StoryOptions | undefined,
  plan: StoryPlan,
  chapterIndex: number,
  totalChapters: number,
  previousChapters: string[],
  revisionNote: string | undefined,
): string {
  const parts: string[] = [];

  if (opts?.title) parts.push(`Story title: ${opts.title}`);
  if (opts?.genre) parts.push(`Genre: ${opts.genre}`);
  if (opts?.readingLevel) parts.push(`Reading level: ${opts.readingLevel}`);
  if (opts?.readingComplexity) parts.push(`Reading complexity: ${opts.readingComplexity}`);
  if (opts?.vocabularyComplexity) parts.push(`Vocabulary complexity: ${opts.vocabularyComplexity}`);

  parts.push(`Story request: ${userRequest}`);
  parts.push(`\nStory plan:\n- Exposition: ${plan.exposition}\n- Rising Action: ${plan.risingAction}\n- Climax: ${plan.climax}\n- Falling Action: ${plan.fallingAction}\n- Resolution: ${plan.resolution}`);

  if (previousChapters.length > 0) {
    const recent = previousChapters.slice(-2);
    parts.push(`\nPrevious chapter(s):\n${recent.map((c, i) => `Chapter ${chapterIndex - recent.length + i + 1}:\n${c}`).join('\n\n')}`);
  }

  parts.push(`\nNow write Chapter ${chapterIndex + 1} of ${totalChapters}.`);
  if (revisionNote) {
    parts.push(`The student has a revision request for this chapter: ${revisionNote}`);
  }

  return parts.join('\n');
}

/**
 * Stream a single chapter as an async generator of text deltas.
 * Yields string fragments as they arrive from the model.
 */
export async function* generateChapterStream(
  options: GenerateOptions & { plan: StoryPlan; chapterIndex: number },
): AsyncGenerator<string> {
  const {
    systemPrompt,
    userRequest,
    storyOptions,
    apiBaseUrl,
    model,
    localModelId,
    contentMaturityLevel,
    blockedTopics,
    plan,
    chapterIndex,
    previousChapters = [],
    revisionNote,
  } = options;
  const apiKey = process.env.OPENAI_API_KEY;

  const totalChapters = storyOptions?.chapterCount ?? 1;

  const promptParts: string[] = [
    systemPrompt || 'You are a creative story writer. Write an engaging, age-appropriate story chapter.',
    'Write only the prose content of the chapter — no headings, no labels, just the narrative text.',
  ];

  const level = contentMaturityLevel !== undefined && contentMaturityLevel >= 1 && contentMaturityLevel <= 6
    ? contentMaturityLevel
    : MATURITY_LEVEL_DEFAULT;
  const maturityInstruction = MATURITY_INSTRUCTIONS[level];
  if (maturityInstruction) promptParts.push(`Content safety: ${maturityInstruction}`);
  if (blockedTopics && blockedTopics.length > 0) {
    promptParts.push(`Do not include content about the following topics: ${blockedTopics.join(', ')}.`);
  }

  const effectiveSystemPrompt = promptParts.join('\n\n');
  const userMessage = buildChapterUserMessage(
    userRequest, storyOptions, plan, chapterIndex, totalChapters, previousChapters, revisionNote,
  );

  const maxTokens = 1200;

  if (!apiKey && !apiBaseUrl) {
    await new Promise((r) => setTimeout(r, 400));
    const demo = `Chapter ${chapterIndex + 1}: Once upon a time, the story continued with great wonder and adventure. [Demo chapter — no API key configured. Configure an API key in your .env.local file to enable real generation.]`;
    for (const char of demo) {
      yield char;
      await new Promise((r) => setTimeout(r, 8));
    }
    return;
  }

  if (localModelId) {
    const { generateWithLocalModel } = await import('./local-model');
    const prompt = `${effectiveSystemPrompt}\n\n${userMessage}`;
    const full = await generateWithLocalModel(localModelId, prompt, maxTokens);
    yield full;
    return;
  }

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({
    apiKey: apiKey ?? 'no-key',
    ...(apiBaseUrl ? { baseURL: apiBaseUrl } : {}),
  });

  const stream = await client.chat.completions.create({
    model: model ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: effectiveSystemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) yield delta;
  }
}

// ── Post-processing ───────────────────────────────────────────────────────────
