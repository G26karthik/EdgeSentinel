import { Env, RequestSignals, ClassificationResult, IPReputation } from './types';
import { extractSignals, minuteBucket } from './signals';
import { scoreHeuristics, classifyWithAI, classifyWithOpenAI, isLowConfidence } from './classifier';
import { getIPReputation, setIPReputation } from './kv';
import { logRequest, getAnalytics } from './db';
import { checkVectorFingerprint, upsertBehaviorVector } from './vectorize';

export { RateLimiter } from './rate-limiter';

function applyDecision(
  request: Request,
  result: ClassificationResult,
  originResponse?: Response
): Response {
  if (result.class === 'BOT') {
    return new Response(
      JSON.stringify({
        error: 'Access denied',
        reason: 'Request classified as automated bot traffic.',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-EdgeSentinel-Score': result.score.toFixed(2),
          'X-EdgeSentinel-Class': result.class,
          'X-EdgeSentinel-Source': result.source,
        },
      }
    );
  }

  const headers = new Headers(originResponse?.headers || {});
  headers.set('X-EdgeSentinel-Score', result.score.toFixed(2));
  headers.set('X-EdgeSentinel-Class', result.class);
  headers.set('X-EdgeSentinel-Source', result.source);

  if (result.class === 'SUSPICIOUS') {
    headers.set('X-EdgeSentinel-Warning', 'Request flagged as suspicious');
  }

  if (originResponse) {
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });
  }

  return new Response(JSON.stringify({ status: 'ok', classification: result }), {
    status: 200,
    headers,
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function getRateFromDO(env: Env, ip: string, bucket: number): Promise<number> {
  const id = env.RATE_LIMITER.idFromName(ip);
  const stub = env.RATE_LIMITER.get(id);
  const res = await stub.fetch(`http://do/increment?bucket=${bucket}`);
  const data = await res.json() as { count: number };
  return data.count;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Analytics API endpoint
    if (url.pathname === '/analytics') {
      const range = url.searchParams.get('range') || '24h';
      const hours = parseInt(range.replace('h', ''), 10) || 24;
      const data = await getAnalytics(env, hours);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'healthy', timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Main classification logic
    const signals = extractSignals(request);

    // 1. Atomic rate check via Durable Object
    const bucket = minuteBucket();
    const currentRate = await getRateFromDO(env, signals.ip, bucket);
    signals.rate = currentRate;

    // 2. Check IP reputation cache
    const cached = await getIPReputation(env, signals.ip);
    if (cached) {
      const result: ClassificationResult = {
        score: cached.score,
        class: cached.class,
        source: 'CACHE',
      };
      ctx.waitUntil(
        setIPReputation(env, signals.ip, {
          ...cached,
          hits: cached.hits + 1,
          last_seen: Date.now(),
        })
      );
      ctx.waitUntil(logRequest(env, signals, result));
      return applyDecision(request, result);
    }

    // 3. Vectorize behavioral fingerprint check
    const vectorResult = await checkVectorFingerprint(env, signals);
    if (vectorResult) {
      ctx.waitUntil(cacheAndLog(env, signals, vectorResult));
      return applyDecision(request, vectorResult);
    }

    // 4. Heuristic scoring
    const heuristicScore = scoreHeuristics(signals);

    // 5. If heuristic is decisive (>= 70), skip AI
    if (heuristicScore >= 70) {
      const result: ClassificationResult = {
        score: heuristicScore / 100,
        class: 'BOT',
        source: 'HEURISTIC',
      };
      ctx.waitUntil(cacheAndLog(env, signals, result));
      return applyDecision(request, result);
    }

    // 6. Workers AI classification (via AI Gateway)
    let aiResult = await classifyWithAI(env, signals);

    // 7. If low confidence (0.4–0.6), escalate to OpenAI GPT-4o
    if (isLowConfidence(aiResult) && env.OPENAI_API_KEY) {
      const openaiResult = await classifyWithOpenAI(env, signals);
      if (!isLowConfidence(openaiResult)) {
        aiResult = openaiResult;
      }
    }

    // 8. Cache + log + upsert vector async (non-blocking)
    ctx.waitUntil(cacheAndLog(env, signals, aiResult));
    ctx.waitUntil(upsertBehaviorVector(env, signals, aiResult));

    return applyDecision(request, aiResult);
  },
};

async function cacheAndLog(
  env: Env,
  signals: RequestSignals,
  result: ClassificationResult
): Promise<void> {
  const reputation: IPReputation = {
    score: result.score,
    class: result.class,
    hits: 1,
    last_seen: Date.now(),
  };
  await Promise.all([
    setIPReputation(env, signals.ip, reputation),
    logRequest(env, signals, result),
  ]);
}
