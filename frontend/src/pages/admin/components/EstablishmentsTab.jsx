import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { LIST_MAX_HEIGHT_CLASS, avg, getScrollbarClass, simpleError } from '../utils';
import { Badge, ConfirmModal, ModalShell } from './Common';

export function EstablishmentsTab({ dark, verifyPrivileged, onAction }) {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', building_name: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('establishments')
      .select('establishment_id, name, category, building_name, is_active, created_at, reviews ( review_id, rating )')
      .order('name');
    if (loadError) setError(simpleError(loadError, 'Failed to load establishments.'));
    else setEstablishments(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(id, currentlyActive, name) {
    setActionLoading(id);
    setError('');
    try {
      await verifyPrivileged('admin');
      const { data, error: updateError } = await supabase
        .from('establishments')
        .update({ is_active: !currentlyActive })
        .eq('establishment_id', id)
        .select('establishment_id');
      if (updateError) throw updateError;
      if (!data || data.length === 0) {
        throw new Error('No establishment was updated. This is usually caused by missing Supabase RLS update policy for admins on establishments.');
      }
      onAction?.(`${currentlyActive ? 'Deactivated' : 'Activated'} ${name || id}.`);
    } catch (err) {
      setError(simpleError(err, 'Unable to update establishment status.'));
    }
    setActionLoading(null);
    setConfirm(null);
    load();
  }

  async function submitEstablishment() {
    setActionLoading('create');
    setError('');
    try {
      await verifyPrivileged('admin');
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        building_name: form.building_name.trim() || null,
        is_active: true,
      };
      if (!payload.name) throw new Error('Name is required.');
      const { error: createError } = await supabase.from('establishments').insert(payload);
      if (createError) throw createError;
      onAction?.(`Created establishment "${payload.name}".`);
      setModal(null);
      setForm({ name: '', category: '', building_name: '' });
      load();
    } catch (err) {
      setError(simpleError(err, 'Unable to create establishment.'));
    }
    setActionLoading(null);
  }

  async function saveEstablishment() {
    if (!modal?.establishment) return;
    setActionLoading(`edit-${modal.establishment.establishment_id}`);
    setError('');
    try {
      await verifyPrivileged('admin');
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        building_name: form.building_name.trim() || null,
      };
      if (!payload.name) throw new Error('Name is required.');
      const { error: saveError } = await supabase.from('establishments').update(payload).eq('establishment_id', modal.establishment.establishment_id);
      if (saveError) throw saveError;
      onAction?.(`Updated establishment "${payload.name}".`);
      setModal(null);
      load();
    } catch (err) {
      setError(simpleError(err, 'Unable to update establishment.'));
    }
    setActionLoading(null);
  }

  const filtered = establishments.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || e.name?.toLowerCase().includes(q) || e.building_name?.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Active'
          ? !!e.is_active
          : !e.is_active;
    return matchesSearch && matchesStatus;
  });

  const rowBg = dark ? 'bg-[#161b26] border-white/8' : 'bg-white border-black/8';
  const mutedText = dark ? 'text-white/45' : 'text-black/40';
  const scrollbarClass = getScrollbarClass(dark);

  return (
    <div>
      {error && <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'}`}>{error}</div>}
      <div className="mb-5 flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search establishments..."
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
            dark
              ? 'border-white/10 bg-[#1e2430] text-white placeholder:text-white/30 focus:border-[#f5bf3e]/50'
              : 'border-black/10 bg-gray-50 text-black placeholder:text-black/35 focus:border-[#D4A017]/50'
          }`}
        />
        <button onClick={load} className={`rounded-full p-2.5 transition-colors ${dark ? 'text-white/40 hover:bg-white/8 hover:text-white/70' : 'text-black/40 hover:bg-black/5 hover:text-black/70'}`}>
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setForm({ name: '', category: '', building_name: '' });
            setModal({ type: 'create' });
          }}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${dark ? 'bg-[#f5bf3e] text-black hover:bg-[#ffd15e]' : 'bg-[#D4A017] text-white hover:bg-[#bf9210]'}`}
        >
          <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> New</span>
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {['All', 'Active', 'Hidden'].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === f
                ? 'bg-[#f5bf3e] text-black'
                : dark
                  ? 'bg-white/8 text-white/65 hover:bg-white/12'
                  : 'bg-black/5 text-black/65 hover:bg-black/10'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>Loading establishments...</div>
      ) : filtered.length === 0 ? (
        <div className={`py-16 text-center text-sm ${mutedText}`}>No {statusFilter.toLowerCase()} establishments found.</div>
      ) : (
        <div className={`space-y-2.5 ${filtered.length > 10 ? `${LIST_MAX_HEIGHT_CLASS} overflow-y-auto pr-1 ${scrollbarClass}` : ''}`}>
          {filtered.map((e) => (
            <div key={e.establishment_id} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${rowBg} ${!e.is_active ? 'opacity-55' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black'}`}>{e.name}</span>
                  <Badge color={e.is_active ? 'green' : 'gray'}>{e.is_active ? 'Active' : 'Hidden'}</Badge>
                  {e.category && <Badge color="gray">{e.category}</Badge>}
                </div>
                <p className={`text-xs ${mutedText}`}>
                  {e.building_name || 'No building'} · {(e.reviews ?? []).length} reviews · Avg {avg((e.reviews ?? []).map((r) => r.rating)).toFixed(1)}
                </p>
              </div>
              <button
                onClick={() => {
                  setForm({ name: e.name || '', category: e.category || '', building_name: e.building_name || '' });
                  setModal({ type: 'edit', establishment: e });
                }}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ${dark ? 'bg-white/8 text-white/70 hover:bg-white/12' : 'bg-black/5 text-black/70 hover:bg-black/10'}`}
              >
                Edit
              </button>
              <button
                disabled={actionLoading === e.establishment_id}
                onClick={() => setConfirm({ id: e.establishment_id, active: e.is_active, name: e.name })}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  e.is_active
                    ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                    : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                }`}
              >
                {e.is_active ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Unhide</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          dark={dark}
          message={
            confirm.active
              ? `Hide "${confirm.name}"? It will no longer appear to users.`
              : `Unhide "${confirm.name}"? It will become visible to users again.`
          }
          confirmLabel={confirm.active ? 'Hide' : 'Unhide'}
          confirmColor={confirm.active ? 'red' : 'yellow'}
          onConfirm={() => toggleActive(confirm.id, confirm.active, confirm.name)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {modal && (
        <ModalShell
          dark={dark}
          title={modal.type === 'create' ? 'Create Establishment' : 'Edit Establishment'}
          subtitle="Update dining spot metadata and visibility."
          onClose={() => setModal(null)}
        >
          <div className="space-y-3">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className={`w-full rounded-xl border px-3 py-2 text-sm ${dark ? 'border-white/10 bg-[#1f2532]' : 'border-black/10 bg-gray-50'}`} />
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category" className={`w-full rounded-xl border px-3 py-2 text-sm ${dark ? 'border-white/10 bg-[#1f2532]' : 'border-black/10 bg-gray-50'}`} />
            <input value={form.building_name} onChange={(e) => setForm((p) => ({ ...p, building_name: e.target.value }))} placeholder="Building" className={`w-full rounded-xl border px-3 py-2 text-sm ${dark ? 'border-white/10 bg-[#1f2532]' : 'border-black/10 bg-gray-50'}`} />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className={`rounded-xl px-3 py-2 text-sm ${dark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>Cancel</button>
              <button
                disabled={!!actionLoading}
                onClick={() => (modal.type === 'create' ? submitEstablishment() : saveEstablishment())}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${dark ? 'bg-[#f5bf3e] text-black hover:bg-[#ffd15e]' : 'bg-[#D4A017] text-white hover:bg-[#bf9210]'}`}
              >
                {actionLoading ? 'Saving...' : modal.type === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
