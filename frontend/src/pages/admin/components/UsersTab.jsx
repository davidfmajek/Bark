import { useCallback, useEffect, useState } from 'react';
import { Ban, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { LIST_MAX_HEIGHT_CLASS, getScrollbarClass, isMissingDbColumnError, normalizeUserRole, simpleError } from '../utils';
import { Badge, Check, ConfirmModal } from './Common';

export function UsersTab({ dark, verifyPrivileged, onAction, currentUserId, actorRole, roleColumnSupported, banSupported, onBanSupportedChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const withBan = await supabase
      .from('users')
      .select('user_id, display_name, email, affiliation, avatar_url, role, is_admin, is_banned, created_at')
      .order('created_at', { ascending: false });

    if (withBan.error && isMissingDbColumnError(withBan.error, 'is_banned')) {
      onBanSupportedChange?.(false);
      const withoutBan = await supabase
        .from('users')
        .select('user_id, display_name, email, affiliation, avatar_url, role, is_admin, created_at')
        .order('created_at', { ascending: false });
      if (withoutBan.error) {
        setError(simpleError(withoutBan.error, 'Failed to load users.'));
        setUsers([]);
      } else {
        setUsers((withoutBan.data ?? []).map((u) => ({ ...u, role: normalizeUserRole(u), is_banned: false })));
      }
    } else if (withBan.error) {
      setError(simpleError(withBan.error, 'Failed to load users.'));
      setUsers([]);
    } else {
      onBanSupportedChange?.(true);
      setUsers((withBan.data ?? []).map((u) => ({ ...u, role: normalizeUserRole(u) })));
    }
    setLoading(false);
  }, [onBanSupportedChange]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const activeOnly = banSupported ? !u.is_banned : true;
    return matchesSearch && activeOnly;
  });

  async function toggleBan(userId, currentlyBanned) {
    setActionLoading(userId);
    setError('');
    try {
      await verifyPrivileged('mod');
      const { error: updateError } = await supabase.from('users').update({ is_banned: !currentlyBanned }).eq('user_id', userId);
      if (updateError) throw updateError;
      onAction?.(`${currentlyBanned ? 'Unbanned' : 'Banned'} user #${userId}.`);
    } catch (err) {
      setError(simpleError(err, 'Unable to update ban status.'));
    }
    setActionLoading(null);
    setConfirm(null);
    load();
  }

  async function toggleModerator(userId, currentlyRole) {
    if (actorRole !== 'admin') {
      setError('Only admins can manage moderator roles.');
      return;
    }
    if (userId === currentUserId && currentlyRole === 'admin') {
      setError('You cannot change your own role.');
      return;
    }
    setActionLoading(`role-${userId}`);
    setError('');
    try {
      await verifyPrivileged('admin');
      const nextRole = currentlyRole === 'mod' ? 'user' : 'mod';
      const { error: roleError } = await supabase.from('users').update({ role: nextRole }).eq('user_id', userId);
      if (roleError) throw roleError;
      onAction?.(`${currentlyRole === 'mod' ? 'Demoted' : 'Promoted'} user #${userId} ${currentlyRole === 'mod' ? 'to user' : 'to mod'}.`);
    } catch (err) {
      setError(simpleError(err, 'Unable to update role.'));
    }
    setActionLoading(null);
    setConfirm((prev) => (prev?.kind === 'role' ? null : prev));
    load();
  }

  const rowBg = dark ? 'bg-[#161b26] border-white/8' : 'bg-white border-black/8';
  const mutedText = dark ? 'text-white/45' : 'text-black/40';
  const scrollbarClass = getScrollbarClass(dark);

  return (
    <div>
      {!banSupported && (
        <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-amber-400/35 bg-amber-500/10 text-amber-200' : 'border-amber-400/50 bg-amber-50 text-amber-900'}`}>
          Ban status is not available yet (add column <code className="rounded bg-black/20 px-1 py-0.5 text-xs">users.is_banned</code> in Supabase). Listing all users below; ban controls are hidden.
        </div>
      )}
      {!roleColumnSupported && actorRole === 'admin' && (
        <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-amber-400/35 bg-amber-500/10 text-amber-200' : 'border-amber-400/50 bg-amber-50 text-amber-900'}`}>
          Role column not found. Add <code className="rounded bg-black/20 px-1 py-0.5 text-xs">users.role</code> to enable promote/demote moderator controls.
        </div>
      )}
      {error && <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'}`}>{error}</div>}
      <div className="mb-5 flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
            dark
              ? 'border-white/10 bg-[#1e2430] text-white placeholder:text-white/30 focus:border-[#f5bf3e]/50'
              : 'border-black/10 bg-gray-50 text-black placeholder:text-black/35 focus:border-[#D4A017]/50'
          }`}
        />
        <button onClick={load} className={`rounded-full p-2.5 transition-colors ${dark ? 'text-white/40 hover:bg-white/8 hover:text-white/70' : 'text-black/40 hover:bg-black/5 hover:text-black/70'}`}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>Loading users...</div>
      ) : filtered.length === 0 ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>No users found.</div>
      ) : (
        <div className={`space-y-2.5 ${filtered.length > 10 ? `${LIST_MAX_HEIGHT_CLASS} overflow-y-auto pr-1 ${scrollbarClass}` : ''}`}>
          {filtered.map((u) => (
            <div key={u.user_id} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${rowBg} ${banSupported && u.is_banned ? 'opacity-60' : ''}`}>
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${dark ? 'bg-white/10 text-white/70' : 'bg-black/8 text-black/60'}`}>
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (u.display_name || u.email || '?').slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`truncate text-sm font-semibold ${dark ? 'text-white' : 'text-black'}`}>{u.display_name || '—'}</span>
                  <Badge color="gray">User</Badge>
                  {u.role === 'mod' && <Badge color="blue">Mod</Badge>}
                  {u.role === 'admin' && <Badge color="blue">Admin</Badge>}
                  {banSupported && <Badge color={u.is_banned ? 'red' : 'green'}>{u.is_banned ? 'Banned' : 'Active'}</Badge>}
                  {u.affiliation && <Badge color="gray">{u.affiliation}</Badge>}
                </div>
                <p className={`truncate text-xs ${mutedText}`}>{u.email}</p>
              </div>
              {banSupported && !u.is_admin && (
                <button
                  disabled={actionLoading === u.user_id}
                  onClick={() => setConfirm({ userId: u.user_id, banned: u.is_banned, name: u.display_name || u.email })}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                    u.is_banned
                      ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                      : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  }`}
                >
                  {u.is_banned ? <><Check className="h-3.5 w-3.5" /> Unban</> : <><Ban className="h-3.5 w-3.5" /> Ban</>}
                </button>
              )}
              {actorRole === 'admin' && roleColumnSupported && u.role !== 'admin' && (
                <button
                  disabled={actionLoading === `role-${u.user_id}`}
                  onClick={() => setConfirm({ kind: 'role', userId: u.user_id, currentRole: u.role, name: u.display_name || u.email })}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${u.role === 'mod' ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25' : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'}`}
                >
                  {u.role === 'mod' ? 'Demote Mod' : 'Promote Mod'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          dark={dark}
          message={
            confirm.kind === 'role'
              ? (confirm.currentRole === 'mod' ? `Demote ${confirm.name} from moderator?` : `Promote ${confirm.name} to moderator?`)
              : confirm.banned
                ? `Unban ${confirm.name}? They will be able to post reviews again.`
                : `Ban ${confirm.name}? They will no longer be able to post reviews.`
          }
          confirmLabel={
            confirm.kind === 'role'
              ? (confirm.currentRole === 'mod' ? 'Demote Moderator' : 'Promote Moderator')
              : (confirm.banned ? 'Unban User' : 'Ban User')
          }
          confirmColor={confirm.kind === 'role' ? 'yellow' : (confirm.banned ? 'yellow' : 'red')}
          loading={!!actionLoading}
          onConfirm={() => (confirm.kind === 'role' ? toggleModerator(confirm.userId, confirm.currentRole) : toggleBan(confirm.userId, confirm.banned))}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
