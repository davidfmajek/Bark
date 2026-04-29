import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { LIST_MAX_HEIGHT_CLASS, formatDateTime, getScrollbarClass, simpleError } from '../utils';
import { Badge, ConfirmModal } from './Common';

export function FlaggedReviewsTab({ dark, verifyPrivileged, onAction }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: qError } = await supabase
      .from('reviews')
      .select(`
        review_id, body, rating, created_at, is_flagged,
        author:user_id ( user_id, display_name, email ),
        establishment:establishment_id ( name )
      `)
      .eq('is_flagged', true)
      .order('created_at', { ascending: false });
    if (qError) setError(simpleError(qError, 'Failed to load flagged reviews.'));
    else setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function unflag(reviewId) {
    setActionLoading(`unflag-${reviewId}`);
    setError('');
    try {
      await verifyPrivileged('mod');
      const { error: uError } = await supabase.from('reviews').update({ is_flagged: false }).eq('review_id', reviewId);
      if (uError) throw uError;
      onAction?.(`Unflagged review #${reviewId}.`);
    } catch (err) {
      setError(simpleError(err, 'Unable to unflag review.'));
    }
    setActionLoading(null);
    setConfirm(null);
    load();
  }

  async function deleteReview(reviewId) {
    setActionLoading(`delete-${reviewId}`);
    setError('');
    try {
      await verifyPrivileged('mod');
      const { error: dError } = await supabase.from('reviews').delete().eq('review_id', reviewId);
      if (dError) throw dError;
      onAction?.(`Deleted flagged review #${reviewId}.`);
    } catch (err) {
      setError(simpleError(err, 'Unable to delete review.'));
    }
    setActionLoading(null);
    setConfirm(null);
    load();
  }

  const filtered = items.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const author = `${r.author?.display_name || ''} ${r.author?.email || ''}`.toLowerCase();
    const est = (r.establishment?.name || '').toLowerCase();
    return author.includes(q) || est.includes(q) || (r.body || '').toLowerCase().includes(q);
  });

  const rowBg = dark ? 'bg-[#161b26] border-white/8' : 'bg-white border-black/8';
  const mutedText = dark ? 'text-white/45' : 'text-black/40';
  const scrollbarClass = getScrollbarClass(dark);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search flagged reviews..."
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none ${dark ? 'border-white/10 bg-[#1e2430] text-white placeholder:text-white/30' : 'border-black/10 bg-gray-50 text-black placeholder:text-black/35'}`}
        />
        <button onClick={load} className={`rounded-full p-2.5 ${dark ? 'hover:bg-white/8' : 'hover:bg-black/5'}`}><RefreshCw className="h-4 w-4" /></button>
      </div>
      {error && <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'}`}>{error}</div>}
      {loading ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>Loading flagged reviews...</div>
      ) : filtered.length === 0 ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>No flagged reviews </div>
      ) : (
        <div className={`space-y-3 ${filtered.length > 10 ? `${LIST_MAX_HEIGHT_CLASS} overflow-y-auto pr-1 ${scrollbarClass}` : ''}`}>
          {filtered.map((r) => (
            <div key={r.review_id} className={`rounded-2xl border p-4 ${rowBg}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <Badge color="red">Flagged</Badge>
                    <span className={mutedText}>{formatDateTime(r.created_at)}</span>
                    <span className={mutedText}>@ {r.establishment?.name ?? 'Unknown'}</span>
                  </div>
                  <p className={`line-clamp-3 text-sm ${dark ? 'text-white/85' : 'text-black/80'}`}>{r.body || 'No review text.'}</p>
                  <p className={`mt-2 text-xs ${mutedText}`}>
                    By {r.author?.display_name || r.author?.email || 'Unknown'} · Rating {r.rating ?? '—'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={!!actionLoading}
                    onClick={() => setConfirm({ action: 'unflag', reviewId: r.review_id })}
                    className="rounded-xl bg-green-500/15 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/25"
                  >
                    Unflag
                  </button>
                  <button
                    disabled={!!actionLoading}
                    onClick={() => setConfirm({ action: 'delete', reviewId: r.review_id })}
                    className="rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <ConfirmModal
          dark={dark}
          loading={!!actionLoading}
          message={confirm.action === 'delete' ? 'Delete this flagged review permanently?' : 'Unflag this review and keep it published?'}
          confirmLabel={confirm.action === 'delete' ? 'Delete Review' : 'Unflag Review'}
          confirmColor={confirm.action === 'delete' ? 'red' : 'yellow'}
          onConfirm={() => (confirm.action === 'delete' ? deleteReview(confirm.reviewId) : unflag(confirm.reviewId))}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
