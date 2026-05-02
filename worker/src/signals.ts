import { RequestSignals } from './types';

export function extractSignals(request: Request): RequestSignals {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const cf = (request as any).cf;

  return {
    ip: headers['cf-connecting-ip'] || headers['x-forwarded-for'] || '0.0.0.0',
    country: cf?.country || headers['cf-ipcountry'] || 'XX',
    userAgent: headers['user-agent'] || '',
    path: url.pathname + url.search,
    hasAcceptLang: !!headers['accept-language'],
    hasReferer: !!headers['referer'],
    rate: 0, // will be filled in by the main handler
    hasTLS: cf?.tlsVersion ? true : false,
    headers,
  };
}

export function minuteBucket(): number {
  return Math.floor(Date.now() / 60000);
}
