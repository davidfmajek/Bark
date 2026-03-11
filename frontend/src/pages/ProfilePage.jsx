import { useTheme } from '../contexts/ThemeContext';

export function ProfilePage() {
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
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className={`font-display text-2xl font-bold sm:text-3xl ${dark ? 'text-white' : 'text-black'}`}>
          Edit profile
        </h1>
        <p className={`mt-2 font-body ${dark ? 'text-white/70' : 'text-black/65'}`}>
          Profile settings and account details will go here.
        </p>
      </div>
    </div>
  );
}
