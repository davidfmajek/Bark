import { useTheme } from '../contexts/ThemeContext';

export function MainPage() {
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
        <>
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      )}

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl items-center justify-center px-6">
        <div className={`w-full max-w-xl rounded-[28px] border px-8 py-12 text-center backdrop-blur-sm ${dark ? 'border-white/10 bg-[#161b26] shadow-xl' : 'border-black/10 bg-white shadow-lg'}`}>
          <p className={`mb-3 font-body text-sm font-semibold uppercase tracking-[0.28em] ${dark ? 'text-[#f5bf3e]/80' : 'text-[#D4A017]'}`}>
            Main Page
          </p>
          <h1 className={`font-display text-4xl font-bold sm:text-5xl ${dark ? 'text-white' : 'text-black'}`}>
            Blank on purpose
          </h1>
          <p className={`mx-auto mt-4 max-w-md font-body text-lg leading-8 ${dark ? 'text-white/75' : 'text-black/65'}`}>
            You are signed in. I left this page empty so you can build the rest of BARK from here.
          </p>
        </div>
      </div>
    </div>
  );
}
