import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

function PawIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className={className}>
      <ellipse cx="19" cy="19" rx="6" ry="9" transform="rotate(-28 19 19)" />
      <ellipse cx="32" cy="13" rx="6" ry="9" transform="rotate(-8 32 13)" />
      <ellipse cx="45" cy="18" rx="6" ry="9" transform="rotate(18 45 18)" />
      <ellipse cx="52" cy="31" rx="6" ry="8" transform="rotate(34 52 31)" />
      <path d="M30 29c-7 0-15 7-15 16 0 7 6 11 11 11 4 0 6-2 9-4 3 2 5 4 9 4 7 0 11-5 11-11 0-9-9-16-16-16-3 0-5 1-9 0Z" />
    </svg>
  );
}

function SunIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ChevronDownIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function getDisplayName(user) {
  const name = user?.user_metadata?.display_name;
  if (name && String(name).trim()) return String(name).trim();
  const email = user?.email ?? '';
  return email.split('@')[0] || 'User';
}

function getInitials(displayName) {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (displayName.slice(0, 2) || 'U').toUpperCase();
}

export function Header() {
  const { user, isAuthenticated, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileOpen]);

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut();
    navigate('/', { replace: true });
  };

  const isDark = theme === 'dark';
  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const avatarUrl = user?.user_metadata?.avatar_url;

  const linkCls = isDark
    ? 'font-body text-sm font-medium text-white/85 hover:text-[#f5bf3e]'
    : 'font-body text-sm font-medium text-black hover:text-[#D4A017]';
  const headerCls = isDark
    ? 'sticky top-0 z-50 border-b border-white/10 bg-[#0f1219]/95 backdrop-blur-sm'
    : 'sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur-sm';
  const logoCls = isDark
    ? 'flex shrink-0 items-center gap-2 text-white transition-opacity hover:opacity-90'
    : 'flex shrink-0 items-center gap-2 text-black transition-opacity hover:opacity-85';
  const pawCls = isDark ? 'h-8 w-8 text-[#f5bf3e]' : 'h-8 w-8 text-[#D4A017]';
  const signInCls = isDark
    ? 'rounded-full bg-[#f5bf3e] px-4 py-2 font-body text-sm font-semibold text-[#16181f] hover:bg-[#ffd15e]'
    : 'rounded-full bg-[#D4A017] px-4 py-2 font-body text-sm font-semibold text-black shadow-sm hover:bg-[#c4920f]';
  const toggleCls = isDark
    ? 'rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-[#f5bf3e] transition-colors'
    : 'rounded-full p-2 text-black/70 hover:bg-black/5 hover:text-[#D4A017] transition-colors';

  const profileTriggerCls = isDark
    ? 'flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-white/10'
    : 'flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-black/5';
  const profileTextCls = isDark ? 'font-body text-sm font-medium text-white/90' : 'font-body text-sm font-medium text-black';
  const dropdownCls = isDark
    ? 'absolute right-0 top-full z-50 mt-2 min-w-[10rem] rounded-xl border border-white/10 bg-[#161b26] py-1 shadow-xl'
    : 'absolute right-0 top-full z-50 mt-2 min-w-[10rem] rounded-xl border border-black/10 bg-white py-1 shadow-lg';

  return (
    <header className={headerCls}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link to="/" className={logoCls} aria-label="BARK home">
          <PawIcon className={pawCls} />
          <span className="font-display text-xl font-bold tracking-tight">BARK!</span>
        </Link>
        <nav className="hidden flex-1 justify-center gap-8 sm:flex" aria-label="Main">
          <Link to="/" className={linkCls}>Browse</Link>
          <Link to="/restaurants" className={linkCls}>Restaurants</Link>
          <Link to={isAuthenticated ? '/my-reviews' : '/signin'} className={linkCls}>My Reviews</Link>
          <Link to="/map" className={linkCls}>Map</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className={toggleCls}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
          {isAuthenticated ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className={profileTriggerCls}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label="Profile menu"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border ${isDark ? 'border-white/20 bg-white/10' : 'border-black/15 bg-black/5'}`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className={`text-xs font-bold ${isDark ? 'text-white/90' : 'text-black/80'}`}>{initials}</span>
                  )}
                </span>
                <span className={profileTextCls}>{displayName}</span>
                <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''} ${isDark ? 'text-white/70' : 'text-black/60'}`} />
              </button>
              {profileOpen && (
                <div className={dropdownCls} role="menu">
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className={`block px-4 py-2 font-body text-sm font-medium transition-colors ${isDark ? 'text-white/90 hover:bg-white/10' : 'text-black hover:bg-black/5'}`}
                    role="menuitem"
                  >
                    Edit profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block w-full px-4 py-2 text-left font-body text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-600"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/signin" className={signInCls}>Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
