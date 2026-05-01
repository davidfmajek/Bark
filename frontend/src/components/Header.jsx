import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { ButtonGroup } from './ui/button-group';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Menu, Search, X } from 'lucide-react';

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
  const location = useLocation();
  const navigate = useNavigate();
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [dbAvatarUrl, setDbAvatarUrl] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [establishments, setEstablishments] = useState([]);
  const [restaurantsOpen, setRestaurantsOpen] = useState(false);
  const restaurantsRef = useRef(null);
  const restaurantsOpenTimeout = useRef(null);
  const restaurantsCloseTimeout = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchTrimmed = searchQuery.trim().toLowerCase();
  const searchMatches = searchTrimmed
    ? establishments.filter((e) => e.name.toLowerCase().includes(searchTrimmed))
    : [];

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('establishments')
        .select('establishment_id, name')
        .eq('is_active', true)
        .order('name');
      if (mounted && !error) setEstablishments(data ?? []);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isAuthenticated || !user?.id) {
        if (mounted) setCanAccessAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('role, is_admin')
        .eq('user_id', user.id)
        .single();
      if (!mounted) return;
      if (error && String(error.message || '').toLowerCase().includes('role') && String(error.message || '').toLowerCase().includes('does not exist')) {
        const fallback = await supabase
          .from('users')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();
        if (mounted) setCanAccessAdmin(!!fallback.data?.is_admin);
        return;
      }
      const role = String(data?.role || '').toLowerCase();
      // Role is source-of-truth when available; is_admin is legacy fallback only.
      if (role === 'admin' || role === 'mod') setCanAccessAdmin(true);
      else setCanAccessAdmin(false);
    })();
    return () => { mounted = false; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isAuthenticated || !user?.id) {
        if (mounted) setDbAvatarUrl('');
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!mounted || error) return;
      setDbAvatarUrl(data?.avatar_url || '');
    })();
    return () => { mounted = false; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const clearRestaurantsTimeouts = () => {
    if (restaurantsOpenTimeout.current) {
      clearTimeout(restaurantsOpenTimeout.current);
      restaurantsOpenTimeout.current = null;
    }
    if (restaurantsCloseTimeout.current) {
      clearTimeout(restaurantsCloseTimeout.current);
      restaurantsCloseTimeout.current = null;
    }
  };

  const handleRestaurantsMouseEnter = () => {
    clearRestaurantsTimeouts();
    restaurantsOpenTimeout.current = setTimeout(() => setRestaurantsOpen(true), 120);
  };

  const handleRestaurantsMouseLeave = () => {
    clearRestaurantsTimeouts();
    restaurantsCloseTimeout.current = setTimeout(() => setRestaurantsOpen(false), 150);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault?.();
    const q = searchQuery?.trim() ?? '';
    setSearchDropdownOpen(false);
    if (!q) {
      navigate('/restaurants');
      return;
    }
    const match = establishments.find((e) => e.name.toLowerCase() === q.toLowerCase());
    if (match) {
      navigate(`/restaurants/${match.establishment_id}`);
      setSearchQuery('');
      return;
    }
    if (searchMatches.length === 1) {
      navigate(`/restaurants/${searchMatches[0].establishment_id}`);
      setSearchQuery('');
      return;
    }
    navigate(`/restaurants/${encodeURIComponent(q)}`);
  };

  const handleSearchResultSelect = (establishmentId) => {
    setSearchQuery('');
    setSearchDropdownOpen(false);
    navigate(`/restaurants/${establishmentId}`);
  };

  const showSearchDropdown = searchDropdownOpen && searchTrimmed.length > 0;

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut();
    navigate('/', { replace: true });
  };

  const isDark = theme === 'dark';
  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const avatarUrl = dbAvatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

  const linkCls = isDark
    ? 'font-body text-sm font-medium text-white/85 hover:text-[#f5bf3e]'
    : 'font-body text-sm font-medium text-black hover:text-[#D4A017]';
  const headerCls = isDark
    ? 'sticky top-0 z-50 border-b border-white/10 bg-[#0f1219]/95 backdrop-blur-sm'
    : 'sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur-sm';
  const logoCls = isDark
    ? 'flex shrink-0 items-center gap-2 text-white transition-opacity hover:opacity-90'
    : 'flex shrink-0 items-center gap-2 text-black transition-opacity hover:opacity-85';
  const signInCls = isDark
    ? 'rounded-full px-4 py-2 font-body text-sm font-medium text-white/90 hover:bg-white/10 transition-colors'
    : 'rounded-full px-4 py-2 font-body text-sm font-medium text-black hover:bg-black/5 transition-colors';
  const signUpCls = isDark
    ? 'rounded-full bg-[#f5bf3e] px-4 py-2 font-body text-sm font-semibold text-[#16181f] hover:bg-[#ffd15e]'
    : 'rounded-full bg-[#D4A017] px-4 py-2 font-body text-sm font-semibold text-black shadow-sm hover:bg-[#c4920f]';
  const searchGroupCls = isDark
    ? 'bg-white/5 [&_input]:bg-transparent [&_input]:text-white [&_input]:placeholder:text-white/50'
    : 'bg-black/5 [&_input]:bg-transparent [&_input]:text-black [&_input]:placeholder:text-black/50';
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
  const restaurantsDropdownCls = isDark
    ? 'absolute left-0 top-full z-50 mt-2 w-[min(44rem,90vw)] max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-white/10 bg-[#161b26] p-3 shadow-xl'
    : 'absolute left-0 top-full z-50 mt-2 w-[min(44rem,90vw)] max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-black/10 bg-white p-3 shadow-lg';
  const restaurantsItemCls = isDark
    ? 'block rounded-lg px-3 py-2 font-body text-sm font-medium text-white/90 transition-colors hover:bg-white/10'
    : 'block rounded-lg px-3 py-2 font-body text-sm font-medium text-black transition-colors hover:bg-black/5';
  const mobileMenuButtonCls = isDark
    ? 'rounded-full p-2 text-white/85 transition-colors hover:bg-white/10 sm:hidden'
    : 'rounded-full p-2 text-black/80 transition-colors hover:bg-black/5 sm:hidden';
  const mobilePanelCls = isDark
    ? 'border-t border-white/10 bg-[#0f1219]/95 px-4 py-3 sm:hidden'
    : 'border-t border-black/10 bg-white/95 px-4 py-3 sm:hidden';

  return (
    <header className={headerCls}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link to="/" className={`shrink-0 ${logoCls}`} aria-label="BARK home">
          <img src="/logo.png" alt="" className="h-8 w-auto" />
          <span className="font-display text-xl font-bold tracking-tight">BARK!</span>
        </Link>

        <div ref={searchRef} className="relative hidden min-w-0 flex-1 sm:block">
          <form
            onSubmit={handleSearchSubmit}
            className="w-full max-w-md"
            role="search"
            aria-label="Search restaurants"
          >
            <ButtonGroup className={`h-9 w-full rounded-lg ${searchGroupCls}`}>
              <Input
                type="search"
                placeholder="Restaurants, food..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchDropdownOpen(true);
                }}
                onFocus={() => searchTrimmed && setSearchDropdownOpen(true)}
                className="min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0"
                aria-label="Search restaurants"
                aria-autocomplete="list"
                aria-expanded={showSearchDropdown}
                aria-controls="search-results"
                id="header-search-input"
              />
              <Button
                type="submit"
                variant="default"
                size="icon"
                className={isDark ? 'h-9 shrink-0 rounded-l-none !rounded-r-lg bg-[#f5bf3e] text-[#16181f] hover:bg-[#ffd15e]' : 'h-9 shrink-0 rounded-l-none !rounded-r-lg bg-[#D4A017] text-black hover:bg-[#c4920f]'}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </ButtonGroup>
          </form>
          {showSearchDropdown && (
            <div
              id="search-results"
              role="listbox"
              className={`absolute left-0 top-full z-50 mt-1 w-full max-w-md overflow-hidden rounded-xl border shadow-lg ${
                isDark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'
              }`}
            >
              {searchMatches.length === 0 ? (
                <div className={`px-4 py-3 font-body text-sm ${isDark ? 'text-white/60' : 'text-black/60'}`}>
                  No restaurants match &quot;{searchQuery.trim()}&quot;
                </div>
              ) : (
                <ul className="max-h-[min(18rem,60vh)] overflow-y-auto py-1">
                  {searchMatches.map((e) => (
                    <li key={e.establishment_id} role="option">
                      <button
                        type="button"
                        className={`block w-full px-4 py-2.5 text-left font-body text-sm font-medium transition-colors ${
                          isDark ? 'text-white/90 hover:bg-white/10' : 'text-black hover:bg-black/5'
                        }`}
                        onClick={() => handleSearchResultSelect(e.establishment_id)}
                      >
                        {e.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <nav className="hidden shrink-0 items-center gap-6 sm:flex" aria-label="Main">
          <div
            className="relative flex"
            ref={restaurantsRef}
            onMouseEnter={handleRestaurantsMouseEnter}
            onMouseLeave={handleRestaurantsMouseLeave}
          >
            <Link
              to="/restaurants"
              className={`flex items-center gap-0.5 ${linkCls}`}
              aria-haspopup="true"
              aria-expanded={restaurantsOpen}
            >
              Restaurants
              <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${restaurantsOpen ? 'rotate-180' : ''} ${isDark ? 'text-white/70' : 'text-black/60'}`} />
            </Link>
            {restaurantsOpen && (
              <div className={restaurantsDropdownCls} role="menu">
                {establishments.length === 0 ? (
                  <div className={`px-4 py-3 font-body text-sm ${isDark ? 'text-white/70' : 'text-black/60'}`}>
                    No restaurants yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {establishments.map((e) => (
                      <Link
                        key={e.establishment_id}
                        to={`/restaurants/${e.establishment_id}`}
                        className={restaurantsItemCls}
                        role="menuitem"
                      >
                        {e.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <Link
            to="/writeareview"
            className={linkCls}
          >
            Write a Review
          </Link>
          <Link to="/map" className={linkCls}>Map</Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className={mobileMenuButtonCls}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
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
                <span className={`hidden sm:inline ${profileTextCls}`}>{displayName}</span>
                <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''} ${isDark ? 'text-white/70' : 'text-black/60'}`} />
              </button>
              {profileOpen && (
                <div className={dropdownCls} role="menu">
                  <Link
                    to="/my-reviews"
                    onClick={() => setProfileOpen(false)}
                    className={`block px-4 py-2 font-body text-sm font-medium transition-colors ${isDark ? 'text-white/90 hover:bg-white/10' : 'text-black hover:bg-black/5'}`}
                    role="menuitem"
                  >
                    My Reviews
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className={`block px-4 py-2 font-body text-sm font-medium transition-colors ${isDark ? 'text-white/90 hover:bg-white/10' : 'text-black hover:bg-black/5'}`}
                    role="menuitem"
                  >
                    Edit profile
                  </Link>
                  {canAccessAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileOpen(false)}
                      className={`block px-4 py-2 font-body text-sm font-medium transition-colors ${isDark ? 'text-[#f5bf3e] hover:bg-white/10' : 'text-[#D4A017] hover:bg-black/5'}`}
                      role="menuitem"
                    >
                      Admin dashboard
                    </Link>
                  )}
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
            <div className="flex items-center gap-2">
              <Link to="/signin" className={signInCls}>Log in</Link>
              <Link to="/signin?mode=signup" className={signUpCls}>Sign up</Link>
            </div>
          )}
        </div>
      </div>
      {mobileMenuOpen && (
        <div id="mobile-nav-panel" className={mobilePanelCls}>
          <div ref={searchRef} className="relative mb-3 min-w-0">
            <form onSubmit={handleSearchSubmit} className="w-full" role="search" aria-label="Search restaurants">
              <ButtonGroup className={`h-9 w-full rounded-lg ${searchGroupCls}`}>
                <Input
                  type="search"
                  placeholder="Restaurants, food..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  onFocus={() => searchTrimmed && setSearchDropdownOpen(true)}
                  className="min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0"
                  aria-label="Search restaurants"
                />
                <Button
                  type="submit"
                  variant="default"
                  size="icon"
                  className={isDark ? 'h-9 shrink-0 rounded-l-none !rounded-r-lg bg-[#f5bf3e] text-[#16181f] hover:bg-[#ffd15e]' : 'h-9 shrink-0 rounded-l-none !rounded-r-lg bg-[#D4A017] text-black hover:bg-[#c4920f]'}
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </ButtonGroup>
            </form>
          </div>
          <nav className="grid grid-cols-2 gap-2" aria-label="Mobile">
            <Link to="/restaurants" className={linkCls}>Restaurants</Link>
            <Link to="/writeareview" className={linkCls}>Write Review</Link>
            <Link to="/map" className={linkCls}>Map</Link>
            {isAuthenticated && <Link to="/my-reviews" className={linkCls}>My Reviews</Link>}
            {isAuthenticated && <Link to="/profile" className={linkCls}>Profile</Link>}
            {isAuthenticated && canAccessAdmin && <Link to="/admin" className={linkCls}>Admin</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}
