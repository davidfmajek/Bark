import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
function RequireAuth({ children }) {
  const { loading, isAuthenticated } = useAuth();

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
          path="/restaurants/:slug/writeareview"
          element={(
            <RequireAuth>
              <WriteAReviewPage />
            </RequireAuth>
          )}
        />
        <Route path="/restaurants/:slug" element={<EstablishmentPage />} />
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
