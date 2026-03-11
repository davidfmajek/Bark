import { Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from './Header';

export function Layout() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-[#0f1219]' : 'bg-white'}`}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
