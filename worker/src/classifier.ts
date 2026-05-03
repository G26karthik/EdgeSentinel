import { Env, RequestSignals, ClassificationResult } from './types';

const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
  /python-requests/i, /httpie/i, /postman/i, /go-http/i,
  /java\//i, /php\//i, /ruby/i, /axios/i, /node-fetch/i,
];

const SUSPICIOUS_PATHS = [
  /\/wp-admin/i, /\/wp-login/i, /\/xmlrpc/i, /\/\.env/i,
  /\/\.git/i, /\/phpmyadmin/i, /\/admin/i, /\/backup/i,
  /\/config/i, /\/\.aws/i, /\/actuator/i,
];

export function scoreHeuristics(signals: RequestSignals): number {
  let score = 0;

  // Known bot user-agent
  if (BOT_UA_PATTERNS.some((p) => p.test(signals.userAgent))) {
    score += 50;
  }

  // Empty user-agent is very suspicious
  if (!signals.userAgent) {
    score += 40;
  }

  // Missing Accept-Language header
  if (!signals.hasAcceptLang) {
    score += 20;
  }

  // Suspicious path patterns
  if (SUSPICIOUS_PATHS.some((p) => p.test(signals.path))) {
    score += 30;
  }

  // High request rate
  const rateLimit = 60;
  if (signals.rate > rateLimit) {
    score += 40;
  } else if (signals.rate > rateLimit / 2) {
    score += 20;
  }

  // No referer + no accept-language combo
  if (!signals.hasReferer && !signals.hasAcceptLang) {
    score += 10;
  }

  return Math.min(score, 100);
}

function buildPrompt(signals: RequestSignals): string {
  return `You are a bot detection system. Analyze this HTTP request and classify it.

Request signals:
- IP: ${signals.ip}
- Country: ${signals.country}
- User-Agent: "${signals.userAgent}"
- Path: "${signals.path}"
- Has Accept-Language header: ${signals.hasAcceptLang}
- Has Referer: ${signals.hasReferer}
- Requests this minute: ${signals.rate}
- TLS fingerprint present: ${signals.hasTLS}

Respond with ONLY valid JSON, no explanation:
{
  "class": "LEGITIMATE" | "SUSPICIOUS" | "BOT",
  "score": <float 0.0 to 1.0, where 1.0 = definitely bot>,
  "reason": "<one short sentence>"
}`;
}

function parseClassificationResponse(text: string): ClassificationResult | null {
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    const validClasses = ['LEGITIMATE', 'SUSPICIOUS', 'BOT'];
    const cls = validClasses.includes(parsed.class) ? parsed.class : 'SUSPICIOUS';
    const score = typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : 0.5;

    return {
      score,
      class: cls as ClassificationResult['class'],
      source: 'AI',
      reason: parsed.reason || '',
    };
  }
  return null;
}

export async function classifyWithAI(
  env: Env,
  signals: RequestSignals
): Promise<ClassificationResult> {
  const prompt = buildPrompt(signals);

  try {
    // Route through AI Gateway for caching, retries, and observability
    const response = await env.AI.run(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
      },
      { gateway: { id: 'edgesentinel-gateway' } }
    ) as { response?: string };

    const text = response.response || '';
    const result = parseClassificationResponse(text);
    if (result) {
      return result;
    }
  } catch (e) {
    // Fallback if Workers AI fails
  }

  // Default fallback
  return {
    score: 0.5,
    class: 'SUSPICIOUS',
    source: 'AI',
    reason: 'AI classification unavailable, defaulting to suspicious',
  };
}

export async function classifyWithOpenAI(
  env: Env,
  signals: RequestSignals
): Promise<ClassificationResult> {
  const prompt = buildPrompt(signals);
  const gatewayEndpoint = env.AI_GATEWAY_ENDPOINT;

  try {
    const response = await fetch(`${gatewayEndpoint}/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (response.ok) {
      const data = await response.json() as {
        choices: { message: { content: string } }[];
      };
      const text = data.choices?.[0]?.message?.content || '';
      const result = parseClassificationResponse(text);
      if (result) {
        return result;
      }
    }
  } catch (e) {
    // OpenAI fallback failed
  }

  return {
    score: 0.5,
    class: 'SUSPICIOUS',
    source: 'AI',
    reason: 'OpenAI fallback unavailable, defaulting to suspicious',
  };
}

export function isLowConfidence(result: ClassificationResult): boolean {
  return result.score >= 0.4 && result.score <= 0.6;
}
