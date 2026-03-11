import { useTheme } from '../contexts/ThemeContext';

export function RestaurantsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? 'text-white' : 'text-black'}`}>
      {dark ? (
        <>
          <div className="fixed inset-0 -z-10 bg-[#0f1219]" />
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
          <div className="fixed inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      ) : (
        <>
          <div className="fixed inset-0 -z-10 bg-white" />
          <div className="fixed inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      )}
    </div>
  );
}
