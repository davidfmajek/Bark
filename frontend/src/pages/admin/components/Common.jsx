
import { Check, X } from 'lucide-react';

export function Badge({ children, color }) {
  const colors = {
    yellow: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
    green: 'bg-green-400/15 text-green-400 border-green-400/30',
    red: 'bg-red-400/15 text-red-400 border-red-400/30',
    gray: 'bg-white/10 text-white/50 border-white/10',
    blue: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
}

export function statusBadge(status) {
  const map = { Pending: 'yellow', Reviewed: 'blue', Dismissed: 'gray', Removed: 'red' };
  return <Badge color={map[status] ?? 'gray'}>{status}</Badge>;
}

export function ConfirmModal({ dark, message, confirmLabel, confirmColor = 'red', onConfirm, onCancel, loading = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${dark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'}`}>
        <p className={`text-sm leading-relaxed ${dark ? 'text-white/80' : 'text-black/70'}`}>{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button disabled={loading} onClick={onCancel} className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${dark ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-black/5 text-black/70 hover:bg-black/10'}`}>Cancel</button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${confirmColor === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#f5bf3e] !text-black hover:bg-[#e0ab2d]'}`}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalShell({ dark, title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${dark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-black'}`}>{title}</h3>
            {subtitle ? <p className={`mt-1 text-sm ${dark ? 'text-white/60' : 'text-black/60'}`}>{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className={`rounded-lg p-1.5 transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Check };
