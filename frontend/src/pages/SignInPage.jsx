import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { AFFILIATION_OPTIONS } from '../lib/affiliations.js';

function isUmbcEmail(addr) {
  return /@umbc\.edu$/i.test((addr || '').trim());
}

function hasCompletedProfile(user) {
  const displayName = user?.user_metadata?.display_name;
  const affiliation = user?.user_metadata?.affiliation;
  return Boolean((displayName || '').trim() && (affiliation || '').trim());
}

function getGoogleProfileSeed(user) {
  const displayName =
    (user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '')
      .trim();
  const affiliation = (user?.user_metadata?.affiliation || '').trim();
  return { displayName, affiliation };
}

function isGoogleAuthUser(user) {
  const provider = String(user?.app_metadata?.provider ?? '').toLowerCase();
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers.map((p) => String(p).toLowerCase())
    : [];
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  return (
    provider === 'google' ||
    providers.includes('google') ||
    identities.some((i) => String(i?.provider ?? '').toLowerCase() === 'google')
  );
}

/** Set before OAuth from signup step 1; cleared after profile step or sign-out */
const SIGNUP_GOOGLE_PENDING = 'bark_signup_google_pending';
/** Set before OAuth from Sign In + Google so URL sync does not reset mode before we resolve profile */
const LOGIN_GOOGLE_OAUTH_PENDING = 'bark_login_google_oauth_pending';

