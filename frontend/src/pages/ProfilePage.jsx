import { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { AFFILIATION_OPTIONS } from '../lib/affiliations.js';
import { compressImageFile } from '../lib/imageCompression.js';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const PROFILE_AVATAR_BUCKET = 'profile-pic';

function getInitials(name) {
  const normalized = (name || '').trim();
  if (!normalized) return 'BK';
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return normalized.slice(0, 2).toUpperCase();
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function buildCroppedFile(imageSrc, croppedAreaPixels, originalFile) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to process image crop.');
  }

  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  context.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
  );

  const outputType = originalFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, outputType, 0.92);
  });
  if (!blob) throw new Error('Unable to generate cropped image.');

  const originalNameWithoutExt = originalFile.name.replace(/\.[^/.]+$/, '');
  const extension = outputType === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `${sanitizeFileName(originalNameWithoutExt)}-cropped.${extension}`, {
    type: outputType,
  });
}

export function ProfilePage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userProvider, setUserProvider] = useState('email');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPath, setAvatarPath] = useState('');
  const [avatarBucket, setAvatarBucket] = useState(PROFILE_AVATAR_BUCKET);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoAction, setPhotoAction] = useState('keep');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [cropSourceFile, setCropSourceFile] = useState(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const [cropProcessing, setCropProcessing] = useState(false);
  const [showGooglePasswordFields, setShowGooglePasswordFields] = useState(false);
  const [hasEmailPassword, setHasEmailPassword] = useState(false);

  const [initialProfile, setInitialProfile] = useState({
    displayName: '',
    affiliation: '',
    avatarUrl: '',
    avatarPath: '',
    avatarBucket: PROFILE_AVATAR_BUCKET,
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({ displayName: '', affiliation: '', photo: '', password: '' });

  const googleAuthUser = userProvider === 'google';
  const effectiveAvatar = photoAction === 'remove'
    ? ''
    : (photoPreviewUrl || avatarUrl || '');
  const previewInitials = getInitials(displayName || initialProfile.displayName || 'BARK User');

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!active || !user) return;

        const provider = user.app_metadata?.provider || 'email';
        const hasEmailIdentity = (user.identities || []).some((identity) => identity.provider === 'email');
        const metadataHasPassword = user.user_metadata?.has_password === true;
        const metadataAvatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
        const metadataAvatarPath = user.user_metadata?.avatar_path || '';
        const metadataAvatarBucket = user.user_metadata?.avatar_bucket || PROFILE_AVATAR_BUCKET;
        setUserProvider(provider);
        setHasEmailPassword(hasEmailIdentity || metadataHasPassword);

        const { data, error } = await supabase
          .from('users')
          .select('display_name, affiliation, avatar_url, avatar_path, avatar_bucket')
          .eq('user_id', user.id)
          .limit(1);
        if (error) throw error;

        const profileRow = Array.isArray(data) ? data[0] : null;
        const loadedDisplayName = profileRow?.display_name
          || user.user_metadata?.display_name
          || user.user_metadata?.name
          || user.email?.split('@')[0]
          || '';
        const loadedAffiliation = profileRow?.affiliation
          || user.user_metadata?.affiliation
          || '';
        const loadedAvatarUrl = profileRow?.avatar_url || metadataAvatarUrl;
        const loadedAvatarPath = profileRow?.avatar_path || metadataAvatarPath;
        const loadedAvatarBucket = profileRow?.avatar_bucket || metadataAvatarBucket;
        setAvatarUrl(loadedAvatarUrl);
        setAvatarPath(loadedAvatarPath);
        setAvatarBucket(loadedAvatarBucket);
        setDisplayName(loadedDisplayName);
        setAffiliation(loadedAffiliation);
        setInitialProfile({
          displayName: loadedDisplayName,
          affiliation: loadedAffiliation,
          avatarUrl: loadedAvatarUrl,
          avatarPath: loadedAvatarPath,
          avatarBucket: loadedAvatarBucket,
        });
      } catch (error) {
        setMessage({ type: 'error', text: error.message || 'Failed to load profile settings.' });
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  const isDirty = (
    displayName.trim() !== initialProfile.displayName ||
    affiliation !== initialProfile.affiliation ||
    password.length > 0 ||
    confirmPassword.length > 0 ||
    photoAction !== 'keep'
  );

  const canSave = !loading && !saving && isDirty;

  function validateImageType(file) {
    if (!file) return '';
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Image must be JPG or PNG.';
    return '';
  }

  function validateImage(file) {
    const typeErr = validateImageType(file);
    if (typeErr) return typeErr;
    if (file.size > MAX_IMAGE_SIZE_BYTES) return 'Image must be 5MB or smaller.';
    return '';
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setMessage({ type: '', text: '' });
    if (!file) return;
    const typeError = validateImageType(file);
    if (typeError) {
      setPhotoFile(null);
      setPhotoAction('keep');
      setFieldErrors((prev) => ({ ...prev, photo: typeError }));
      return;
    }
    let working = file;
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      try {
        working = await compressImageFile(file, {
          maxBytes: MAX_IMAGE_SIZE_BYTES,
          preservePng: true,
        });
      } catch (err) {
        setPhotoFile(null);
        setPhotoAction('keep');
        setFieldErrors((prev) => ({
          ...prev,
          photo: err?.message || 'Unable to shrink that image. Try another file.',
        }));
        return;
      }
    }
    const sizeError = validateImage(working);
    if (sizeError) {
      setPhotoFile(null);
      setPhotoAction('keep');
      setFieldErrors((prev) => ({ ...prev, photo: sizeError }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(String(reader.result || ''));
      setCropSourceFile(working);
      setCropPosition({ x: 0, y: 0 });
      setCropZoom(1);
      setCropPixels(null);
      setCropModalOpen(true);
      setFieldErrors((prev) => ({ ...prev, photo: '' }));
    };
    reader.onerror = () => {
      setFieldErrors((prev) => ({ ...prev, photo: 'Unable to preview selected image.' }));
    };
    reader.readAsDataURL(working);
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setPhotoAction('remove');
    setFieldErrors((prev) => ({ ...prev, photo: '' }));
    setMessage({ type: '', text: '' });
  }

  function handleCancelChanges() {
    setDisplayName(initialProfile.displayName);
    setAffiliation(initialProfile.affiliation);
    setAvatarUrl(initialProfile.avatarUrl);
    setAvatarPath(initialProfile.avatarPath);
    setAvatarBucket(initialProfile.avatarBucket);
    setPhotoFile(null);
    setPhotoAction('keep');
    setCropModalOpen(false);
    setCropImageSrc('');
    setCropSourceFile(null);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCropPixels(null);
    setPassword('');
    setConfirmPassword('');
    setShowGooglePasswordFields(false);
    setFieldErrors({ displayName: '', affiliation: '', photo: '', password: '' });
    setMessage({ type: '', text: '' });
  }

  function closeCropModal() {
    setCropModalOpen(false);
    setCropImageSrc('');
    setCropSourceFile(null);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCropPixels(null);
    setCropProcessing(false);
  }

  async function applyPhotoCrop() {
    if (!cropImageSrc || !cropPixels || !cropSourceFile) return;
    setCropProcessing(true);
    try {
      let croppedFile = await buildCroppedFile(cropImageSrc, cropPixels, cropSourceFile);
      if (croppedFile.size > MAX_IMAGE_SIZE_BYTES) {
        croppedFile = await compressImageFile(croppedFile, {
          maxBytes: MAX_IMAGE_SIZE_BYTES,
          preservePng: true,
        });
      }
      const errorMessage = validateImage(croppedFile);
      if (errorMessage) {
        setFieldErrors((prev) => ({ ...prev, photo: errorMessage }));
        return;
      }
      setPhotoFile(croppedFile);
      setPhotoAction('replace');
      setFieldErrors((prev) => ({ ...prev, photo: '' }));
      closeCropModal();
    } catch (error) {
      setFieldErrors((prev) => ({ ...prev, photo: error.message || 'Unable to crop image.' }));
    } finally {
      setCropProcessing(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    const trimmedName = displayName.trim();
    const nextErrors = { displayName: '', affiliation: '', photo: '', password: '' };
    if (!trimmedName) nextErrors.displayName = 'Display name is required.';
    if (!affiliation) nextErrors.affiliation = 'Affiliation is required.';
    if (photoAction === 'replace' && photoFile) nextErrors.photo = validateImage(photoFile);

    if (password || confirmPassword) {
      if (password.length < 6) nextErrors.password = 'New password must be at least 6 characters.';
      else if (password !== confirmPassword) nextErrors.password = 'Passwords do not match.';
    }

    setFieldErrors(nextErrors);
    if (nextErrors.displayName || nextErrors.affiliation || nextErrors.photo || nextErrors.password) {
      setMessage({ type: 'error', text: 'Please fix the highlighted fields before saving.' });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to update your profile.');

      let nextAvatarUrl = initialProfile.avatarUrl;
      let nextAvatarPath = initialProfile.avatarPath;
      let nextAvatarBucket = initialProfile.avatarBucket || PROFILE_AVATAR_BUCKET;

      if (photoAction === 'remove') {
        if (initialProfile.avatarPath) {
          await supabase.storage.from(initialProfile.avatarBucket || PROFILE_AVATAR_BUCKET).remove([initialProfile.avatarPath]);
        }
        nextAvatarUrl = '';
        nextAvatarPath = '';
        nextAvatarBucket = PROFILE_AVATAR_BUCKET;
      } else if (photoAction === 'replace' && photoFile) {
        const extension = photoFile.type === 'image/png' ? 'png' : 'jpg';
        const originalNameWithoutExt = photoFile.name.replace(/\.[^/.]+$/, '');
        const safeName = sanitizeFileName(originalNameWithoutExt);
        const filePath = `profile-avatars/${user.id}/${Date.now()}-${safeName}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PROFILE_AVATAR_BUCKET)
          .upload(filePath, photoFile, { upsert: true, cacheControl: '3600' });
        if (uploadError) throw uploadError;

        if (initialProfile.avatarPath && initialProfile.avatarPath !== filePath) {
          await supabase.storage.from(initialProfile.avatarBucket || PROFILE_AVATAR_BUCKET).remove([initialProfile.avatarPath]);
        }

        const { data: publicUrlData } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(filePath);
        nextAvatarUrl = publicUrlData?.publicUrl || '';
        nextAvatarPath = filePath;
        nextAvatarBucket = PROFILE_AVATAR_BUCKET;
      }

      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
        setHasEmailPassword(true);
      }

      const lastLogin = new Date().toISOString();
      const fullProfilePayload = {
        display_name: trimmedName,
        affiliation,
        avatar_url: nextAvatarUrl || null,
        avatar_path: nextAvatarPath || null,
        avatar_bucket: nextAvatarBucket || PROFILE_AVATAR_BUCKET,
        last_login: lastLogin,
      };

      let { data: updatedProfileRow, error: profileError } = await supabase
        .from('users')
        .update(fullProfilePayload)
        .eq('user_id', user.id)
        .select('user_id')
        .maybeSingle();

      if (profileError && String(profileError.message || '').toLowerCase().includes('avatar_')) {
        const fallback = await supabase
          .from('users')
          .update({
            display_name: trimmedName,
            affiliation,
            last_login: lastLogin,
          })
          .eq('user_id', user.id)
          .select('user_id')
          .maybeSingle();
        updatedProfileRow = fallback.data;
        profileError = fallback.error;
      }

      // If no row was updated, create the profile row so settings persist after reload.
      if (!profileError && !updatedProfileRow) {
        const { error: insertProfileError } = await supabase.from('users').insert({
          user_id: user.id,
          email: user.email,
          password_hash: '[Supabase Auth]',
          display_name: trimmedName,
          affiliation,
          avatar_url: nextAvatarUrl || null,
          avatar_path: nextAvatarPath || null,
          avatar_bucket: nextAvatarBucket || PROFILE_AVATAR_BUCKET,
          is_admin: false,
          created_at: user.created_at || lastLogin,
          last_login: lastLogin,
        });
        profileError = insertProfileError;
      }
      if (profileError) throw profileError;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          display_name: trimmedName,
          affiliation,
          avatar_url: nextAvatarUrl || null,
          avatar_path: nextAvatarPath || null,
          avatar_bucket: nextAvatarBucket || PROFILE_AVATAR_BUCKET,
          has_password: hasEmailPassword || Boolean(password),
        },
      });
      if (metadataError) throw metadataError;

      setDisplayName(trimmedName);
      setAvatarUrl(nextAvatarUrl);
      setAvatarPath(nextAvatarPath);
      setAvatarBucket(nextAvatarBucket);
      setInitialProfile({
        displayName: trimmedName,
        affiliation,
        avatarUrl: nextAvatarUrl,
        avatarPath: nextAvatarPath,
        avatarBucket: nextAvatarBucket,
      });
      setPassword('');
      setConfirmPassword('');
      setShowGooglePasswordFields(false);
      setPhotoFile(null);
      setPhotoAction('keep');
      setFieldErrors({ displayName: '', affiliation: '', photo: '', password: '' });
      setMessage({ type: 'success', text: 'Profile settings saved successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save profile settings.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.toUpperCase() !== 'DELETE ACCOUNT') return;
    setDeleteLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: reviews } = await supabase
        .from('reviews')
        .select('review_id')
        .eq('user_id', user.id);

      if (reviews && reviews.length > 0) {
        for (const review of reviews) {
          const folderPath = `review-images/${review.review_id}/`;
          const { data: files } = await supabase.storage.from('review-media').list(folderPath);
          if (files && files.length > 0) {
            const filesToDelete = files.map((file) => `${folderPath}${file.name}`);
            await supabase.storage.from('review-media').remove(filesToDelete);
          }
        }
      }

      if (avatarPath) {
        await supabase.storage.from(avatarBucket || PROFILE_AVATAR_BUCKET).remove([avatarPath]);
      }

      const { error: deleteError } = await supabase.from('users').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;

      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      setMessage({ type: 'error', text: `Delete failed: ${error.message}` });
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  const pageBgClass = dark
    ? 'bg-[#0f1219] text-white'
    : 'bg-white text-black';
  const panelClass = dark
    ? 'border-white/10 bg-[#161b26]'
    : 'border-black/10 bg-white';
  const inputClass = dark
    ? 'w-full rounded-xl border border-white/10 bg-[#1e2430] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25'
    : 'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none placeholder:text-black/40 focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25';

  if (loading) {
    return (
      <div className={`flex min-h-[calc(100vh-3.5rem)] items-center justify-center ${pageBgClass}`}>
        <p className={dark ? 'text-white/70' : 'text-black/70'}>Loading profile settings...</p>
      </div>
    );
  }

  return (
    <div className={`relative min-h-[calc(100vh-3.5rem)] overflow-hidden ${pageBgClass}`}>
      {dark ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      ) : (
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
      )}

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-black tracking-tight">Profile Settings</h1>
          <p className={`mt-1 text-sm ${dark ? 'text-white/70' : 'text-black/65'}`}>
            Update your account details and profile appearance on reviews.
          </p>
        </header>

        {message.text && (
          <div className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSave} className={`rounded-3xl border p-6 sm:p-8 ${panelClass}`}>
            <div className="space-y-7">
              <section className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#f5bf3e]">Profile Photo</h2>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border text-lg font-bold ${
                      dark ? 'border-white/15 bg-white/10 text-white/90' : 'border-black/15 bg-black/5 text-black/80'
                    }`}>
                      {effectiveAvatar ? (
                        <img src={effectiveAvatar} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <span>{previewInitials}</span>
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Profile picture</p>
                      <p className={`text-xs ${dark ? 'text-white/60' : 'text-black/60'}`}>JPG or PNG, max 5MB</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-lg bg-[#f5bf3e] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#ffd15e]">
                      Upload Photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                        dark ? 'border border-white/15 text-white/85 hover:bg-white/10' : 'border border-black/15 text-black/80 hover:bg-black/5'
                      }`}
                    >
                      Remove Photo
                    </button>
                  </div>
                </div>
                {fieldErrors.photo && <p className="mt-3 text-sm text-red-300">{fieldErrors.photo}</p>}
              </section>

              <section className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#f5bf3e]">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className={inputClass}
                    placeholder="How your name appears to others"
                    required
                  />
                  {fieldErrors.displayName && <p className="mt-2 text-sm text-red-300">{fieldErrors.displayName}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#f5bf3e]">Affiliation</label>
                  <select
                    value={affiliation}
                    onChange={(event) => setAffiliation(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select affiliation</option>
                    {AFFILIATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {fieldErrors.affiliation && <p className="mt-2 text-sm text-red-300">{fieldErrors.affiliation}</p>}
                </div>
              </section>

              <section className="space-y-4 border-t border-white/10 pt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#f5bf3e]">Password</h2>
                {googleAuthUser && !hasEmailPassword ? (
                  <div className={`rounded-xl border px-4 py-3 ${dark ? 'border-white/15 bg-white/5' : 'border-black/15 bg-black/[0.03]'}`}>
                    <p className={`text-sm ${dark ? 'text-white/80' : 'text-black/75'}`}>
                      You signed in with Google. You can keep using Google, or set a password here if you also want to log in with email and password.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowGooglePasswordFields((value) => !value)}
                      className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                        dark ? 'border border-white/20 text-white/85 hover:bg-white/10' : 'border border-black/20 text-black/80 hover:bg-black/5'
                      }`}
                    >
                      {showGooglePasswordFields ? 'Cancel Password Setup' : 'Set Password'}
                    </button>
                  </div>
                ) : (
                  <></>
                )}
                {(!googleAuthUser || hasEmailPassword || showGooglePasswordFields) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#f5bf3e]">New Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className={inputClass}
                        placeholder="Minimum 6 characters"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#f5bf3e]">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
                {fieldErrors.password && <p className="text-sm text-red-300">{fieldErrors.password}</p>}
              </section>

              <div className="border-t border-white/10 pt-6">
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleCancelChanges}
                      disabled={saving || !isDirty}
                      className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                        dark ? 'border border-white/15 text-white/85 hover:bg-white/10 disabled:opacity-45' : 'border border-black/15 text-black/85 hover:bg-black/5 disabled:opacity-45'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!canSave}
                      className="rounded-xl bg-[#f5bf3e] px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-black transition hover:bg-[#ffd15e] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>

                  {!dangerZoneExpanded ? (
                    <button
                      type="button"
                      onClick={() => setDangerZoneExpanded(true)}
                      className={`text-xs font-medium transition-colors ${
                        dark ? 'text-red-400 hover:text-red-300' : 'text-red-700 hover:text-red-800'
                      }`}
                    >
                      Delete account
                    </button>
                  ) : (
                    <div
                      className={`w-full max-w-md rounded-2xl border p-4 ${dark ? 'border-red-500/30 bg-red-950/20' : 'border-red-200 bg-red-50/90'}`}
                    >
                      <p className={`text-sm leading-relaxed ${dark ? 'text-red-100/85' : 'text-red-900/85'}`}>
                        Deleting your account permanently removes your profile, reviews, and uploaded images. This cannot be undone.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal(true)}
                          className="rounded-lg border border-red-500/90 bg-red-500/20 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-500 hover:text-white"
                        >
                          Delete my account
                        </button>
                        <button
                          type="button"
                          onClick={() => setDangerZoneExpanded(false)}
                          className={`text-xs font-medium ${dark ? 'text-white/50 hover:text-white/75' : 'text-black/50 hover:text-black/75'}`}
                        >
                          Hide
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          <aside className="space-y-6">
            <div className={`rounded-3xl border p-5 ${panelClass}`}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#f5bf3e]">Profile Preview</h3>
              <p className={`mt-1 text-xs ${dark ? 'text-white/60' : 'text-black/60'}`}>
                This is how your profile appears on reviews.
              </p>
              <div className={`mt-4 rounded-2xl border p-4 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-black/10 bg-[#faf7ef]'}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border text-sm font-bold ${
                    dark ? 'border-white/15 bg-white/10 text-white/90' : 'border-black/15 bg-black/5 text-black/80'
                  }`}>
                    {effectiveAvatar ? (
                      <img src={effectiveAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{previewInitials}</span>
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{displayName.trim() || 'Your Name'}</p>
                    <p className={`text-xs ${dark ? 'text-white/65' : 'text-black/60'}`}>
                      {AFFILIATION_OPTIONS.find((option) => option.value === affiliation)?.label || 'No affiliation selected'}
                    </p>
                  </div>
                </div>
                <p className={`mt-3 text-xs leading-relaxed ${dark ? 'text-white/70' : 'text-black/65'}`}>
                  "Loved the food and the quick service. Definitely coming back!"
                </p>
              </div>
            </div>

          </aside>
        </div>
      </section>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border border-red-500/50 p-6 ${dark ? 'bg-[#1a1d26] text-white' : 'bg-white text-black'}`}>
            <h2 className="text-xl font-black uppercase text-red-400">Confirm Delete</h2>
            <p className="mt-2 text-sm opacity-80">
              Type <span className="font-black">DELETE ACCOUNT</span> to permanently remove this account.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="DELETE ACCOUNT"
              className={`mt-4 w-full rounded-xl border px-4 py-3 text-center font-bold uppercase outline-none ${dark ? 'border-white/15 bg-black/30 text-white focus:border-red-500' : 'border-black/20 bg-white focus:border-red-500'}`}
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText.toUpperCase() !== 'DELETE ACCOUNT'}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold uppercase text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {deleteLoading ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold uppercase transition ${
                  dark ? 'border-white/20 hover:bg-white/10' : 'border-black/20 hover:bg-black/5'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {cropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-2xl border p-5 ${dark ? 'border-white/15 bg-[#141925] text-white' : 'border-black/15 bg-white text-black'}`}>
            <h2 className="text-lg font-black uppercase tracking-wide text-[#f5bf3e]">Crop Profile Photo</h2>
            <p className={`mt-1 text-sm ${dark ? 'text-white/70' : 'text-black/65'}`}>
              Drag to position your photo, then zoom to frame it.
            </p>

            <div className={`relative mt-4 h-[360px] overflow-hidden rounded-xl border ${dark ? 'border-white/10 bg-black/40' : 'border-black/10 bg-black/5'}`}>
              {cropImageSrc && (
                <Cropper
                  image={cropImageSrc}
                  crop={cropPosition}
                  zoom={cropZoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCropPosition}
                  onZoomChange={setCropZoom}
                  onCropComplete={(_, areaPixels) => setCropPixels(areaPixels)}
                />
              )}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#f5bf3e]">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="w-full accent-[#f5bf3e]"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCropModal}
                disabled={cropProcessing}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  dark ? 'border border-white/20 text-white/85 hover:bg-white/10' : 'border border-black/20 text-black/80 hover:bg-black/5'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyPhotoCrop}
                disabled={cropProcessing || !cropPixels}
                className="rounded-lg bg-[#f5bf3e] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#ffd15e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cropProcessing ? 'Applying...' : 'Apply Crop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}