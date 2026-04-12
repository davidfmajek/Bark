import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { AFFILIATION_OPTIONS } from '../lib/affiliations.js';

export function ProfilePage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // Form State
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // NEW STATE
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Custom Dropdown State
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function getProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('users').select('display_name, affiliation').eq('user_id', user.id).single();
          if (data) {
            setDisplayName(data.display_name || '');
            setAffiliation(data.affiliation || '');
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  // 1. Initial form validation & trigger
  function handleSubmitTrigger(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Validation: Check if passwords match
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match. Please re-type your new password.' });
      return;
    }

    // Validation: Enforce minimum length if a password is being set
    if (password && password.length < 6) {
        setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
        return;
    }

    setShowConfirmModal(true);
  }

  // 2. The actual update logic
  async function confirmUpdate() {
    setShowConfirmModal(false);
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.auth.updateUser({ data: { display_name: displayName } });
      
      if (password) await supabase.auth.updateUser({ password });
      
      const { error: dbError } = await supabase
        .from('users')
        .update({ display_name: displayName, affiliation: affiliation })
        .eq('user_id', user.id);

      if (dbError) throw dbError;
      
      setMessage({ type: 'success', text: 'Success! Your profile has been updated.' });
      setPassword('');
      setConfirmPassword(''); // Clear the confirmation field
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  const inputClass = `mt-1 block w-full rounded-lg border px-4 py-2.5 outline-none transition-all duration-200 shadow-sm font-medium ${
    dark 
      ? 'bg-[#1a1d26] border-white/10 text-white focus:border-[#f5bf3e] focus:ring-2 focus:ring-[#f5bf3e]/20' 
      : 'bg-white border-gray-400 text-black focus:border-black focus:ring-4 focus:ring-[#f5bf3e]/40'
  }`;

  return (
    <div className={`relative min-h-[calc(100vh-3.5rem)] overflow-hidden ${dark ? 'bg-[#0f1219]' : 'bg-[#fcfcfc]'}`}>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-[10%] -right-[10%] h-[50%] w-[50%] rounded-full blur-[120px] opacity-10 ${dark ? 'bg-[#f5bf3e]' : 'bg-[#f5bf3e]'}`} />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className={`font-display text-3xl font-black uppercase tracking-tight ${dark ? 'text-white' : 'text-black'}`}>
          Edit profile
        </h1>

        {message.text && (
          <div className={`mt-6 flex items-center gap-3 p-4 rounded-lg border-2 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-600 text-green-900' 
              : 'bg-red-50 border-[#a32638] text-[#a32638]'
          }`}>
            <span className="font-bold">{message.type === 'success' ? '✓' : '✕'}</span>
            <p className="text-sm font-bold">{message.text}</p>
          </div>
        )}

        <form onSubmit={handleSubmitTrigger} className="mt-8 space-y-6">
          {/* DISPLAY NAME */}
          <div>
            <label className={`text-xs font-black uppercase tracking-widest mb-1 block ${dark ? 'text-white/50' : 'text-black/60'}`}>
              Display Name
            </label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} required />
          </div>

          {/* AFFILIATION DROPDOWN */}
          <div className="relative" ref={dropdownRef}>
            <label className={`text-xs font-black uppercase tracking-widest mb-1 block ${dark ? 'text-white/50' : 'text-black/60'}`}>
              Affiliation to UMBC
            </label>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`${inputClass} flex items-center justify-between text-left hover:border-[#f5bf3e]`}
            >
              <span className={!affiliation ? (dark ? 'text-white/40' : 'text-black/40') : ''}>
                {affiliation
                  ? (AFFILIATION_OPTIONS.find((o) => o.value === affiliation)?.label ?? affiliation)
                  : 'Select affiliation'}
              </span>
              <svg className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className={`absolute z-50 mt-2 w-full rounded-xl border-2 p-1.5 shadow-2xl ${
                dark ? 'bg-[#1a1d26] border-white/10' : 'bg-white border-black shadow-black/10'
              }`}>
                {AFFILIATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setAffiliation(opt.value); setIsOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      affiliation === opt.value 
                        ? 'bg-[#f5bf3e] text-black' 
                        : (dark ? 'text-white hover:bg-white/5' : 'text-black hover:bg-[#f5bf3e]/10')
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* NEW PASSWORD SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`text-xs font-black uppercase tracking-widest mb-1 block ${dark ? 'text-white/50' : 'text-black/60'}`}>
                New Password
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className={inputClass} 
                placeholder="New password" 
              />
            </div>
            <div>
              <label className={`text-xs font-black uppercase tracking-widest mb-1 block ${dark ? 'text-white/50' : 'text-black/60'}`}>
                Confirm Password
              </label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className={inputClass} 
                placeholder="Re-type password" 
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg py-4 font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${
              loading 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-[#f5bf3e] text-[#000000] hover:bg-[#000000] hover:text-[#f5bf3e]'
            }`}
          >
            {loading ? 'Processing...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* CONFIRMATION MODAL OVERLAY */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-2xl p-8 border-2 shadow-2xl ${
            dark ? 'bg-[#1a1d26] border-white/10 text-white' : 'bg-white border-black text-black'
          }`}>
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Confirm Changes</h3>
            <p className={`mb-8 font-medium ${dark ? 'text-white/60' : 'text-black/60'}`}>
              Are you sure you want to save these profile updates?
              {password && " Since you provided a new password, you will need to use it next time you log in."}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={confirmUpdate}
                className="flex-1 rounded-lg bg-[#f5bf3e] py-3 font-black uppercase tracking-widest text-black hover:bg-black hover:text-[#f5bf3e] transition-colors border-2 border-transparent hover:border-[#f5bf3e]"
              >
                Yes, Save
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className={`flex-1 rounded-lg py-3 font-black uppercase tracking-widest transition-colors border-2 ${
                  dark 
                    ? 'border-white/10 hover:bg-white/5' 
                    : 'border-black/10 hover:bg-black/5'
                }`}
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