import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TABS } from './admin/constants';
import { ActivityFeed } from './admin/components/ActivityFeed';
import { AnalyticsTab } from './admin/components/AnalyticsTab';
import { EstablishmentsTab } from './admin/components/EstablishmentsTab';
import { FlaggedReviewsTab } from './admin/components/FlaggedReviewsTab';
import { ReportsTab } from './admin/components/ReportsTab';
import { UsersTab } from './admin/components/UsersTab';
import { avg, canManageSystem, getActorName, isMissingDbColumnError, normalizeUserRole, simpleError } from './admin/utils';

const defaultStats = { pendingReports: 0, totalUsers: 0, activeEstablishments: 0, totalReviews: 0, flaggedReviews: 0 };
const defaultAnalytics = { avgRating: 0, mostReviewed: null, lowestRated: null, reviewTimestamps: [] };

export function AdminDashboardPage() {
  const { theme } = useTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const dark = theme === 'dark';
  const [actorRole, setActorRole] = useState(null);
  const [roleColumnSupported, setRoleColumnSupported] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');
  const [stats, setStats] = useState(defaultStats);
  const [globalError, setGlobalError] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [activity, setActivity] = useState([]);
  const [adminEvents, setAdminEvents] = useState([]);
  const [banSupported, setBanSupported] = useState(true);
  const [adminEventsHydrated, setAdminEventsHydrated] = useState(false);
  const actorName = getActorName(user);

  useEffect(() => {
    if (!user?.id) return;
    const key = `bark_admin_events_${user.id}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setAdminEvents(parsed.slice(0, 20));
      }
    } finally {
      setAdminEventsHydrated(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !adminEventsHydrated) return;
    const key = `bark_admin_events_${user.id}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(adminEvents.slice(0, 20)));
    } catch {}
  }, [adminEvents, adminEventsHydrated, user?.id]);

  const handleBanSupportedChange = useCallback((supported) => setBanSupported(!!supported), []);

  useEffect(() => {
    async function check() {
      if (!isAuthenticated || !user?.id) return setActorRole('user');
      const roleQuery = await supabase.from('users').select('role, is_admin').eq('user_id', user.id).single();
      if (roleQuery.error && isMissingDbColumnError(roleQuery.error, 'role')) {
        setRoleColumnSupported(false);
        const fallback = await supabase.from('users').select('is_admin').eq('user_id', user.id).single();
        return setActorRole(fallback.data?.is_admin ? 'admin' : 'user');
      }
      if (roleQuery.error) return setActorRole('user');
      setRoleColumnSupported(true);
      setActorRole(normalizeUserRole(roleQuery.data));
    }
    check();
  }, [isAuthenticated, user]);

  const verifyPrivileged = useCallback(async (requiredRole = 'mod') => {
    if (!user?.id) throw new Error('No authenticated user.');
    const roleQuery = await supabase.from('users').select('role, is_admin').eq('user_id', user.id).single();
    let currentRole = 'user';
    if (roleQuery.error && isMissingDbColumnError(roleQuery.error, 'role')) {
      const fallback = await supabase.from('users').select('is_admin').eq('user_id', user.id).single();
      currentRole = fallback.data?.is_admin ? 'admin' : 'user';
    } else if (!roleQuery.error) {
      currentRole = normalizeUserRole(roleQuery.data);
    }
    const allowed = requiredRole === 'admin' ? currentRole === 'admin' : currentRole === 'admin' || currentRole === 'mod';
    if (!allowed) throw new Error(requiredRole === 'admin' ? 'Admin privileges are required for this action.' : 'Moderator or admin privileges are required for this action.');
  }, [user?.id]);

  const loadSummary = useCallback(async () => {
    const [rep, usr, est, rev, flg] = await Promise.all([
      supabase.from('reports').select('report_id', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('users').select('user_id', { count: 'exact', head: true }),
      supabase.from('establishments').select('establishment_id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('reviews').select('review_id', { count: 'exact', head: true }),
      supabase.from('reviews').select('review_id', { count: 'exact', head: true }).eq('is_flagged', true),
    ]);
    setStats({
      pendingReports: rep.count ?? 0,
      totalUsers: usr.count ?? 0,
      activeEstablishments: est.count ?? 0,
      totalReviews: rev.count ?? 0,
      flaggedReviews: flg.count ?? 0,
    });
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    const { data, error } = await supabase.from('establishments').select('name, reviews ( review_id, rating, created_at )');
    if (error) {
      setGlobalError(simpleError(error, 'Failed to load analytics.'));
      return setAnalyticsLoading(false);
    }
    const establishments = data ?? [];
    const allRatings = establishments.flatMap((e) => (e.reviews ?? []).map((r) => r.rating).filter((r) => Number.isFinite(r)));
    const avgRating = avg(allRatings);
    const mostReviewed = establishments.map((e) => ({ name: e.name, count: (e.reviews ?? []).length })).sort((a, b) => b.count - a.count)[0] || null;
    const lowestRated = establishments.map((e) => {
      const ratings = (e.reviews ?? []).map((r) => r.rating).filter((r) => Number.isFinite(r));
      return { name: e.name, avg: ratings.length ? avg(ratings) : null };
    }).filter((e) => e.avg !== null).sort((a, b) => a.avg - b.avg)[0] || null;
    const reviewTimestamps = establishments.flatMap((e) => (e.reviews ?? []).map((r) => r.created_at).filter(Boolean));
    setAnalytics({ avgRating, mostReviewed, lowestRated, reviewTimestamps });
    setAnalyticsLoading(false);
  }, []);

  const loadActivity = useCallback(async () => {
    const [reviews, reports] = await Promise.all([
      supabase.from('reviews').select('review_id, created_at, rating, user:user_id(display_name, email), establishment:establishment_id(name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('reports').select('report_id, reported_at, reason, status').order('reported_at', { ascending: false }).limit(10),
    ]);
    const merged = [
      ...adminEvents.map((e, idx) => ({ id: `admin-${idx}-${e.ts}`, ts: e.ts, label: e.label })),
      ...(reviews.data ?? []).map((r) => ({ id: `review-${r.review_id}`, ts: r.created_at, label: `${r.user?.display_name || r.user?.email || 'Anonymous user'} rated ${r.establishment?.name || 'Unknown establishment'} ${r.rating ?? '—'}★` })),
      ...(reports.data ?? []).map((r) => ({ id: `report-${r.report_id}`, ts: r.reported_at, label: `Report submitted: ${r.reason || 'No reason'} (${r.status})` })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 20);
    setActivity(merged);
  }, [adminEvents]);

  const reloadMeta = useCallback(async () => {
    setGlobalError('');
    try {
      await Promise.all([loadSummary(), loadAnalytics(), loadActivity()]);
    } catch (err) {
      setGlobalError(simpleError(err, 'Failed to refresh dashboard.'));
    }
  }, [loadActivity, loadAnalytics, loadSummary]);

  useEffect(() => {
    if (actorRole !== 'admin' && actorRole !== 'mod') return;
    reloadMeta();
  }, [actorRole, reloadMeta]);

  useEffect(() => {
    if (actorRole === 'admin' || actorRole === 'mod') loadActivity();
  }, [adminEvents, actorRole, loadActivity]);

  const handleActionEvent = useCallback((label) => {
    setAdminEvents((prev) => [{ ts: new Date().toISOString(), label: `${actorName} ${label}` }, ...prev].slice(0, 20));
    loadSummary();
    loadAnalytics();
  }, [actorName, loadAnalytics, loadSummary]);

  useEffect(() => {
    if (actorRole !== 'admin' && actorRole !== 'mod') return;
    let timer = null;
    const scheduleRefresh = (includeAnalytics = false) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        await Promise.all([loadSummary(), loadActivity(), ...(includeAnalytics ? [loadAnalytics()] : [])]);
      }, 220);
    };
    const channel = supabase
      .channel(`admin-live-feed-${user?.id ?? 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => scheduleRefresh(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => scheduleRefresh(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'establishments' }, () => scheduleRefresh(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => scheduleRefresh(false))
      .subscribe();
    const intervalId = window.setInterval(() => scheduleRefresh(false), 8000);
    const onVisibility = () => document.visibilityState === 'visible' && scheduleRefresh(true);
    window.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.clearInterval(intervalId);
      window.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [actorRole, loadActivity, loadAnalytics, loadSummary, user?.id]);

  const pageBg = dark ? 'bg-[#0f1219] text-white' : 'bg-white text-black';
  const cardBg = dark ? 'bg-[#161b26] border-white/8' : 'bg-gray-50 border-black/8';
  const mutedText = dark ? 'text-white/45' : 'text-black/40';
  if (authLoading || actorRole === null) return <div className={`flex min-h-[calc(100vh-3.5rem)] items-center justify-center ${pageBg}`}><p className={mutedText}>Checking permissions...</p></div>;
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  if (actorRole !== 'admin' && actorRole !== 'mod') return <Navigate to="/main" replace />;
  const visibleTabs = canManageSystem(actorRole) ? TABS : TABS.filter((t) => t.id !== 'establishments');

  return (
    <div className={`relative min-h-[calc(100vh-3.5rem)] ${pageBg}`}>
      {dark && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(245,191,62,0.06),_transparent_50%)]" />}
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <div><h1 className={`text-2xl font-bold tracking-tight ${dark ? 'text-white' : 'text-black'}`}>Admin Dashboard</h1><p className={`text-sm ${mutedText}`}>BARK content moderation &amp; management</p></div>
          <button onClick={reloadMeta} className={`ml-auto rounded-xl px-3 py-2 text-sm font-semibold ${dark ? 'bg-[#f5bf3e] text-black hover:bg-[#ffd15e]' : 'bg-[#D4A017] text-white hover:bg-[#bf9210]'}`}>Refresh All</button>
        </div>
        {globalError && <div className={`mb-6 rounded-xl border px-3 py-2 text-sm ${dark ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'}`}>{globalError}</div>}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[{ label: 'Pending Reports', value: stats.pendingReports, accent: stats.pendingReports > 0 }, { label: 'Flagged Reviews', value: stats.flaggedReviews, accent: stats.flaggedReviews > 0 }, { label: 'Total Reviews', value: stats.totalReviews, accent: false }, { label: 'Total Users', value: stats.totalUsers, accent: false }, { label: 'Active Dining Spots', value: stats.activeEstablishments, accent: false }].map(({ label, value, accent }) => (
            <div key={label} className={`rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${cardBg}`}>
              <p className={`text-xs font-medium uppercase tracking-widest ${mutedText}`}>{label}</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${accent ? (dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]') : (dark ? 'text-white' : 'text-black')}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className={`mb-6 flex gap-1 rounded-2xl border p-1 ${dark ? 'border-white/8 bg-[#161b26]' : 'border-black/8 bg-gray-50'}`}>
          {visibleTabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${activeTab === id ? (dark ? 'bg-[#f5bf3e] text-black shadow-sm' : 'bg-[#D4A017] text-white shadow-sm') : (dark ? 'text-white/55 hover:text-white/80' : 'text-black/50 hover:text-black/70')}`}>
              <Icon className="h-4 w-4" /><span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.8fr_1fr]">
          <div>
            {activeTab === 'reports' && <ReportsTab dark={dark} verifyPrivileged={verifyPrivileged} onAction={handleActionEvent} />}
            {activeTab === 'flagged' && <FlaggedReviewsTab dark={dark} verifyPrivileged={verifyPrivileged} onAction={handleActionEvent} />}
            {activeTab === 'users' && <UsersTab dark={dark} verifyPrivileged={verifyPrivileged} onAction={handleActionEvent} currentUserId={user?.id} actorRole={actorRole} roleColumnSupported={roleColumnSupported} banSupported={banSupported} onBanSupportedChange={handleBanSupportedChange} />}
            {activeTab === 'establishments' && canManageSystem(actorRole) && <EstablishmentsTab dark={dark} verifyPrivileged={verifyPrivileged} onAction={handleActionEvent} />}
            {activeTab === 'analytics' && <AnalyticsTab dark={dark} analytics={analytics} loading={analyticsLoading} mutedText={mutedText} />}
          </div>
          <ActivityFeed dark={dark} activity={activity} mutedText={mutedText} />
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
