const SCROLLBAR_BASE_CLASS = '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2';

export const LIST_MAX_HEIGHT_CLASS = 'max-h-[50rem]';
export const FEED_MAX_HEIGHT_CLASS = 'max-h-[40rem]';

export function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function avg(values = []) {
  if (!values.length) return 0;
  return values.reduce((acc, n) => acc + n, 0) / values.length;
}

export function simpleError(error, fallback) {
  return error?.message || fallback;
}

export function isMissingDbColumnError(error, columnName) {
  const m = String(error?.message || '').toLowerCase();
  const col = String(columnName || '').toLowerCase();
  if (!col) return false;
  return m.includes(col) && (m.includes('does not exist') || m.includes('unknown column'));
}

export function normalizeUserRole(userRow) {
  const role = String(userRow?.role || '').toLowerCase();
  if (role === 'admin' || role === 'mod' || role === 'user') return role;
  if (userRow?.is_admin) return 'admin';
  return 'user';
}

export function canManageSystem(role) {
  return role === 'admin';
}

export function getScrollbarClass(dark) {
  return `${SCROLLBAR_BASE_CLASS} ${
    dark
      ? '[scrollbar-color:rgba(148,163,184,0.55)_rgba(15,18,25,0.45)] [&::-webkit-scrollbar-track]:bg-[#0f1219]/50 [&::-webkit-scrollbar-thumb]:bg-slate-500/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-slate-400/70'
      : '[scrollbar-color:rgba(148,163,184,0.85)_rgba(226,232,240,0.9)] [&::-webkit-scrollbar-track]:bg-slate-200/80 [&::-webkit-scrollbar-thumb]:bg-slate-400/90 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-slate-500'
  }`;
}

export function getActorName(authUser) {
  const fromMeta = authUser?.user_metadata?.display_name;
  if (fromMeta && String(fromMeta).trim()) return String(fromMeta).trim();
  const email = String(authUser?.email || '').trim();
  if (email) return email.split('@')[0];
  return 'Unknown user';
}
