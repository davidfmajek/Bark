import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);
const SIGNUP_GOOGLE_PENDING = 'bark_signup_google_pending';
const LOGIN_GOOGLE_OAUTH_PENDING = 'bark_login_google_oauth_pending';
const SIGNUP_ROUTE = '/signin?mode=signup';

function hasPendingGoogleSignup() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(SIGNUP_GOOGLE_PENDING) === '1';
  } catch {
    return false;
  }
}

function hasPendingGoogleLoginOAuth() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(LOGIN_GOOGLE_OAUTH_PENDING) === '1';
  } catch {
    return false;
  }
}

function clearOAuthPendingFlags() {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(SIGNUP_GOOGLE_PENDING);
    window.sessionStorage.removeItem(LOGIN_GOOGLE_OAUTH_PENDING);
  } catch {}
}

function isSignInRouteWithSignupMode() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  const mode = new URLSearchParams(window.location.search).get('mode');
  return path === '/signin' && mode === 'signup';
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (!hasPendingGoogleSignup()) return;

    let cancelled = false;
    (async () => {
      const signedInWithGoogle = isGoogleAuthUser(user);
      if (!signedInWithGoogle) return;
      const { data: profile } = await supabase
        .from('users')
        .select('user_id, display_name, affiliation')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;

      const dbHasProfile =
        !!profile &&
        Boolean(String(profile.display_name ?? '').trim()) &&
        Boolean(String(profile.affiliation ?? '').trim());
      const authDisplayName = String(user?.user_metadata?.display_name ?? '').trim();
      const authAffiliation = String(user?.user_metadata?.affiliation ?? '').trim();
      const authHasProfile = Boolean(authDisplayName && authAffiliation);

      // Existing user: clear pending flags and continue normal app flow.
      if (dbHasProfile && authHasProfile) {
        clearOAuthPendingFlags();
        return;
      }

      // New/incomplete user: force step-2 onboarding route.
      if (!isSignInRouteWithSignupMode()) {
        window.location.replace(SIGNUP_ROUTE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;
    if (!hasPendingGoogleLoginOAuth()) return;
    if (!isGoogleAuthUser(user)) return;
    if (isSignInRouteWithSignupMode()) return;

    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from('users')
        .select('user_id, display_name, affiliation')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const dbHasProfile =
        !!profile &&
        Boolean(String(profile.display_name ?? '').trim()) &&
        Boolean(String(profile.affiliation ?? '').trim());
      const authAffiliation = String(user?.user_metadata?.affiliation ?? '').trim();
      const authDisplayName = String(user?.user_metadata?.display_name ?? '').trim();
      const authHasProfile = Boolean(authAffiliation && authDisplayName);
      if (!dbHasProfile || !authHasProfile) {
        window.location.replace(SIGNUP_ROUTE);
      } else {
        clearOAuthPendingFlags();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithGoogle = async (redirectTo) => {
    const resolvedRedirectTo = redirectTo || `${window.location.origin}/signin`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: resolvedRedirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
