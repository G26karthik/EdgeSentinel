import { Env, IPReputation } from './types';

export async function getIPReputation(env: Env, ip: string): Promise<IPReputation | null> {
  const data = await env.KV.get(`ip_rep:${ip}`, 'json');
  return data as IPReputation | null;
}

export async function setIPReputation(env: Env, ip: string, rep: IPReputation): Promise<void> {
  await env.KV.put(`ip_rep:${ip}`, JSON.stringify(rep), { expirationTtl: 3600 });
}
