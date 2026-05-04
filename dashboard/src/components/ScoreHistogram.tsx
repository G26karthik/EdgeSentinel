import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface TimelineEntry {
  hour: number;
  bot: number;
  legit: number;
}

export default function ScoreHistogram({ data }: { data: TimelineEntry[] }) {
  const chartData = data.map((d) => ({
    hour: `${d.hour}:00`,
    Bot: d.bot,
    Legitimate: d.legit,
  }));

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Request Timeline</h2>
      {chartData.length === 0 ? (
        <p className="text-slate-500 text-sm py-12 text-center">No data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
            />
            <Bar dataKey="Legitimate" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Bot" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
