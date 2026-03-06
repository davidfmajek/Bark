import { useAuth } from '../contexts/AuthContext';

export function MainPage() {
  const { signOut } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-bark-cream">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,168,83,0.16),_transparent_28%),linear-gradient(180deg,_rgba(245,240,232,1)_0%,_rgba(237,230,220,0.9)_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(26,60,52,0.06)_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <button
          type="button"
          onClick={() => signOut()}
          className="absolute right-6 top-6 rounded-full border border-bark-ink/15 bg-white/70 px-5 py-2 font-body text-sm font-semibold text-bark-ink shadow-sm transition-colors hover:bg-white"
        >
          Sign out
        </button>

        <div className="w-full max-w-xl rounded-[28px] border border-bark-ink/10 bg-white/55 px-8 py-12 text-center shadow-[0_24px_80px_rgba(26,60,52,0.10)] backdrop-blur-sm">
          <p className="mb-3 font-body text-sm font-semibold uppercase tracking-[0.28em] text-bark-terracotta/80">
            Main Page
          </p>
          <h1 className="font-display text-4xl font-bold text-bark-ink sm:text-5xl">
            Blank on purpose
          </h1>
          <p className="mx-auto mt-4 max-w-md font-body text-lg leading-8 text-bark-muted">
            You are signed in. I left this page empty so can build the rest of BARK from here.
          </p>
        </div>
      </div>
    </div>
  );
}
