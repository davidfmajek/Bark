import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'bark-theme';

const ThemeContext = createContext(null);

function readStored() {
  try {
    const s = window.localStorage.getItem(STORAGE_KEY);
    if (s === 'dark' || s === 'light') return s;
  } catch (_) {}
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (next) => {
    setThemeState(next === 'light' ? 'light' : 'dark');
  };

  const toggleTheme = () => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
