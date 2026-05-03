import { DurableObject } from 'cloudflare:workers';

interface RateWindow {
  count: number;
  expiry: number;
}

export class RateLimiter extends DurableObject {
  private windows: Map<string, RateWindow> = new Map();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname;

    if (action === '/increment') {
      const bucket = url.searchParams.get('bucket') || '0';
      const key = bucket;
      const now = Date.now();

      let window = this.windows.get(key);

      // Expire stale windows (2 minutes)
      if (window && window.expiry < now) {
        this.windows.delete(key);
        window = undefined;
      }

      if (!window) {
        window = { count: 0, expiry: now + 120_000 };
      }

      window.count += 1;
      this.windows.set(key, window);

      return new Response(JSON.stringify({ count: window.count }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === '/get') {
      const bucket = url.searchParams.get('bucket') || '0';
      const window = this.windows.get(bucket);
      const now = Date.now();

      if (window && window.expiry >= now) {
        return new Response(JSON.stringify({ count: window.count }));
      }
      return new Response(JSON.stringify({ count: 0 }));
    }

    // Cleanup expired windows periodically
    if (action === '/cleanup') {
      const now = Date.now();
      for (const [key, window] of this.windows) {
        if (window.expiry < now) {
          this.windows.delete(key);
        }
      }
      return new Response('ok');
    }

    return new Response('Not found', { status: 404 });
  }
}
