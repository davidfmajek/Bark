import { useTheme } from '../contexts/ThemeContext';

export function MyReviewsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div className={`relative min-h-[calc(100vh-3.5rem)] overflow-hidden ${dark ? 'bg-[#0f1219]' : 'bg-white'}`}>
      {dark ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      ) : (
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
      )}
    </div>
  );
}
