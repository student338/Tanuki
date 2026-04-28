/**
 * Web search helper for Info Mode.
 *
 * Uses the DuckDuckGo Instant Answers JSON API, which is free and requires no
 * API key.  It returns an "abstract" (Wikipedia-sourced summary) plus a list
 * of related topics for the query.
 *
 * If a `SEARCH_API_URL` environment variable is set it is used as an
 * OpenSearch-compatible endpoint instead (e.g. a self-hosted SearXNG instance).
 * The variable should point to a URL that accepts `?q=<query>&format=json`.
 */

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: 'duckduckgo' | 'custom';
}

/**
 * Search the web for `query` and return up to `maxResults` results.
 *
 * The function never throws — on network or parse errors it returns an empty
 * array so that Info Mode can still fall back to the local knowledge base.
 */
export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  const customUrl = process.env.SEARCH_API_URL;
  if (customUrl) {
    return searchCustomEndpoint(customUrl, query, maxResults);
  }
  return searchDuckDuckGo(query, maxResults);
}

// ---------------------------------------------------------------------------
// DuckDuckGo Instant Answers
// ---------------------------------------------------------------------------

interface DDGResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
    Topics?: Array<{ Text?: string; FirstURL?: string }>;
  }>;
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Tanuki-InfoMode/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as DDGResponse;
    const results: WebSearchResult[] = [];

    // Primary abstract (usually a Wikipedia summary)
    if (data.AbstractText && data.AbstractText.trim()) {
      results.push({
        title: data.Heading ?? query,
        snippet: data.AbstractText.trim(),
        url: data.AbstractURL ?? `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        source: 'duckduckgo',
      });
    }

    // Related topics
    const related = data.RelatedTopics ?? [];
    for (const topic of related) {
      if (results.length >= maxResults) break;
      // Some entries are sub-groups with a `Topics` array
      const subTopics = topic.Topics ?? [topic];
      for (const sub of subTopics) {
        if (results.length >= maxResults) break;
        if (sub.Text && sub.FirstURL) {
          results.push({
            title: sub.Text.split(' - ')[0]?.trim() ?? sub.Text,
            snippet: sub.Text.trim(),
            url: sub.FirstURL,
            source: 'duckduckgo',
          });
        }
      }
    }

    return results;
  } catch (err) {
    console.error('[web-search] DuckDuckGo search failed:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Custom OpenSearch-compatible endpoint
// ---------------------------------------------------------------------------

interface OpenSearchResponse {
  results?: Array<{ title?: string; content?: string; url?: string }>;
  // SearXNG format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

async function searchCustomEndpoint(
  baseUrl: string,
  query: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  try {
    const url = `${baseUrl}?q=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Tanuki-InfoMode/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as OpenSearchResponse;
    const items: Array<{ title?: string; content?: string; url?: string }> =
      Array.isArray(data.results) ? data.results : [];

    return items.slice(0, maxResults).map((item) => ({
      title: item.title ?? query,
      snippet: item.content ?? '',
      url: item.url ?? baseUrl,
      source: 'custom' as const,
    }));
  } catch (err) {
    console.error('[web-search] Custom endpoint search failed:', err);
    return [];
  }
}
