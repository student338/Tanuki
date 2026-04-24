export async function generateStory(systemPrompt: string, userRequest: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 800));
    return `Once upon a time in a land far away, there was a great adventure waiting to unfold. [This is a demo story since no API key is configured. Your request was: "${userRequest}"] The end.`;
  }

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userRequest },
    ],
    max_tokens: 600,
  });

  return response.choices[0]?.message?.content ?? 'Story generation failed.';
}
