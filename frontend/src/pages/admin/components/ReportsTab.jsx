import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { LIST_MAX_HEIGHT_CLASS, formatDate, getScrollbarClass, simpleError } from '../utils';
import { ConfirmModal, statusBadge, Check } from './Common';

export function ReportsTab({ dark, verifyPrivileged, onAction }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Pending');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const filters = ['Pending', 'Reviewed', 'Dismissed', 'Removed'];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const query = supabase
      .from('reports')
      .select(`
        report_id, reason, status, reported_at,
        reviewer:reporter_id ( user_id, display_name, email ),
        review:review_id ( review_id, body, rating, is_flagged,
          author:user_id ( user_id, display_name, email ),
          establishment:establishment_id ( name )
        )
      `)
      .order('reported_at', { ascending: false })
      .eq('status', filter);
    const { data, error: queryError } = await query;
    if (queryError) setError(simpleError(queryError, 'Failed to load reports'));
    else setReports(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateReport(reportId, status, label) {
    setActionLoading(reportId + status);
    setError('');
    try {
      await verifyPrivileged('mod');
      const { error: updateError } = await supabase.from('reports').update({ status }).eq('report_id', reportId);
      if (updateError) throw updateError;
      onAction?.(`Report #${reportId} marked ${label}.`);
    } catch (err) {
      setError(simpleError(err, 'Unable to update report.'));
    }
    setActionLoading(null);
    setConfirm(null);
    load();
  }

  async function removeReview(reportId, reviewId) {
    setActionLoading(reportId + 'remove');
    setError('');
    try {
      await verifyPrivileged('mod');
      const del = await supabase.from('reviews').delete().eq('review_id', reviewId);
      if (del.error) throw del.error;
      const rep = await supabase.from('reports').update({ status: 'Removed' }).eq('report_id', reportId);
      if (rep.error) throw rep.error;
      onAction?.(`Removed review #${reviewId} from report #${reportId}.`);
    } catch (err) {
      setError(simpleError(err, 'Unable to remove review.'));
    }
    setActionLoading(null);
    setConfirm(null);
    load();
  }

  const filtered = reports.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const reporter = `${r.reviewer?.display_name || ''} ${r.reviewer?.email || ''}`.toLowerCase();
    const establishment = (r.review?.establishment?.name || '').toLowerCase();
    return reporter.includes(q) || establishment.includes(q);
  });

  const rowBg = dark ? 'bg-[#161b26] border-white/8' : 'bg-white border-black/8';
  const mutedText = dark ? 'text-white/45' : 'text-black/40';
  const scrollbarClass = getScrollbarClass(dark);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reporter or establishment..."
          className={`min-w-[220px] flex-1 rounded-xl border px-4 py-2 text-sm outline-none ${
            dark ? 'border-white/10 bg-[#1f2532] text-white placeholder:text-white/35' : 'border-black/10 bg-white text-black placeholder:text-black/35'
          }`}
        />
        <button onClick={load} className={`rounded-full p-2 ${dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}><RefreshCw className="h-4 w-4" /></button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#f5bf3e] text-black'
                : dark ? 'bg-white/8 text-white/60 hover:bg-white/12' : 'bg-black/5 text-black/60 hover:bg-black/10'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'}`}>{error}</div>}

      {loading ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>Loading reports...</div>
      ) : filtered.length === 0 ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>No {filter.toLowerCase()} reports</div>
      ) : (
        <div className={`space-y-3 ${filtered.length > 10 ? `${LIST_MAX_HEIGHT_CLASS} overflow-y-auto pr-1 ${scrollbarClass}` : ''}`}>
          {filtered.map((r) => (
            <div key={r.report_id} className={`rounded-2xl border p-5 ${rowBg}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(r.status)}
                    <span className={`text-xs ${mutedText}`}>{formatDate(r.reported_at)}</span>
                    {r.review?.establishment?.name && (
                      <span className={`text-xs font-medium ${dark ? 'text-[#f5bf3e]/70' : 'text-[#D4A017]'}`}>@ {r.review.establishment.name}</span>
                    )}
                  </div>
                  <p className={`mt-2 text-sm ${dark ? 'text-white/80' : 'text-black/80'}`}>
                    <span className="font-semibold">Reason:</span> {r.reason}
                  </p>
                  {r.review?.body && (
                    <p className={`mt-1.5 line-clamp-3 rounded-xl p-3 text-sm italic ${dark ? 'bg-white/4 text-white/60' : 'bg-black/3 text-black/55'}`}>
                      "{r.review.body}"
                    </p>
                  )}
                  <div className={`mt-2 flex gap-4 text-xs ${mutedText}`}>
                    <span>Reported by: <span className={dark ? 'text-white/65' : 'text-black/65'}>{r.reviewer?.display_name ?? r.reviewer?.email ?? '—'}</span></span>
                    <span>Review by: <span className={dark ? 'text-white/65' : 'text-black/65'}>{r.review?.author?.display_name ?? r.review?.author?.email ?? '—'}</span></span>
                  </div>
                </div>

                {r.status === 'Pending' && (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      disabled={!!actionLoading}
                      onClick={() => setConfirm({ reportId: r.report_id, reviewId: r.review?.review_id, action: 'dismiss' })}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${dark ? 'bg-white/8 text-white/60 hover:bg-white/12' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
                    >
                      <X className="h-3.5 w-3.5" /> Dismiss
                    </button>
                    <button
                      disabled={!!actionLoading}
                      onClick={() => setConfirm({ reportId: r.report_id, reviewId: r.review?.review_id, action: 'reviewed' })}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25"
                    >
                      <Check className="h-3.5 w-3.5" /> Mark Reviewed
                    </button>
                    <button
                      disabled={!!actionLoading}
                      onClick={() => setConfirm({ reportId: r.report_id, reviewId: r.review?.review_id, action: 'remove' })}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Review
                    </button>
                  </div>
                )}
                {(r.status === 'Reviewed' || r.status === 'Dismissed') && (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      disabled={!!actionLoading}
                      onClick={() => setConfirm({ reportId: r.report_id, reviewId: r.review?.review_id, action: 'remove' })}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Review
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <ConfirmModal
          dark={dark}
          message={
            confirm.action === 'remove'
              ? 'Permanently delete this review? This cannot be undone.'
              : confirm.action === 'reviewed'
                ? 'Mark this report as reviewed?'
                : 'Dismiss this report? It will be marked as resolved without action.'
          }
          confirmLabel={confirm.action === 'remove' ? 'Delete Review' : confirm.action === 'reviewed' ? 'Mark Reviewed' : 'Dismiss'}
          confirmColor={confirm.action === 'remove' ? 'red' : 'yellow'}
          loading={!!actionLoading}
          onConfirm={() => {
            if (confirm.action === 'remove') removeReview(confirm.reportId, confirm.reviewId);
            else if (confirm.action === 'reviewed') updateReport(confirm.reportId, 'Reviewed', 'Reviewed');
            else updateReport(confirm.reportId, 'Dismissed', 'Dismissed');
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
