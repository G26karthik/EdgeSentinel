import { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, Clock } from 'lucide-react';
import { fetchAnalytics } from './api';
import type { AnalyticsData } from './api';
import ClassificationFeed from './components/ClassificationFeed';
import ScoreHistogram from './components/ScoreHistogram';
import ThreatMap from './components/ThreatMap';
import TopBotIPs from './components/TopBotIPs';

const RANGES = ['1h', '6h', '24h', '72h'] as const;

function App() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<string>('24h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalytics(range);
      setData(result);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await load();
    };
    run();
    const interval = setInterval(run, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-orange-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">EdgeSentinel</h1>
            <span className="text-xs bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded-full font-medium">
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Time range selector */}
            <div className="flex bg-slate-800 rounded-lg p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    range === r
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {lastUpdated && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <SummaryCard label="Total Requests" value={data.total} color="text-slate-100" />
              <SummaryCard label="Legitimate" value={data.breakdown.LEGITIMATE} color="text-emerald-400" />
              <SummaryCard label="Suspicious" value={data.breakdown.SUSPICIOUS} color="text-amber-400" />
              <SummaryCard label="Bot" value={data.breakdown.BOT} color="text-red-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <SummaryCard label="Via Cache" value={data.sourceBreakdown?.CACHE ?? 0} color="text-blue-400" />
              <SummaryCard label="Via Heuristic" value={data.sourceBreakdown?.HEURISTIC ?? 0} color="text-purple-400" />
              <SummaryCard label="Via AI" value={data.sourceBreakdown?.AI ?? 0} color="text-cyan-400" />
              <SummaryCard label="Via Vector" value={data.sourceBreakdown?.VECTOR ?? 0} color="text-pink-400" />
            </div>
          </>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScoreHistogram data={data?.timeline ?? []} />
          <ThreatMap data={data?.byCountry ?? []} />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClassificationFeed data={data?.recent ?? []} />
          <TopBotIPs data={data?.topBotIPs ?? []} />
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default App;