export function SignInPage() {
  const { user, isAuthenticated, loading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [affiliationOther, setAffiliationOther] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  /** Sign-up wizard: 1 = email (or Google), 2 = profile + password (or profile only for Google) */
  const [signupStep, setSignupStep] = useState(1);
  /** True after Google OAuth from signup flow — user must finish username / affiliation on step 2 */
  const [needsGoogleProfileCompletion, setNeedsGoogleProfileCompletion] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
    const googleIdToken = hashParams.get('google_id_token') || searchParams.get('google_id_token');
    const oauthError = searchParams.get('oauth_error');
    if (!googleIdToken && !oauthError) return;

    let cancelled = false;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('google_id_token');
    nextParams.delete('oauth_error');
    setSearchParams(nextParams, { replace: true });
    if (hashParams.has('google_id_token')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    const resolveOAuthReturn = async () => {
      if (oauthError) {
        if (!cancelled) {
          setError('Google sign-in failed. Please try again.');
          setOauthBusy(false);
        }
        return;
      }
      if (!googleIdToken) return;
      if (!cancelled) {
        setOauthBusy(true);
        setError('');
      }
      const { error: idTokenError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleIdToken,
      });
      if (idTokenError && !cancelled) {
        setError(idTokenError.message || 'Google sign-in failed.');
        setOauthBusy(false);
      }
    };

    resolveOAuthReturn();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;

    let cancelled = false;

    const resolve = async () => {
      const signedInWithGoogle = isGoogleAuthUser(user);

      if (signedInWithGoogle && !isUmbcEmail(user.email)) {
        sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
        sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
        setNeedsGoogleProfileCompletion(false);
        signOut();
        setError('Only @umbc.edu email addresses can sign in with Google.');
        return;
      }

      if (signedInWithGoogle && sessionStorage.getItem(SIGNUP_GOOGLE_PENDING) === '1') {
        const seed = getGoogleProfileSeed(user);
        sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
        if (!cancelled) {
          setMode('signup');
          setSignupStep(2);
          setEmail(user.email ?? '');
          setDisplayName(seed.displayName);
          setAffiliation(seed.affiliation);
          setNeedsGoogleProfileCompletion(true);
        }
        return;
      }

      // Safety net: ensure a public.users profile row exists and is complete.
      // This fixes Google OAuth signups that skip affiliation metadata (and therefore skip the DB sync trigger).
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('user_id, display_name, affiliation')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profileError) {
        setError(profileError.message || 'Unable to verify your account profile right now.');
        return;
      }

      sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
      const seed = getGoogleProfileSeed(user);
      const dbHasProfile =
        !!profile &&
        Boolean(String(profile.display_name ?? '').trim()) &&
        Boolean(String(profile.affiliation ?? '').trim());
      const authHasProfile = hasCompletedProfile(user);

      if (!dbHasProfile || !authHasProfile) {
        setMode('signup');
        setSignupStep(2);
        setEmail(user.email ?? '');
        setDisplayName(seed.displayName);
        setAffiliation(seed.affiliation);
        // Only hide password field when the user is signed in via Google OAuth
        setNeedsGoogleProfileCompletion(signedInWithGoogle);
        return;
      }

      if (!cancelled) navigate('/', { replace: true });
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [loading, isAuthenticated, user, navigate, signOut]);

  useEffect(() => {
    if (sessionStorage.getItem(SIGNUP_GOOGLE_PENDING) === '1') return;
    if (sessionStorage.getItem(LOGIN_GOOGLE_OAUTH_PENDING) === '1') return;
    if (needsGoogleProfileCompletion) return;
    const next = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
    setMode(next);
    if (next === 'signup') setSignupStep(1);
  }, [searchParams, needsGoogleProfileCompletion]);

  const handleSignupStep1Continue = (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!isUmbcEmail(email)) {
      setError('Only @umbc.edu email addresses can create an account.');
      return;
    }
    setSignupStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'signup' && signupStep === 1) {
      return;
    }
    if (mode === 'signup' && !isUmbcEmail(email)) {
      setError('Only @umbc.edu email addresses can create an account.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/', { replace: true });
      } else if (needsGoogleProfileCompletion && signupStep === 2) {
        const affiliationValue = affiliation === 'Other' ? (affiliationOther?.trim() || 'Other') : affiliation;
        await supabase.auth.updateUser({
          data: { display_name: displayName.trim(), affiliation: affiliationValue },
        });
        const { data: { user: fresh } } = await supabase.auth.getUser();
        if (!fresh?.email) throw new Error('Not signed in.');
        const { data: existing } = await supabase.from('users').select('user_id').eq('user_id', fresh.id).maybeSingle();
        const lastLogin = new Date().toISOString();
        if (existing) {
          const { error: dbError } = await supabase
            .from('users')
            .update({
              display_name: displayName.trim(),
              affiliation: affiliationValue,
              email: fresh.email,
              avatar_url: fresh.user_metadata?.avatar_url || fresh.user_metadata?.picture || null,
              avatar_path: fresh.user_metadata?.avatar_path || null,
              avatar_bucket: fresh.user_metadata?.avatar_bucket || null,
              last_login: lastLogin,
            })
            .eq('user_id', fresh.id);
          if (dbError) throw dbError;
        } else {
          const { error: dbError } = await supabase.from('users').insert({
            user_id: fresh.id,
            email: fresh.email,
            password_hash: '[Supabase Auth]',
            display_name: displayName.trim(),
            avatar_url: fresh.user_metadata?.avatar_url || fresh.user_metadata?.picture || null,
            avatar_path: fresh.user_metadata?.avatar_path || null,
            avatar_bucket: fresh.user_metadata?.avatar_bucket || null,
            affiliation: affiliationValue,
            is_admin: false,
            created_at: fresh.created_at,
            last_login: lastLogin,
          });
          if (dbError) throw dbError;
        }
        sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
        sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
        setNeedsGoogleProfileCompletion(false);
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

  const handleGoogleSignIn = async () => {
    setError('');
    setNotice('');
    if (mode === 'signup' && signupStep === 1) {
      sessionStorage.setItem(SIGNUP_GOOGLE_PENDING, '1');
      sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
    } else if (mode === 'login') {
      sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
      sessionStorage.setItem(LOGIN_GOOGLE_OAUTH_PENDING, '1');
    } else {
      sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
      sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
    }
    
    if (mode === 'signup') {
      setSignupStep(1);
    }
    setOauthBusy(true);
    try {
      const redirectTo = mode === 'signup'
        ? `${window.location.origin}/signin?mode=signup`
        : `${window.location.origin}/signin`;
      await signInWithGoogle(redirectTo);
    } catch (err) {
      sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
      sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
      setError(err?.message || 'Google sign-in failed.');
      setOauthBusy(false);
    }
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
          {mode === 'signup' && signupStep === 1 && (
            <p className={`mt-2 text-center font-body text-sm ${dark ? 'text-white/55' : 'text-black/55'}`}>
              Only UMBC email addresses can create an account.
            </p>
          )}
          <div className={`mt-5 h-px bg-gradient-to-r from-transparent to-transparent ${dark ? 'via-white/10' : 'via-black/10'}`} />

          {(mode === 'login' || (mode === 'signup' && signupStep === 1)) && (
            <div className="mt-7">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={oauthBusy || submitting}
                className={
                  dark
                    ? 'flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-[#1e2430] px-4 py-3 font-body text-base font-semibold text-white transition-colors hover:border-white/25 hover:bg-[#252c3a] disabled:opacity-60'
                    : 'flex w-full items-center justify-center gap-3 rounded-xl border border-black/12 bg-white px-4 py-3 font-body text-base font-semibold text-black shadow-sm transition-colors hover:bg-black/[0.03] disabled:opacity-60'
                }
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {oauthBusy ? 'Redirecting…' : 'Continue with Google'}
              </button>
            </div>
          )}

          {mode === 'login' && (
            <p className={`my-6 text-center font-body text-xs font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-black/40'}`}>
              or email & password
            </p>
          )}
          {mode === 'signup' && signupStep === 1 && (
            <p className={`my-6 text-center font-body text-xs font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-black/40'}`}>
              or continue with email
            </p>
          )}

          {/* Login: single form */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-5">
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
              <div>
                <label htmlFor="password" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
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
                <div className="mt-2 flex items-center justify-end">
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
                {submitting ? 'Please wait...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Signup step 1: email only + Continue */}
          {mode === 'signup' && signupStep === 1 && (
            <form onSubmit={handleSignupStep1Continue} className="space-y-5">
              <div>
                <label htmlFor="signup_email" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                  Email
                </label>
                <input
                  id="signup_email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={dark ? 'w-full rounded-xl border border-white/10 bg-[#1e2430] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25' : 'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none placeholder:text-black/40 focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25'}
                  placeholder="example@umbc.edu"
                />
              </div>
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || oauthBusy}
                className={dark ? 'w-full rounded-xl bg-[#f5bf3e] px-4 py-3 text-lg font-extrabold text-[#16181f] shadow-[0_8px_24px_rgba(245,191,62,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#ffd15e] disabled:translate-y-0 disabled:opacity-60' : 'w-full rounded-xl bg-[#D4A017] px-4 py-3 text-lg font-extrabold text-black shadow-md transition-all hover:bg-[#c4920f] disabled:opacity-60'}
              >
                Continue
              </button>
            </form>
          )}

          {/* Signup step 2: username, affiliation, password */}
          {mode === 'signup' && signupStep === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setNotice('');
                  if (needsGoogleProfileCompletion) {
                    sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
                    sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
                    setNeedsGoogleProfileCompletion(false);
                    signOut();
                  }
                  setSignupStep(1);
                }}
                className={`font-body text-sm font-semibold ${dark ? 'text-[#e8b84a] hover:text-[#f5bf3e]' : 'text-[#D4A017] hover:underline'}`}
              >
                {needsGoogleProfileCompletion ? '← Use a different account' : '← Change email'}
              </button>
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
                  required
                  className={dark ? 'w-full rounded-xl border border-white/10 bg-[#1e2430] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#f5bf3e]/60 focus:ring-2 focus:ring-[#f5bf3e]/25' : 'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-black outline-none placeholder:text-black/40 focus:border-[#D4A017]/60 focus:ring-2 focus:ring-[#D4A017]/25'}
                  placeholder="How you want to be shown"
                />
              </div>
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
                    placeholder="e.g. Contractor, visitor"
                  />
                </div>
              )}
              {!needsGoogleProfileCompletion && (
                <div>
                  <label htmlFor="password" className={`mb-2 block font-body text-sm font-semibold ${dark ? 'text-white/92' : 'text-black'}`}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
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
                  <p className={`mt-2 text-xs ${dark ? 'text-white/45' : 'text-black/55'}`}>At least 6 characters</p>
                </div>
              )}
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
                {submitting ? 'Please wait...' : needsGoogleProfileCompletion ? 'Save & continue' : 'Create Account'}
              </button>
            </form>
          )}

          <p className={`mt-6 text-center font-body text-lg ${dark ? 'text-white/72' : 'text-black/70'}`}>
            {mode === 'login' ? 'New to BARK?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                const next = mode === 'login' ? 'signup' : 'login';
                setMode(next);
                setError('');
                setNotice('');
                sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
                sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
                if (mode === 'signup' && needsGoogleProfileCompletion) {
                  setNeedsGoogleProfileCompletion(false);
                  signOut();
                } else {
                  setNeedsGoogleProfileCompletion(false);
                }
                if (next === 'signup') {
                  setSignupStep(1);
                }
                if (mode === 'signup') {
                  setDisplayName('');
                  setAffiliation('');
                  setAffiliationOther('');
                  setPassword('');
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
