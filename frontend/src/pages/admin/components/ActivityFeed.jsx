import { FEED_MAX_HEIGHT_CLASS, formatDateTime, getScrollbarClass } from '../utils';

export function ActivityFeed({ dark, activity, mutedText }) {
  const scrollbarClass = getScrollbarClass(dark);
  return (
    <aside className={`h-fit rounded-2xl border p-4 ${dark ? 'bg-[#161b26] border-white/8' : 'bg-gray-50 border-black/8'}`}>
      <h3 className="text-sm font-semibold">Activity Feed</h3>
      <p className={`mt-1 text-xs ${mutedText}`}>Recent reviews, reports, and admin actions</p>
      <div className={`mt-4 space-y-2 ${activity.length > 10 ? `${FEED_MAX_HEIGHT_CLASS} overflow-y-auto pr-1 ${scrollbarClass}` : ''}`}>
        {activity.length === 0 ? (
          <p className={`py-4 text-center text-sm ${mutedText}`}>No recent activity yet.</p>
        ) : (
          activity.map((item) => (
            <div key={item.id} className={`rounded-xl border p-3 ${dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
              <p className="break-words text-xs font-medium [overflow-wrap:anywhere]">{item.label}</p>
              <p className={`mt-1 text-[11px] ${mutedText}`}>{formatDateTime(item.ts)}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
