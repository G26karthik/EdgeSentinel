import { Shield, ShieldAlert, Bot, Fingerprint } from 'lucide-react';

interface Request {
  ip: string;
  country: string;
  path: string;
  user_agent: string;
  score: number;
  class: string;
  source: string;
  timestamp: number;
}

const classConfig: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  LEGITIMATE: { icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  SUSPICIOUS: { icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  BOT: { icon: Bot, color: 'text-red-400', bg: 'bg-red-400/10' },
};

const sourceColors: Record<string, string> = {
  CACHE: 'text-blue-400',
  HEURISTIC: 'text-purple-400',
  AI: 'text-cyan-400',
  VECTOR: 'text-pink-400',
};

export default function ClassificationFeed({ data }: { data: Request[] }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Live Classification Feed</h2>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {data.length === 0 && (
          <p className="text-slate-500 text-sm py-8 text-center">No requests logged yet</p>
        )}
        {data.map((req, i) => {
          const cfg = classConfig[req.class] || classConfig.SUSPICIOUS;
          const Icon = req.source === 'VECTOR' ? Fingerprint : cfg.icon;
          const time = new Date(req.timestamp).toLocaleTimeString();
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${cfg.bg} border border-slate-700/30`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-slate-300 truncate">{req.ip}</span>
                  <span className="text-slate-500">{req.country}</span>
                  <span className="text-slate-600 truncate text-xs">{req.path}</span>
                </div>
              </div>
              <span className={`text-xs font-medium ${sourceColors[req.source] || 'text-slate-400'}`}>
                {req.source}
              </span>
              <span className={`text-xs font-semibold ${cfg.color}`}>{req.class}</span>
              <span className="text-xs text-slate-500 tabular-nums">{(req.score * 100).toFixed(0)}%</span>
              <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
