import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { supabase } from './lib/supabase';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SignInPage } from './pages/SignInPage';
import { MainPage } from './pages/MainPage';
import { ProfilePage } from './pages/ProfilePage';
import { RestaurantsPage } from './pages/RestaurantsPage';
import { MyReviewsPage } from './pages/MyReviewsPage';
import { MapPage } from './pages/MapPage';
import { WriteAReviewPage } from './pages/WriteAReviewPage';
import { EstablishmentPage } from './pages/EstablishmentPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
function RequireAuth({ children }) {
  const { loading, isAuthenticated, user } = useAuth();
  const [profileCheckLoading, setProfileCheckLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyGoogleProfile() {
      if (loading || !isAuthenticated || !user?.id) return;

      const isGoogleUser = user.identities?.some((identity) => identity.provider === 'google');
      if (!isGoogleUser) {
        if (!cancelled) {
          setNeedsProfileCompletion(false);
          setProfileCheckLoading(false);
        }
        return;
      }

      setProfileCheckLoading(true);
      const { data: profile, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setNeedsProfileCompletion(false);
        setProfileCheckLoading(false);
        return;
      }
      setNeedsProfileCompletion(!profile);
      setProfileCheckLoading(false);
    }

    verifyGoogleProfile();
    return () => {
      cancelled = true;
    };
  }, [loading, isAuthenticated, user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-body text-bark-muted">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (profileCheckLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-body text-bark-muted">Loading…</p>
      </div>
    );
  }

  if (needsProfileCompletion) {
    return <Navigate to="/signin?mode=signup" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/main"
          element={(
            <RequireAuth>
              <MainPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/profile"
          element={(
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          )}
        />
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route
          path="/my-reviews"
          element={(
            <RequireAuth>
              <MyReviewsPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/writeareview"
          element={(
            <RequireAuth>
              <WriteAReviewPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/writeareview/:slug"
          element={(
            <RequireAuth>
              <WriteAReviewPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/restaurants/:slug/writeareview"
          element={(
            <RequireAuth>
              <WriteAReviewPage />
            </RequireAuth>
          )}
        />
        <Route path="/restaurants/:slug" element={<EstablishmentPage />} />
        <Route
          path="/admin"
          element={(
            <RequireAuth>
              <AdminDashboardPage />
            </RequireAuth>
          )}
        />
        <Route path="/map" element={<MapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
