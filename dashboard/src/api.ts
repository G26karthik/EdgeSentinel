const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

export interface AnalyticsData {
  total: number;
  breakdown: { LEGITIMATE: number; SUSPICIOUS: number; BOT: number };
  sourceBreakdown: { CACHE: number; HEURISTIC: number; AI: number; VECTOR: number };
  topBotIPs: { ip: string; hits: number }[];
  byCountry: { country: string; bot: number; legit: number }[];
  timeline: { hour: number; bot: number; legit: number }[];
  recent: {
    ip: string;
    country: string;
    path: string;
    user_agent: string;
    score: number;
    class: string;
    source: string;
    timestamp: number;
  }[];
}

export async function fetchAnalytics(range = '24h'): Promise<AnalyticsData> {
  const res = await fetch(`${WORKER_URL}/analytics?range=${range}`);
  if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
  return res.json();
}
