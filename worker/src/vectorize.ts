import { Env, RequestSignals, ClassificationResult } from './types';

const SIMILARITY_THRESHOLD = 0.92;

function buildSignalText(signals: RequestSignals): string {
  return [
    `ua:${signals.userAgent}`,
    `path:${signals.path}`,
    `lang:${signals.hasAcceptLang}`,
    `ref:${signals.hasReferer}`,
    `tls:${signals.hasTLS}`,
    `rate:${signals.rate}`,
    `headers:${Object.keys(signals.headers).sort().join(',')}`,
  ].join(' | ');
}

export async function generateEmbedding(
  env: Env,
  signals: RequestSignals
): Promise<number[]> {
  const text = buildSignalText(signals);
  const result = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
    text: [text],
  }) as { data: number[][] };
  return result.data[0];
}

export async function checkVectorFingerprint(
  env: Env,
  signals: RequestSignals
): Promise<ClassificationResult | null> {
  try {
    const embedding = await generateEmbedding(env, signals);

    const matches = await env.VECTORIZE.query(embedding, {
      topK: 3,
      returnMetadata: 'all',
      filter: { class: { $eq: 'BOT' } },
    });

    if (matches.matches && matches.matches.length > 0) {
      const topMatch = matches.matches[0];
      if (topMatch.score && topMatch.score >= SIMILARITY_THRESHOLD) {
        return {
          score: topMatch.score,
          class: 'BOT',
          source: 'VECTOR',
          reason: `Behavioral fingerprint matches known bot pattern (similarity: ${topMatch.score.toFixed(3)})`,
        };
      }
    }
  } catch (e) {
    // Vectorize query failed — fall through to other classification methods
  }

  return null;
}

export async function upsertBehaviorVector(
  env: Env,
  signals: RequestSignals,
  result: ClassificationResult
): Promise<void> {
  try {
    const embedding = await generateEmbedding(env, signals);
    const vectorId = `ip_${signals.ip}_${Date.now()}`;

    await env.VECTORIZE.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata: {
          ip: signals.ip,
          class: result.class,
          score: result.score,
          timestamp: Date.now(),
          country: signals.country,
        },
      },
    ]);
  } catch (e) {
    // Non-critical — don't block the request pipeline
  }
}
