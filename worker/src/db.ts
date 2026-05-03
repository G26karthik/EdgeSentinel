import { Env, RequestSignals, ClassificationResult } from './types';

export async function logRequest(
  env: Env,
  signals: RequestSignals,
  result: ClassificationResult
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO requests (ip, country, path, user_agent, score, class, source, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      signals.ip,
      signals.country,
      signals.path,
      signals.userAgent,
      result.score,
      result.class,
      result.source,
      Date.now()
    )
    .run();
}

export async function getAnalytics(env: Env, rangeHours: number) {
  const since = Date.now() - rangeHours * 60 * 60 * 1000;

  const totalResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM requests WHERE timestamp > ?`
  ).bind(since).first<{ total: number }>();

  const breakdownResult = await env.DB.prepare(
    `SELECT class, COUNT(*) as count FROM requests WHERE timestamp > ? GROUP BY class`
  ).bind(since).all();

  const sourceBreakdownResult = await env.DB.prepare(
    `SELECT source, COUNT(*) as count FROM requests WHERE timestamp > ? GROUP BY source`
  ).bind(since).all();

  const topBotResult = await env.DB.prepare(
    `SELECT ip, COUNT(*) as hits FROM requests WHERE timestamp > ? AND class = 'BOT' GROUP BY ip ORDER BY hits DESC LIMIT 10`
  ).bind(since).all();

  const byCountryResult = await env.DB.prepare(
    `SELECT country,
       SUM(CASE WHEN class = 'BOT' THEN 1 ELSE 0 END) as bot,
       SUM(CASE WHEN class = 'LEGITIMATE' THEN 1 ELSE 0 END) as legit
     FROM requests WHERE timestamp > ? GROUP BY country ORDER BY bot DESC LIMIT 20`
  ).bind(since).all();

  const timelineResult = await env.DB.prepare(
    `SELECT (timestamp / 3600000) % 24 as hour,
       SUM(CASE WHEN class = 'BOT' THEN 1 ELSE 0 END) as bot,
       SUM(CASE WHEN class = 'LEGITIMATE' THEN 1 ELSE 0 END) as legit
     FROM requests WHERE timestamp > ? GROUP BY hour ORDER BY hour`
  ).bind(since).all();

  const recentResult = await env.DB.prepare(
    `SELECT ip, country, path, user_agent, score, class, source, timestamp
     FROM requests ORDER BY timestamp DESC LIMIT 50`
  ).all();

  const breakdown: Record<string, number> = { LEGITIMATE: 0, SUSPICIOUS: 0, BOT: 0 };
  for (const row of breakdownResult.results) {
    breakdown[row.class as string] = row.count as number;
  }

  const sourceBreakdown: Record<string, number> = { CACHE: 0, HEURISTIC: 0, AI: 0, VECTOR: 0 };
  for (const row of sourceBreakdownResult.results) {
    sourceBreakdown[row.source as string] = row.count as number;
  }

  return {
    total: totalResult?.total ?? 0,
    breakdown,
    sourceBreakdown,
    topBotIPs: topBotResult.results.map((r) => ({ ip: r.ip as string, hits: r.hits as number })),
    byCountry: byCountryResult.results.map((r) => ({
      country: r.country as string,
      bot: r.bot as number,
      legit: r.legit as number,
    })),
    timeline: timelineResult.results.map((r) => ({
      hour: r.hour as number,
      bot: r.bot as number,
      legit: r.legit as number,
    })),
    recent: recentResult.results,
  };
}
