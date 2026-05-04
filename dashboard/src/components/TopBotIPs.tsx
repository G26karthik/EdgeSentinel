import { AlertTriangle } from 'lucide-react';

interface BotIP {
  ip: string;
  hits: number;
}

export default function TopBotIPs({ data }: { data: BotIP[] }) {
  const maxHits = data.length > 0 ? data[0].hits : 1;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Top Bot IPs</h2>
      {data.length === 0 ? (
        <p className="text-slate-500 text-sm py-12 text-center">No bot IPs detected</p>
      ) : (
        <div className="space-y-3">
          {data.map((entry, i) => (
            <div key={i} className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-mono text-sm text-slate-300 w-36 shrink-0">{entry.ip}</span>
              <div className="flex-1 bg-slate-700/30 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-red-400/80 h-full rounded-full transition-all"
                  style={{ width: `${(entry.hits / maxHits) * 100}%` }}
                />
              </div>
              <span className="text-sm text-slate-400 tabular-nums w-12 text-right">
                {entry.hits}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
