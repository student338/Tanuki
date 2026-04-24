/**
 * Local model inference using @huggingface/transformers.
 *
 * Supports any text-generation model whose weights are stored in the
 * .safetensors format — either on the HuggingFace Hub (referenced by model ID)
 * or in a local directory on the server (referenced by an absolute path).
 *
 * The loaded pipeline is cached in memory so the model is only initialised once
 * per process, not on every story request.
 */

interface PipelineOutput {
  generated_text?: string | Array<{ role: string; content: string }>;
}

interface PipelineCache {
  modelId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipe: (input: string, opts: Record<string, unknown>) => Promise<any>;
}

let pipelineCache: PipelineCache | null = null;

/**
 * Generate story text using a locally-loaded .safetensors model.
 *
 * @param modelId   HuggingFace model ID (e.g. "facebook/opt-125m") or the
 *                  absolute path to a local directory containing safetensors
 *                  model files (e.g. "/data/models/my-llm").
 * @param prompt    The fully-formatted text prompt to pass to the model.
 * @param maxNewTokens  Maximum number of new tokens to generate.
 */
export async function generateWithLocalModel(
  modelId: string,
  prompt: string,
  maxNewTokens: number,
): Promise<string> {
  const { pipeline, env } = await import('@huggingface/transformers');

  // When the caller provides a file-system path, disable remote fetching so the
  // library resolves the model from disk only.
  const isLocalPath = modelId.startsWith('/') || modelId.startsWith('./') || modelId.startsWith('../');
  if (isLocalPath) {
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
  }

  // Reload the pipeline whenever the configured model changes.
  if (pipelineCache?.modelId !== modelId) {
    pipelineCache = null;
  }

  if (!pipelineCache) {
    const pipe = await pipeline('text-generation', modelId);
    pipelineCache = {
      modelId,
      pipe: pipe as PipelineCache['pipe'],
    };
  }

  const rawOutput: PipelineOutput[] = await pipelineCache.pipe(prompt, {
    max_new_tokens: maxNewTokens,
    do_sample: true,
    temperature: 0.7,
    repetition_penalty: 1.1,
  });

  if (!Array.isArray(rawOutput) || rawOutput.length === 0) {
    return 'Story generation failed.';
  }

  const generatedText = rawOutput[0].generated_text;

  if (typeof generatedText === 'string') {
    // Strip the input prompt from the output (some models echo it back).
    return generatedText.startsWith(prompt)
      ? generatedText.slice(prompt.length).trim()
      : generatedText.trim();
  }

  // Chat-template models return the full messages array; extract the last
  // assistant turn.
  if (Array.isArray(generatedText)) {
    const lastMsg = generatedText[generatedText.length - 1];
    if (lastMsg?.role === 'assistant' && typeof lastMsg.content === 'string') {
      return lastMsg.content.trim();
    }
  }

  return 'Story generation failed.';
}
