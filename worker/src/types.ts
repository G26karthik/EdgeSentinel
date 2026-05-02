export interface Env {
  KV: KVNamespace;
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  RATE_LIMITER: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  BOT_SCORE_THRESHOLD: string;
  RATE_LIMIT_RPM: string;
  AI_GATEWAY_ENDPOINT: string;
}

export interface RequestSignals {
  ip: string;
  country: string;
  userAgent: string;
  path: string;
  hasAcceptLang: boolean;
  hasReferer: boolean;
  rate: number;
  hasTLS: boolean;
  headers: Record<string, string>;
}

export interface ClassificationResult {
  score: number;
  class: 'LEGITIMATE' | 'SUSPICIOUS' | 'BOT';
  source: 'CACHE' | 'HEURISTIC' | 'AI' | 'VECTOR';
  reason?: string;
}

export interface IPReputation {
  score: number;
  class: 'LEGITIMATE' | 'SUSPICIOUS' | 'BOT';
  hits: number;
  last_seen: number;
}

export interface AnalyticsResponse {
  total: number;
  breakdown: { LEGITIMATE: number; SUSPICIOUS: number; BOT: number };
  topBotIPs: { ip: string; hits: number }[];
  byCountry: { country: string; bot: number; legit: number }[];
  timeline: { hour: number; bot: number; legit: number }[];
}
