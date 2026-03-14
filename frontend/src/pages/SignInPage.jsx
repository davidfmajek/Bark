import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

const AFFILIATION_OPTIONS = [
  { value: 'Student', label: 'Student' },
  { value: 'Professor', label: 'Professor' },
  { value: 'Prospective_Student', label: 'Prospective Student' },
  { value: 'Incoming_Student', label: 'Incoming Student' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Other', label: 'Other' },
];

export function SignInPage() {
  const { isAuthenticated, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [affiliationOther, setAffiliationOther] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/', { replace: true });
      } else {
        const affiliationValue = affiliation === 'Other' ? (affiliationOther?.trim() || 'Other') : affiliation;
        const data = await signUp(email, password, {
          display_name: displayName.trim(),
          affiliation: affiliationValue,
        });
        if (data?.session) {
          navigate('/', { replace: true });
        } else {
          try {
            await signIn(email, password);
            navigate('/', { replace: true });
          } catch (signInError) {
            setNotice('Account created, but automatic sign-in was blocked. Check your Supabase email confirmation settings or verify your email first.');
            setMode('login');
            setPassword('');
            setError(signInError?.message || '');
          }
        }
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email first, then click Forgot Password.');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (resetError) {
      setError(resetError.message || 'Unable to send reset email.');
      return;
    }
    setNotice('Password reset email sent. Check your inbox.');
  };

  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${dark ? 'bg-[#0f1219]' : 'bg-white'}`}>
        <p className={`font-body ${dark ? 'text-white/70' : 'text-black/70'}`}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen overflow-hidden px-4 py-10 ${dark ? 'bg-[#0f1219] text-white' : 'bg-white text-black'}`}>
      {dark ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
      ) : (
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
      )}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col items-center justify-center">
        <div className="absolute right-4 top-4">
          <button
            type="button"
            onClick={toggleTheme}
            className={`rounded-full p-2 transition-colors ${dark ? 'text-white/80 hover:bg-white/10 hover:text-[#f5bf3e]' : 'text-black/70 hover:bg-black/5 hover:text-[#D4A017]'}`}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>
        </div>
        <Link to="/" className={`mb-8 flex items-center justify-center gap-2 transition-opacity hover:opacity-90 ${dark ? 'text-white' : 'text-black'}`}>
          <img src="/logo.png" alt="" className="h-14 w-auto sm:h-16 sm:w-auto" />
          <span className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">BARK!</span>
        </Link>
        <p className={`mb-10 text-center font-body text-xl font-semibold ${dark ? 'text-white/90' : 'text-black/70'}`}>
          Honest Reviews. Real Retrievers.
        </p>

        <div className={`w-full rounded-2xl border p-8 shadow-xl ${dark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'}`}>
          <h1 className={`text-center font-display text-3xl font-bold ${dark ? 'text-white' : 'text-black'}`}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
          <div className={`mt-5 h-px bg-gradient-to-r from-transparent to-transparent ${dark ? 'via-white/10' : 'via-black/10'}`} />

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {mode === 'signup' && (
              <div>
                <label htmlFor="display_name" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                  Username
                </label>
                <input
                  id="display_name"
                  type="text"
                  autoComplete="username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required={mode === 'signup'}
                  className={dark ? 'w-full rounded-xl border border-white/10 bg-[#1e2430] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25' : 'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none placeholder:text-black/40 focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25'}
                  placeholder="How you want to be shown"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={dark ? 'w-full rounded-xl border border-white/10 bg-[#1e2430] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25' : 'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none placeholder:text-black/40 focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25'}
                placeholder="example@umbc.edu"
              />
            </div>
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="affiliation" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                    Affiliation to UMBC
                  </label>
                  <select
                    id="affiliation"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    required
                    className={dark ? 'w-full rounded-xl border border-white/10 bg-[#1e2430] px-4 py-3 text-white outline-none focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25' : 'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25'}
                  >
                    <option value="">Select affiliation</option>
                    {AFFILIATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {affiliation === 'Other' && (
                  <div>
                    <label htmlFor="affiliation_other" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                      Please specify your affiliation
                    </label>
                    <input
                      id="affiliation_other"
                      type="text"
                      value={affiliationOther}
                      onChange={(e) => setAffiliationOther(e.target.value)}
                      className={dark ? 'w-full rounded-xl border border-white/10 bg-[#1e2430] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25' : 'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none placeholder:text-black/40 focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25'}
                      placeholder="e.g. Visitor, Staff"
                    />
                  </div>
                )}
              </>
            )}
            <div>
              <label htmlFor="password" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`w-full rounded-xl border pr-12 py-3 outline-none ${dark ? 'border-white/10 bg-[#1e2430] pl-4 text-white placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25' : 'border-black/15 bg-white pl-4 text-black placeholder:text-black/40 focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25'}`}
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 transition-colors ${dark ? 'text-white/60 hover:text-white/90' : 'text-black/50 hover:text-black/80'}`}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                {mode === 'signup' ? <p className={`text-xs ${dark ? 'text-white/45' : 'text-black/55'}`}>At least 6 characters</p> : <span />}
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className={`font-body text-sm font-semibold ${dark ? 'text-[#e8b84a] hover:text-[#f5bf3e]' : 'text-[#D4A017] hover:underline'}`}
                >
                  Forgot Password?
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={dark ? 'w-full rounded-xl bg-[#f5bf3e] px-4 py-3 text-lg font-extrabold text-[#16181f] shadow-[0_8px_24px_rgba(245,191,62,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#ffd15e] disabled:translate-y-0 disabled:opacity-60' : 'w-full rounded-xl bg-[#D4A017] px-4 py-3 text-lg font-extrabold text-black shadow-md transition-all hover:bg-[#c4920f] disabled:opacity-60'}
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className={`mt-6 text-center font-body text-lg ${dark ? 'text-white/72' : 'text-black/70'}`}>
            {mode === 'login' ? 'New to BARK?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setNotice('');
                if (mode === 'signup') {
                  setDisplayName('');
                  setAffiliation('');
                  setAffiliationOther('');
                }
              }}
              className={`font-semibold underline underline-offset-3 transition-colors ${dark ? 'text-[#e8b84a] decoration-[#e8b84a]/60 hover:text-[#f5bf3e]' : 'text-[#D4A017] decoration-[#D4A017]/60 hover:text-[#c4920f]'}`}
            >
              {mode === 'login' ? 'Create Account' : 'Sign In'}
            </button>
          </p>
        </div>

        <p className={`mt-14 text-center font-body text-sm ${dark ? 'text-white/50' : 'text-black/55'}`}>
          An app for UMBC by UMBC students
        </p>
      </div>
    </div>
  );
}
