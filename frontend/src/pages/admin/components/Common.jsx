import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';


export function TypeToConfirmModal({
  dark,
  title,
  children,
  expectedPhrase,
  confirmLabel = 'Delete permanently',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const [typed, setTyped] = useState('');
  const expected = String(expectedPhrase ?? '').trim();
  const typedTrim = String(typed).trim();
  const match = typedTrim.length > 0 && typedTrim === expected;

  useEffect(() => {
    setTyped('');
  }, [expectedPhrase]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${dark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="type-confirm-title"
      >
        <h3 id="type-confirm-title" className={`text-lg font-semibold ${dark ? 'text-white' : 'text-black'}`}>
          {title}
        </h3>
        {children ? (
          <div className={`mt-3 text-sm leading-relaxed ${dark ? 'text-white/70' : 'text-black/70'}`}>{children}</div>
        ) : null}
        <p className={`mt-4 text-sm ${dark ? 'text-red-300/90' : 'text-red-700'}`}>
          This action cannot be undone.
        </p>
        <label className={`mt-4 block text-sm font-medium ${dark ? 'text-white/80' : 'text-black/80'}`}>
          Type{' '}
          <span className={`rounded px-1.5 py-0.5 font-mono text-sm ${dark ? 'bg-white/10 text-[#f5bf3e]' : 'bg-black/5 text-[#8a6d0f]'}`}>
            {expected || '(name)'}
          </span>{' '}
          to confirm:
        </label>
        <input
          type="text"
          autoComplete="off"
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={expected || 'Name'}
          className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${
            dark
              ? 'border-white/15 bg-[#1f2532] text-white placeholder:text-white/30 focus:border-red-400/50'
              : 'border-black/10 bg-gray-50 text-black placeholder:text-black/35 focus:border-red-400/60'
          }`}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${dark ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-black/5 text-black/70 hover:bg-black/10'}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!match || loading}
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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

export function ModalShell({ dark, title, subtitle, children, onClose, maxWidthClass = 'max-w-lg', scrollBody = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        className={`flex w-full ${maxWidthClass} max-h-[90vh] flex-col rounded-2xl border p-5 shadow-2xl ${dark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'}`}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div>
            <h3 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-black'}`}>{title}</h3>
            {subtitle ? <p className={`mt-1 text-sm ${dark ? 'text-white/60' : 'text-black/60'}`}>{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className={`rounded-lg p-1.5 transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={scrollBody ? 'min-h-0 flex-1 overflow-y-auto pr-1' : ''}>{children}</div>
      </div>
    </div>
  );
}

export { Check };
