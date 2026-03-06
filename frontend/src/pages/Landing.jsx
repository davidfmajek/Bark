import { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Landing() {
  const { isAuthenticated, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/main', { replace: true });
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
        navigate('/main', { replace: true });
      } else {
        const data = await signUp(email, password);

        if (data?.session) {
          navigate('/main', { replace: true });
        } else {
          try {
            await signIn(email, password);
            navigate('/main', { replace: true });
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f18]">
        <p className="font-body text-white/70">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0d14] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.10),_transparent_30%),linear-gradient(180deg,_#101523_0%,_#0a0d14_55%,_#090b11_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none">
        <div className="opacity-[0.08] scale-[1.65] sm:scale-[1.9]">
          <RetrieverMark />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col items-center justify-center">
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-3 text-[#f5bf3e]">
            <PawIcon className="h-12 w-12 sm:h-14 sm:w-14" />
            <span className="font-body text-5xl font-extrabold tracking-tight sm:text-6xl">
              BARK!
            </span>
          </div>
          <p className="font-body text-xl font-semibold text-white/95">
            Honest Reviews. Real Retrievers.
          </p>
        </div>

        <div className="w-full rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(30,32,44,0.92),rgba(20,22,32,0.86))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <h1 className="text-center font-body text-4xl font-extrabold tracking-tight text-white">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
          <div className="mt-5 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block font-body text-base font-semibold text-white/92">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-[#121621] px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25"
                placeholder="example@umbc.edu"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block font-body text-base font-semibold text-white/92">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-white/10 bg-[#121621] px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25"
                placeholder="••••••"
              />
              <div className="mt-2 flex items-center justify-between">
                {mode === 'signup' ? <p className="text-xs text-white/45">At least 6 characters</p> : <span />}
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="font-body text-sm font-semibold text-[#f5bf3e] transition-colors hover:text-[#ffd86e]"
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
              <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#f5bf3e] px-4 py-3 text-lg font-extrabold text-[#16181f] shadow-[0_10px_30px_rgba(245,191,62,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#ffd15e] disabled:translate-y-0 disabled:opacity-60"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center font-body text-lg text-white/72">
            {mode === 'login' ? 'New to BARK?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setNotice('');
              }}
              className="font-semibold text-[#f5bf3e] underline decoration-[#f5bf3e]/60 underline-offset-3 transition-colors hover:text-[#ffd86e]"
            >
              {mode === 'login' ? 'Create Account' : 'Sign In'}
            </button>
          </p>
        </div>

        <p className="mt-14 text-center font-body text-2xl font-medium text-white/65">
          An app for UMBC by UMBC students
        </p>
      </div>
    </div>
  );
}

function PawIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="19" cy="19" rx="6" ry="9" transform="rotate(-28 19 19)" />
      <ellipse cx="32" cy="13" rx="6" ry="9" transform="rotate(-8 32 13)" />
      <ellipse cx="45" cy="18" rx="6" ry="9" transform="rotate(18 45 18)" />
      <ellipse cx="52" cy="31" rx="6" ry="8" transform="rotate(34 52 31)" />
      <path d="M30 29c-7 0-15 7-15 16 0 7 6 11 11 11 4 0 6-2 9-4 3 2 5 4 9 4 7 0 11-5 11-11 0-9-9-16-16-16-3 0-5 1-9 0Z" />
    </svg>
  );
}

function RetrieverMark() {
  return (
    <svg width="260" height="220" viewBox="0 0 260 220" fill="none" aria-hidden="true">
      <path
        d="M67 111c-9-27 10-61 42-70 31-9 68 5 87 30 13 18 21 44 12 65-8 20-32 31-54 28-12-2-23-8-34-15-11-8-20-15-32-16-8 0-16 2-21-5-4-5-4-11 0-17Z"
        fill="white"
      />
      <path
        d="M173 95c11-10 21-27 16-42-4-13-22-20-35-17-12 3-20 12-22 23-1 7 1 14 7 19 7 6 17 7 25 8 3 1 6 1 9 1Z"
        fill="white"
      />
      <circle cx="141" cy="102" r="5" fill="#0a0d14" />
      <path
        d="M123 120c10 3 20 4 31 3 7-1 13-3 18 1 5 4 4 12 0 17-9 10-27 10-39 7-11-2-25-8-27-19-1-7 8-11 17-9Z"
        fill="#0a0d14"
      />
      <path
        d="M116 142c8 7 15 13 28 16 14 2 25-1 36-8"
        stroke="#0a0d14"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M84 119c-13-5-23-17-26-31"
        stroke="#0a0d14"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
