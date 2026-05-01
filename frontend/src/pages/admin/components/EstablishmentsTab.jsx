import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { LIST_MAX_HEIGHT_CLASS, avg, getScrollbarClass, simpleError } from '../utils';
import { Badge, ConfirmModal, ModalShell, TypeToConfirmModal } from './Common';

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'Resturant-logos';

const CATEGORY_OPTIONS = [
  { value: 'Restaurant', label: 'Restaurant' },
  { value: 'Cafe', label: 'Cafe' },
  { value: 'Dining_Hall', label: 'Dining hall' },
  { value: 'Convenience', label: 'Convenience' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Approximate UMBC campus — used as default for new establishments (schema requires lat/long). */
const DEFAULT_LAT = '39.2550000';
const DEFAULT_LNG = '-76.7090000';

function emptyEstablishmentForm() {
  return {
    name: '',
    description: '',
    category: 'Restaurant',
    building_name: '',
    address: '',
    latitude: '',
    longitude: '',
    is_active: true,
  };
}

function buildHoursForm(hourRows, opts = {}) {
  const { defaultWeekdayHours = false } = opts;
  const rows = hourRows ?? [];
  const byDay = Object.fromEntries(rows.map((r) => [r.day_of_week, r]));
  const noExistingHours = rows.length === 0;
  return DAYS.map((day) => {
    const r = byDay[day];
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day);
    const defaultOpen = defaultWeekdayHours && noExistingHours && weekday;
    return {
      day_of_week: day,
      is_open: r?.is_open ?? defaultOpen,
      open_time: r?.open_time ? String(r.open_time).slice(0, 5) : '',
      close_time: r?.close_time ? String(r.close_time).slice(0, 5) : '',
    };
  });
}

function toPgTime(htmlTime) {
  if (!htmlTime || String(htmlTime).trim() === '') return '00:00:00';
  const s = String(htmlTime).trim();
  return s.length === 5 ? `${s}:00` : s;
}

function storagePublicUrl(path) {
  const p = String(path ?? '').trim();
  if (!p) return '';
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(p);
  return data?.publicUrl ?? '';
}

/** Avoid stale browser/CDN cache when an object was deleted or replaced in Storage. */
function storageUrlWithCacheBust(url, bust) {
  if (!url) return '';
  if (bust == null || bust === '') return url;
  try {
    const u = new URL(url);
    u.searchParams.set('_cb', String(bust));
    return u.href;
  } catch {
    return `${url}${String(url).includes('?') ? '&' : '?'}_cb=${bust}`;
  }
}

const BRAND_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

async function uploadBrandImage(establishmentId, file, role) {
  const label = role === 'logo' ? 'Logo' : 'Hero';
  if (!file || !file.size) {
    throw new Error(`${label}: choose a non-empty image file.`);
  }
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const ext = BRAND_IMAGE_EXTENSIONS.includes(rawExt) ? rawExt : 'png';
  const folder = role === 'logo' ? 'logos' : 'heroes';
  const path = `${folder}/${establishmentId}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (error) {
    const msg = error.message || String(error);
    const rls = /row-level security|rls|violates.*policy|not authorized|JWT/i.test(msg);
    const hint = rls
      ? ` Storage blocked this (RLS). In Supabase: Storage → Policies for bucket "${STORAGE_BUCKET}" must allow authenticated admins to INSERT/UPDATE objects, and public.users.is_admin must be true for your account.`
      : '';
    throw new Error(`${label} upload failed: ${msg}.${hint}`);
  }
}

/** Brand images live only in Storage — no DB columns. Remove known filenames for this establishment slot. */
async function removeBrandSlotFromBucket(establishmentId, role) {
  const folder = role === 'logo' ? 'logos' : 'heroes';
  const paths = BRAND_IMAGE_EXTENSIONS.map((ext) => `${folder}/${establishmentId}.${ext}`);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) throw error;
}

function bucketSlotObjectPaths(establishmentId, role) {
  const folder = role === 'logo' ? 'logos' : 'heroes';
  return BRAND_IMAGE_EXTENSIONS.map((ext) => `${folder}/${establishmentId}.${ext}`);
}

/** Tries public URLs for logos/{id}.png|jpg|… — matches how uploads are stored. */
function BucketImagePreview({ establishmentId, role, cleared, fileObjectUrl, className, cacheBust }) {
  const candidates = useMemo(
    () => (establishmentId ? bucketSlotObjectPaths(establishmentId, role).map((p) => storagePublicUrl(p)) : []),
    [establishmentId, role],
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [establishmentId, role, cleared, fileObjectUrl, cacheBust]);

  if (fileObjectUrl) {
    return <img alt="" src={fileObjectUrl} className={className} />;
  }
  if (cleared || !establishmentId) return null;
  if (idx >= candidates.length) return null;
  const src = storageUrlWithCacheBust(candidates[idx], cacheBust);
  return (
    <img
      alt=""
      src={src}
      className={className}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

async function syncHoursForEstablishment(establishmentId, hoursForm) {
  const { error: delErr } = await supabase.from('hours').delete().eq('establishment_id', establishmentId);
  if (delErr) throw delErr;

  const rows = hoursForm.map((h) => ({
    establishment_id: establishmentId,
    day_of_week: h.day_of_week,
    open_time: h.is_open ? toPgTime(h.open_time) : '00:00:00',
    close_time: h.is_open ? toPgTime(h.close_time) : '00:00:00',
    is_open: !!h.is_open,
  }));

  const { error: insErr } = await supabase.from('hours').insert(rows);
  if (insErr) throw insErr;
}

export function EstablishmentsTab({ dark, verifyPrivileged, onAction }) {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyEstablishmentForm);
  const [hoursForm, setHoursForm] = useState(() => buildHoursForm([]));
  const [logoFile, setLogoFile] = useState(null);
  const [heroFile, setHeroFile] = useState(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [clearHero, setClearHero] = useState(false);
  /** Bumps when opening the modal or reloading the list so Storage previews skip cached deleted images. */
  const [storagePreviewNonce, setStoragePreviewNonce] = useState(0);

  const logoPreviewUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  const heroPreviewUrl = useMemo(() => (heroFile ? URL.createObjectURL(heroFile) : null), [heroFile]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (heroPreviewUrl) URL.revokeObjectURL(heroPreviewUrl);
    };
  }, [heroPreviewUrl]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('establishments')
      .select(
        'establishment_id, name, description, category, building_name, latitude, longitude, address, is_active, created_at, reviews ( review_id, rating ), hours ( hours_id, day_of_week, open_time, close_time, is_open )',
      )
      .order('name');
    if (loadError) setError(simpleError(loadError, 'Failed to load establishments.'));
    else setEstablishments(data ?? []);
    setLoading(false);
    setStoragePreviewNonce(Date.now());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreateModal() {
    setForm(emptyEstablishmentForm());
    setHoursForm(buildHoursForm([]));
    setLogoFile(null);
    setHeroFile(null);
    setClearLogo(false);
    setClearHero(false);
    setStoragePreviewNonce(Date.now());
    setModal({ type: 'create' });
  }

  function openEditModal(e) {
    setForm({
      name: e.name || '',
      description: e.description || '',
      category: e.category || 'Restaurant',
      building_name: e.building_name || '',
      address: e.address || '',
      latitude: e.latitude != null ? String(e.latitude) : DEFAULT_LAT,
      longitude: e.longitude != null ? String(e.longitude) : DEFAULT_LNG,
      is_active: !!e.is_active,
    });
    setHoursForm(buildHoursForm(e.hours));
    setLogoFile(null);
    setHeroFile(null);
    setClearLogo(false);
    setClearHero(false);
    setStoragePreviewNonce(Date.now());
    setModal({ type: 'edit', establishment: e });
  }

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

  async function deleteEstablishmentPermanently() {
    if (!deleteConfirm) return;
    const { id, name } = deleteConfirm;
    setActionLoading(`delete-${id}`);
    setError('');
    try {
      await verifyPrivileged('admin');
      const { data, error: delErr } = await supabase.from('establishments').delete().eq('establishment_id', id).select('establishment_id');
      if (delErr) throw delErr;
      if (!data?.length) {
        throw new Error(
          'No establishment was deleted. This is usually caused by missing RLS DELETE policy for admins on establishments.',
        );
      }
      try {
        await removeBrandSlotFromBucket(id, 'logo');
        await removeBrandSlotFromBucket(id, 'hero');
      } catch {
        /* bucket cleanup is best-effort after DB row is gone */
      }
      if (modal?.type === 'edit' && modal.establishment?.establishment_id === id) {
        setModal(null);
      }
      onAction?.(`Permanently deleted establishment "${name}".`);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setError(simpleError(err, 'Unable to delete establishment.'));
    }
    setActionLoading(null);
  }

  async function syncStorageBrandImages(establishmentId, { logo, hero, wantClearLogo, wantClearHero } = {}) {
    const L = logo ?? logoFile;
    const H = hero ?? heroFile;
    const cl = wantClearLogo ?? clearLogo;
    const ch = wantClearHero ?? clearHero;
    if (L) {
      await uploadBrandImage(establishmentId, L, 'logo');
    } else if (cl) {
      await removeBrandSlotFromBucket(establishmentId, 'logo');
    }
    if (H) {
      await uploadBrandImage(establishmentId, H, 'hero');
    } else if (ch) {
      await removeBrandSlotFromBucket(establishmentId, 'hero');
    }
  }

  async function submitEstablishment() {
    setActionLoading('create');
    setError('');
    try {
      await verifyPrivileged('admin');
      if (!logoFile) {
        throw new Error('Logo is required to create an establishment.');
      }
      const lat = parseFloat(form.latitude);
      const lng = parseFloat(form.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Latitude and longitude must be valid numbers.');
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        building_name: form.building_name.trim() || null,
        address: form.address.trim() || null,
        latitude: lat,
        longitude: lng,
        is_active: !!form.is_active,
      };
      if (!payload.name) throw new Error('Name is required.');

      const { data: created, error: createError } = await supabase.from('establishments').insert(payload).select('establishment_id').single();

      if (createError) throw createError;
      const establishmentId = created.establishment_id;

      try {
        await syncStorageBrandImages(establishmentId, {
          logo: logoFile,
          hero: heroFile,
          wantClearLogo: clearLogo,
          wantClearHero: clearHero,
        });
      } catch (uploadErr) {
        throw new Error(
          `${uploadErr?.message || String(uploadErr)} If the venue was created, open it from the list and use Edit to upload images.`,
        );
      }

      await syncHoursForEstablishment(establishmentId, hoursForm);

      onAction?.(`Created establishment "${payload.name}".`);
      setModal(null);
      setForm(emptyEstablishmentForm());
      setHoursForm(buildHoursForm([]));
      setLogoFile(null);
      setHeroFile(null);
      setClearLogo(false);
      setClearHero(false);
      load();
    } catch (err) {
      setError(simpleError(err, 'Unable to create establishment.'));
    }
    setActionLoading(null);
  }

  async function saveEstablishment() {
    if (!modal?.establishment) return;
    const establishmentId = modal.establishment.establishment_id;
    setActionLoading(`edit-${establishmentId}`);
    setError('');
    try {
      await verifyPrivileged('admin');
      const lat = parseFloat(form.latitude);
      const lng = parseFloat(form.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Latitude and longitude must be valid numbers.');
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        building_name: form.building_name.trim() || null,
        address: form.address.trim() || null,
        latitude: lat,
        longitude: lng,
        is_active: !!form.is_active,
      };
      if (!payload.name) throw new Error('Name is required.');

      const { error: saveError } = await supabase.from('establishments').update(payload).eq('establishment_id', establishmentId);
      if (saveError) throw saveError;

      try {
        await syncStorageBrandImages(establishmentId, {
          logo: logoFile,
          hero: heroFile,
          wantClearLogo: clearLogo,
          wantClearHero: clearHero,
        });
      } catch (uploadErr) {
        throw new Error(
          `${uploadErr?.message || String(uploadErr)} You can fix Storage policies and try saving again.`,
        );
      }

      await syncHoursForEstablishment(establishmentId, hoursForm);

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
      statusFilter === 'All' ? true : statusFilter === 'Active' ? !!e.is_active : !e.is_active;
    return matchesSearch && matchesStatus;
  });

  const rowBg = dark ? 'bg-[#161b26] border-white/8' : 'bg-white border-black/8';
  const mutedText = dark ? 'text-white/45' : 'text-black/40';
  const inputClass = `w-full rounded-xl border px-3 py-2 text-sm ${dark ? 'border-white/10 bg-[#1f2532] text-white placeholder:text-white/35' : 'border-black/10 bg-gray-50 text-black placeholder:text-black/40'}`;
  const scrollbarClass = getScrollbarClass(dark);

  const editingId = modal?.type === 'edit' ? modal.establishment?.establishment_id : null;
  const previewEstablishment = modal?.type === 'edit' ? modal.establishment : null;
  const showGlobalError = !!error && modal?.type !== 'create';
  const showCreateModalError = !!error && modal?.type === 'create';

  return (
    <div>
      {showGlobalError && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'}`}
        >
          {error}
        </div>
      )}
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
        <button
          onClick={load}
          className={`rounded-full p-2.5 transition-colors ${dark ? 'text-white/40 hover:bg-white/8 hover:text-white/70' : 'text-black/40 hover:bg-black/5 hover:text-black/70'}`}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          onClick={openCreateModal}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${dark ? 'bg-[#f5bf3e] text-black hover:bg-[#ffd15e]' : 'bg-[#D4A017] text-white hover:bg-[#bf9210]'}`}
        >
          <span className="inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> New
          </span>
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
            <div
              key={e.establishment_id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${rowBg} ${!e.is_active ? 'opacity-55' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black'}`}>{e.name}</span>
                  <Badge color={e.is_active ? 'green' : 'gray'}>{e.is_active ? 'Active' : 'Hidden'}</Badge>
                  {e.category && <Badge color="gray">{e.category}</Badge>}
                </div>
                <p className={`text-xs ${mutedText}`}>
                  {e.building_name || 'No building'} · {(e.reviews ?? []).length} reviews · Avg{' '}
                  {avg((e.reviews ?? []).map((r) => r.rating)).toFixed(1)}
                </p>
              </div>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => openEditModal(e)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ${dark ? 'bg-white/8 text-white/70 hover:bg-white/12' : 'bg-black/5 text-black/70 hover:bg-black/10'}`}
              >
                Edit
              </button>
              <button
                disabled={!!actionLoading}
                onClick={() => setConfirm({ id: e.establishment_id, active: e.is_active, name: e.name })}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  e.is_active ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                }`}
              >
                {e.is_active ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Unhide
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => setDeleteConfirm({ id: e.establishment_id, name: e.name })}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${dark ? 'bg-red-950/50 text-red-300 hover:bg-red-950/80' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
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
      {deleteConfirm && (
        <TypeToConfirmModal
          dark={dark}
          title="Delete establishment"
          expectedPhrase={deleteConfirm.name}
          confirmLabel="Delete permanently"
          loading={actionLoading === `delete-${deleteConfirm.id}`}
          onConfirm={deleteEstablishmentPermanently}
          onCancel={() => setDeleteConfirm(null)}
        >
          <p>
            This action will permanently remove "{deleteConfirm.name}", including reviews, hours, images, and related records.
          </p>
        </TypeToConfirmModal>
      )}
      {modal && (
        <ModalShell
          dark={dark}
          title={modal.type === 'create' ? 'Create Establishment' : 'Edit Establishment'}
          onClose={() => setModal(null)}
          maxWidthClass="max-w-2xl"
          scrollBody
        >
          <div className="space-y-4">
            {showCreateModalError && (
              <div
                className={`rounded-xl border px-3 py-2 text-sm ${dark ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'}`}
              >
                {error}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Establishment name"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Short description"
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className={inputClass}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Building</label>
                <input
                  value={form.building_name}
                  onChange={(e) => setForm((p) => ({ ...p, building_name: e.target.value }))}
                  placeholder="Building name"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Street address"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Latitude</label>
                <input
                  value={form.latitude}
                  onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                  placeholder={DEFAULT_LAT}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Longitude</label>
                <input
                  value={form.longitude}
                  onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                  placeholder={DEFAULT_LNG}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="est-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="rounded border-white/20"
                />
                <label htmlFor="est-active" className={`text-sm ${dark ? 'text-white/80' : 'text-black/80'}`}>
                  Active (visible where listings filter on active)
                </label>
              </div>
            </div>

            <div className={`rounded-xl border p-3 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-black/10 bg-black/[0.02]'}`}>
              <p className={`mb-3 text-xs ${mutedText}`}>Logo is required for new establishments. Hero image is optional.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Logo</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      setLogoFile(e.target.files?.[0] ?? null);
                      if (e.target.files?.[0]) setClearLogo(false);
                    }}
                    className={`text-xs ${dark ? 'text-white/70' : 'text-black/70'}`}
                  />
                  <p className={`mt-1 text-xs ${logoFile ? (dark ? 'text-emerald-300/90' : 'text-emerald-800') : mutedText}`}>
                    {logoFile ? `Selected: ${logoFile.name} (${Math.max(1, Math.round(logoFile.size / 1024))} KB)` : 'No file selected'}
                  </p>
                  {previewEstablishment ? (
                    <label className={`mt-2 flex cursor-pointer items-center gap-2 text-xs ${mutedText}`}>
                      <input
                        type="checkbox"
                        checked={clearLogo}
                        disabled={!!logoFile}
                        onChange={(e) => setClearLogo(e.target.checked)}
                      />
                      Remove stored logo
                    </label>
                  ) : null}
                  <BucketImagePreview
                    establishmentId={editingId}
                    role="logo"
                    cleared={clearLogo}
                    fileObjectUrl={logoPreviewUrl}
                    cacheBust={storagePreviewNonce}
                    className="mt-2 h-16 w-16 rounded-lg object-cover ring-1 ring-white/10"
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Hero</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      setHeroFile(e.target.files?.[0] ?? null);
                      if (e.target.files?.[0]) setClearHero(false);
                    }}
                    className={`text-xs ${dark ? 'text-white/70' : 'text-black/70'}`}
                  />
                  <p className={`mt-1 text-xs ${heroFile ? (dark ? 'text-emerald-300/90' : 'text-emerald-800') : mutedText}`}>
                    {heroFile ? `Selected: ${heroFile.name} (${Math.max(1, Math.round(heroFile.size / 1024))} KB)` : 'No file selected'}
                  </p>
                  {previewEstablishment ? (
                    <label className={`mt-2 flex cursor-pointer items-center gap-2 text-xs ${mutedText}`}>
                      <input
                        type="checkbox"
                        checked={clearHero}
                        disabled={!!heroFile}
                        onChange={(e) => setClearHero(e.target.checked)}
                      />
                      Remove stored hero image
                    </label>
                  ) : null}
                  <BucketImagePreview
                    establishmentId={editingId}
                    role="hero"
                    cleared={clearHero}
                    fileObjectUrl={heroPreviewUrl}
                    cacheBust={storagePreviewNonce}
                    className="mt-2 h-16 w-28 rounded-lg object-cover ring-1 ring-white/10"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Hours (each day)</p>
              <div className="space-y-2">
                {hoursForm.map((row, idx) => (
                  <div
                    key={row.day_of_week}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-2 ${dark ? 'border-white/10' : 'border-black/10'}`}
                  >
                    <span className={`w-10 text-xs font-semibold ${dark ? 'text-white/90' : 'text-black/90'}`}>{row.day_of_week}</span>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={row.is_open}
                        onChange={(e) =>
                          setHoursForm((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], is_open: e.target.checked };
                            return next;
                          })
                        }
                      />
                      Open
                    </label>
                    <input
                      type="time"
                      disabled={!row.is_open}
                      value={row.open_time}
                      onChange={(e) =>
                        setHoursForm((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], open_time: e.target.value };
                          return next;
                        })
                      }
                      className={`rounded-lg border px-2 py-1 text-xs ${inputClass} disabled:opacity-40`}
                    />
                    <span className={mutedText}>to</span>
                    <input
                      type="time"
                      disabled={!row.is_open}
                      value={row.close_time}
                      onChange={(e) =>
                        setHoursForm((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], close_time: e.target.value };
                          return next;
                        })
                      }
                      className={`rounded-lg border px-2 py-1 text-xs ${inputClass} disabled:opacity-40`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setModal(null)}
                className={`rounded-xl px-3 py-2 text-sm ${dark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancel
              </button>
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
