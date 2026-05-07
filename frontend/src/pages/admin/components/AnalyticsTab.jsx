import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

export function AnalyticsTab({ dark, analytics, loading, mutedText }) {
  if (loading) return <div className={`py-16 text-center text-sm ${mutedText}`}>Loading analytics...</div>;

  const [range, setRange] = useState('day');
  const timestamps = analytics.reviewTimestamps ?? [];

  const { chartData, subtitle } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let buckets = [];

    if (range === 'day') {
      const days = 30;
      buckets = Array.from({ length: days }).map((_, idx) => {
        const day = new Date(now);
        day.setDate(now.getDate() - (days - 1 - idx));
        day.setHours(0, 0, 0, 0);
        return { label: `${day.getMonth() + 1}/${day.getDate()}`, start: day.getTime(), count: 0 };
      });
    } else if (range === 'week') {
      const weeks = 12;
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      buckets = Array.from({ length: weeks }).map((_, idx) => {
        const start = new Date(end);
        start.setDate(end.getDate() - (weeks - 1 - idx) * 7);
        return { label: `${start.getMonth() + 1}/${start.getDate()}`, start: start.getTime(), count: 0 };
      });
    } else if (range === 'month') {
      const months = 12;
      buckets = Array.from({ length: months }).map((_, idx) => {
        const dt = new Date(now.getFullYear(), now.getMonth() - (months - 1 - idx), 1);
        return { label: `${dt.toLocaleString('en-US', { month: 'short' })} ${String(dt.getFullYear()).slice(2)}`, start: dt.getTime(), count: 0 };
      });
    } else {
      const years = 5;
      buckets = Array.from({ length: years }).map((_, idx) => {
        const dt = new Date(now.getFullYear() - (years - 1 - idx), 0, 1);
        return { label: String(dt.getFullYear()), start: dt.getTime(), count: 0 };
      });
    }

    timestamps.forEach((tsRaw) => {
      const ts = new Date(tsRaw).getTime();
      if (!Number.isFinite(ts)) return;
      const index = buckets.findIndex((b, i) => ts >= b.start && ts < (buckets[i + 1]?.start ?? Number.POSITIVE_INFINITY));
      if (index >= 0) buckets[index].count += 1;
    });

    const nextSubtitle =
      range === 'day'
        ? 'Last 30 days (daily)'
        : range === 'week'
          ? 'Last 12 weeks'
          : range === 'month'
            ? 'Last 12 months'
            : 'Last 5 years';

    return {
      subtitle: nextSubtitle,
      chartData: buckets.map((b) => ({ period: b.label, reviews: b.count })),
    };
  }, [range, timestamps]);

  const options = [
    { id: 'day', label: '30D' },
    { id: 'week', label: 'Weekly' },
    { id: 'month', label: 'Monthly' },
    { id: 'year', label: 'Yearly' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`rounded-2xl border p-4 ${dark ? 'border-white/8 bg-[#161b26]' : 'border-black/8 bg-white'}`}>
          <p className={`text-xs uppercase tracking-wider ${mutedText}`}>Avg Rating</p>
          <p className="mt-1 text-2xl font-bold">{analytics.avgRating.toFixed(2)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${dark ? 'border-white/8 bg-[#161b26]' : 'border-black/8 bg-white'}`}>
          <p className={`text-xs uppercase tracking-wider ${mutedText}`}>Most Reviewed</p>
          <p className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{analytics.mostReviewed?.name || '—'}</p>
          <p className={`text-xs ${mutedText}`}>{analytics.mostReviewed ? `${analytics.mostReviewed.count} reviews` : 'No reviews yet'}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${dark ? 'border-white/8 bg-[#161b26]' : 'border-black/8 bg-white'}`}>
          <p className={`text-xs uppercase tracking-wider ${mutedText}`}>Lowest Rated</p>
          <p className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{analytics.lowestRated?.name || '—'}</p>
          <p className={`text-xs ${mutedText}`}>{analytics.lowestRated ? `${analytics.lowestRated.avg.toFixed(2)} avg` : 'No ratings yet'}</p>
        </div>
      </div>
      <div className={`rounded-2xl border p-4 ${dark ? 'border-white/8 bg-[#161b26]' : 'border-black/8 bg-white'}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Total Reviews Over Time</h3>
          <div className={`inline-flex rounded-xl border p-1 ${dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRange(opt.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  range === opt.id
                    ? dark ? 'bg-[#f5bf3e] text-black' : 'bg-[#D4A017] text-white'
                    : dark ? 'text-white/70 hover:bg-white/10' : 'text-black/60 hover:bg-black/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className={`mb-3 text-xs ${mutedText}`}>{subtitle}</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)'}
                vertical={false}
              />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
                tick={{ fill: dark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.65)', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
                contentStyle={{
                  background: dark ? '#0f1219' : '#ffffff',
                  border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(15,23,42,0.12)',
                  borderRadius: '0.75rem',
                  color: dark ? 'white' : '#0f172a',
                }}
                labelStyle={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.7)' }}
              />
              <Bar
                dataKey="reviews"
                radius={[8, 8, 2, 2]}
                fill={dark ? 'rgba(245,191,62,0.85)' : 'rgba(212,160,23,0.9)'}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
