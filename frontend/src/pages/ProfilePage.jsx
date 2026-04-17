import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { AFFILIATION_OPTIONS } from '../lib/affiliations.js';

export function ProfilePage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // --- Form & User State ---
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userProvider, setUserProvider] = useState('email');
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- Modal State ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // --- Dropdown Logic ---
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Initial Data Fetch ---
  useEffect(() => {
    async function getProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Identify if they used Google or Email
          setUserProvider(user.app_metadata.provider || 'email');
          
          const { data } = await supabase.from('users')
            .select('display_name, affiliation')
            .eq('user_id', user.id)
            .single();
            
          if (data) {
            setDisplayName(data.display_name || '');
            setAffiliation(data.affiliation || '');
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  // --- Handle Form Submit ---
  async function handleUpdate(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Validation: If they touch the password fields
    if (password || confirmPassword) {
      if (password.length < 6) {
        setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Passwords do not match.' });
        return;
      }
    }

    setShowConfirmModal(true);
  }

  // --- Confirm and Save Profile/Password ---
  async function confirmUpdate() {
    setShowConfirmModal(false);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Update Password (works for both Email and Google linked accounts)
      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({ password });
        if (pwdError) throw pwdError;
      }
      
      // 2. Update Public Profile
      const { error: profileError } = await supabase.from('users')
        .update({ display_name: displayName, affiliation })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Clear password fields on success
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  // --- Delete Account Logic ---
  async function handleDeleteAccount() {
    // Check text confirmation case-insensitively
    if (deleteConfirmText.toUpperCase() !== 'DELETE ACCOUNT') return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Storage Cleanup (Deleting review images)
      const { data: reviews } = await supabase
        .from('reviews')
        .select('review_id')
        .eq('user_id', user.id);

      if (reviews && reviews.length > 0) {
        for (const review of reviews) {
          const folderPath = `review-images/${review.review_id}/`;
          const { data: files } = await supabase.storage.from('review-media').list(folderPath);
          if (files && files.length > 0) {
            const filesToDelete = files.map(f => `${folderPath}${f.name}`);
            await supabase.storage.from('review-media').remove(filesToDelete);
          }
        }
      }

      // 2. Delete public record 
      // (This triggers the SQL function to delete the Auth account automatically)
      const { error: deleteError } = await supabase.from('users').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;

      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      setMessage({ type: 'error', text: `Delete failed: ${err.message}` });
      setShowDeleteModal(false);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = `mt-1 block w-full rounded-lg border px-4 py-2.5 outline-none transition-all duration-200 shadow-sm font-medium ${
    dark ? 'bg-[#1a1d26] border-white/10 text-white focus:border-[#f5bf3e]' : 'bg-white border-gray-300 text-black focus:border-black'
  }`;

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] py-12 px-4 ${dark ? 'bg-[#0f1219]' : 'bg-[#fcfcfc]'}`}>
      <div className="max-w-2xl mx-auto">
        <h1 className={`text-3xl font-black uppercase tracking-tight mb-8 ${dark ? 'text-white' : 'text-black'}`}>
          Profile Settings
        </h1>

        {message.text && (
          <div className={`mb-6 p-4 rounded-lg border-2 font-bold ${
            message.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Display Name */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest opacity-50 block mb-1">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} required />
          </div>

          {/* Affiliation Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label className="text-xs font-black uppercase tracking-widest opacity-50 block mb-1">Affiliation</label>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className={`${inputClass} flex justify-between items-center text-left`}>
              {AFFILIATION_OPTIONS.find(o => o.value === affiliation)?.label || 'Select Affiliation'}
              <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && (
              <div className={`absolute z-20 mt-2 w-full rounded-xl border-2 shadow-xl p-1 ${dark ? 'bg-[#1a1d26] border-white/10' : 'bg-white border-black'}`}>
                {AFFILIATION_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => { setAffiliation(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-2 rounded-lg font-bold hover:bg-[#f5bf3e] hover:text-black transition-colors ${dark ? 'text-white' : 'text-black'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Password Section (Always visible) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-dashed border-gray-500/20">
            <div className="sm:col-span-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#f5bf3e]">
                {userProvider === 'email' ? 'Change Password' : 'Set New Password'}
              </h3>
              {userProvider !== 'email' && (
                <p className="text-[10px] opacity-50 uppercase mt-1">
                  You logged in via {userProvider}.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest opacity-50 block mb-1">New Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className={inputClass} 
                placeholder="Min. 6 chars" 
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest opacity-50 block mb-1">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className={inputClass} 
              />
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <button type="submit" disabled={loading} className="w-full py-4 rounded-lg bg-[#f5bf3e] text-black font-black uppercase tracking-widest hover:bg-black hover:text-[#f5bf3e] transition-all disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>

            <button 
              type="button" 
              onClick={() => setShowDeleteModal(true)}
              className="w-full py-2 text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </form>
      </div>

      {/* UPDATE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`p-8 rounded-2xl max-w-sm w-full border-2 ${dark ? 'bg-[#1a1d26] border-white/10 text-white' : 'bg-white border-black text-black'}`}>
            <h2 className="text-xl font-black uppercase mb-4">Confirm Save?</h2>
            <div className="flex gap-3">
              <button onClick={confirmUpdate} className="flex-1 py-3 rounded-lg bg-[#f5bf3e] text-black font-black">Yes</button>
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 rounded-lg border border-current font-black">No</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`p-8 rounded-2xl max-w-sm w-full border-2 border-red-500/50 ${dark ? 'bg-[#1a1d26] text-white' : 'bg-white text-black'}`}>
            <h2 className="text-xl font-black uppercase mb-2 text-red-500">Danger Zone</h2>
            <p className="text-sm opacity-70 mb-4 font-medium">
              This will permanently delete your profile, all your reviews, and associated images. 
              Type <span className="font-black text-red-500 underline">DELETE ACCOUNT</span> below to confirm.
            </p>
            
            <input 
              type="text" 
              placeholder="DELETE ACCOUNT"
              className={`w-full mb-6 px-4 py-3 rounded-lg border-2 text-center font-black uppercase transition-all outline-none ${
                dark ? 'bg-black/40 border-white/10 text-white focus:border-red-500 placeholder:text-white/20' : 'bg-gray-100 border-gray-300 focus:border-red-500'
              }`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteAccount} 
                disabled={loading || deleteConfirmText.toUpperCase() !== 'DELETE ACCOUNT'}
                className="w-full py-3 rounded-lg bg-red-50 text-red-500 border-2 border-red-500 font-black uppercase tracking-widest hover:bg-red-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }} 
                className="w-full py-3 rounded-lg border border-current font-black uppercase tracking-widest opacity-50 hover:opacity-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}