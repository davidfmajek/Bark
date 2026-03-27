import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { PictureCarousel } from '../components/PictureCarousel';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getRestaurantCarouselSlides } from '../lib/restaurantImages';

function Stars({ rating, dark }) {
  const safeRating = Number.isFinite(rating) ? rating : 0;
  const rounded = Math.round(safeRating * 10) / 10;
  const filledCount = Math.max(0, Math.min(5, Math.round(safeRating)));

  return (
    <div className={`flex items-center gap-1 ${dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}`}>
      <div className="flex items-center gap-0.5" aria-label={`Rating: ${rounded} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < filledCount;
          return (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 ${filled ? 'opacity-100' : 'opacity-25'}`}
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73 1.64 7.03z" />
            </svg>
          );
        })}
      </div>
      <span className={`ml-1 text-xs font-semibold ${dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}`}>
        {rounded}
      </span>
    </div>
  );
}

export function HomePage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { isAuthenticated } = useAuth();
  const [trueGritEstablishmentId, setTrueGritEstablishmentId] = useState(null);
  const restaurantSlides = getRestaurantCarouselSlides();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('establishments')
        .select('establishment_id, name')
        .eq('is_active', true);
      const trueGrit = (data ?? []).find((e) => /true\s*grit/i.test(e.name));
      if (mounted && trueGrit) setTrueGritEstablishmentId(trueGrit.establishment_id);
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className={`relative min-h-screen ${dark ? 'text-white' : 'text-black'}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 min-h-screen">
        <PictureCarousel
          dark={dark}
          rounded={false}
          pauseOnHover={false}
          showDots={false}
          intervalMs={5200}
          className="h-full w-full"
          overlayClassName={dark ? 'bg-[#0f1219]/60' : 'bg-white/60'}
          imageClassName="h-full w-full object-cover blur-[6px] transform-gpu scale-110"
          slides={restaurantSlides}
        />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
          <div
            className={`relative overflow-hidden rounded-3xl border ${
              dark ? 'border-white/10 bg-[#0f1219]' : 'border-black/10 bg-white'
            }`}
          >
            <div className="absolute inset-0 -z-10">
              <div
                className={`h-full w-full bg-[radial-gradient(circle_at_left,_rgba(212,160,23,0.30),_transparent_42%)] opacity-80`}
              />
              <div
                className={`h-full w-full bg-[radial-gradient(circle_at_right,_rgba(245,191,62,0.14),_transparent_48%)] ${
                  dark ? 'mix-blend-screen' : 'mix-blend-multiply'
                }`}
              />
            </div>

            <div className="flex flex-col gap-8 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <div
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    dark ? 'bg-white/5 text-white/80' : 'bg-black/5 text-black/70'
                  }`}
                >
                  <span className="mr-2">•</span>
                  UMBC Campus Dining
                </div>

                <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
                  <span className={dark ? 'text-white' : 'text-black'}>Honest</span>{' '}
                  <span className={dark ? 'text-white' : 'text-black'}>reviews for</span>{' '}
                  <span className={dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}>real Retrievers</span>
                </h1>

                <p className={`mt-4 max-w-lg text-sm leading-relaxed sm:text-base ${dark ? 'text-white/75' : 'text-black/70'}`}>
                  Find the best food on campus, read trusted reviews from fellow UMBC family, and never have a disappointing meal again.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    to="/restaurants"
                    className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition ${
                      dark
                        ? 'bg-[#f5bf3e] text-[#16181f] hover:bg-[#ffd15e]'
                        : 'bg-[#D4A017] text-black hover:bg-[#c4920f]'
                    }`}
                  >
                    Browse Restaurants
                  </Link>
                  <Link
                    to="/map"
                    className={`inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-bold transition ${
                      dark
                        ? 'border-white/15 bg-white/5 text-white/90 hover:bg-white/10'
                        : 'border-black/15 bg-black/5 text-black/80 hover:bg-black/10'
                    }`}
                  >
                    Explore the Map
                  </Link>
                </div>
              </div>

              <div className="hidden w-full max-w-md sm:block">
                <PictureCarousel
                  dark={dark}
                  className="aspect-[4/3] opacity-95"
                  overlayClassName={dark ? 'bg-black/25' : 'bg-black/10'}
                  intervalMs={4200}
                  imageClassName="h-full w-full object-cover"
                  slides={restaurantSlides}
                />
              </div>
            </div>

            {/* Stat cards (overlay-ish like the screenshot) */}
            <div className="px-6 pb-6 sm:px-8 sm:pb-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { value: '16+', label: 'Dining Spots' },
                  { value: '340+', label: 'Reviews' },
                  { value: '4.2', label: 'Avg Rating' },
                  { value: '12', label: 'Locations' },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-4 text-center shadow-sm ${
                      dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white/80'
                    }`}
                  >
                    <div className={`font-display text-2xl font-extrabold ${dark ? 'text-white' : 'text-black'}`}>{s.value}</div>
                    <div className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-white/65' : 'text-black/55'}`}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Top Spots */}
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Top Spots Right Now</h2>
            <Link
              to="/restaurants"
              className={`text-sm font-semibold ${dark ? 'text-[#f5bf3e] hover:text-[#ffd15e]' : 'text-[#D4A017] hover:text-[#c4920f]'}`}
            >
              View all restaurants →
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Chick-fil-A', meta: 'Commons • Fast Food', rating: 4.9, badge: 'POPULAR', pill: 'OPEN NOW', accent: 'from-[#f5bf3e]/30 to-transparent' },
              { name: 'True Grits', meta: 'True Grits • Comfort', rating: 4.4, pill: 'OPEN NOW', accent: 'from-[#36c9a5]/25 to-transparent' },
              { name: 'Freshens', meta: 'Commons • Healthy', rating: 4.2, badge: 'TRENDING', pill: 'OPEN NOW', accent: 'from-[#f5a7d3]/20 to-transparent' },
              { name: 'Starbucks', meta: 'University Center • Cafe', rating: 4.1, pill: 'OPEN NOW', accent: 'from-[#a7b6ff]/25 to-transparent' },
            ].map((r) => {
              const isTrueGrit = r.name === 'True Grits' && trueGritEstablishmentId != null;
              const cardClass = `relative overflow-hidden rounded-2xl border p-4 ${
                dark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'
              } ${isTrueGrit ? 'transition-opacity hover:opacity-95' : ''}`;
              const content = (
                <>
                  <div className={`relative h-24 overflow-hidden rounded-xl bg-gradient-to-br ${r.accent}`}>
                    <div className={`absolute inset-0 opacity-30 ${dark ? 'bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)]' : 'bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.06),_transparent_55%)]'}`} />
                  </div>

                  <h3 className="mt-3 font-display text-base font-extrabold">{r.name}</h3>
                  <p className={`mt-1 text-xs ${dark ? 'text-white/60' : 'text-black/60'}`}>{r.meta}</p>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Stars rating={r.rating} dark={dark} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {r.badge && (
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                          dark ? 'bg-white/10 text-white/80' : 'bg-black/5 text-black/70'
                        }`}
                      >
                        {r.badge}
                      </span>
                    )}
                    {r.pill && (
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                          dark ? 'border border-white/10 bg-white/5 text-white/80' : 'border border-black/10 bg-black/5 text-black/70'
                        }`}
                      >
                        {r.pill}
                      </span>
                    )}
                  </div>
                </>
              );
              return isTrueGrit ? (
                <Link
                  key={r.name}
                  to={`/restaurants?e=${trueGritEstablishmentId}`}
                  className={cardClass}
                  aria-label={`View ${r.name} restaurant page`}
                >
                  {content}
                </Link>
              ) : (
                <article key={r.name} className={cardClass}>
                  {content}
                </article>
              );
            })}
          </div>
        </section>

        {/* Testimonials */}
        <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">What Reviewers Are Saying</h2>
            <Link
              to="/my-reviews"
              className={`text-sm font-semibold ${dark ? 'text-[#f5bf3e] hover:text-[#ffd15e]' : 'text-[#D4A017] hover:text-[#c4920f]'}`}
            >
              All reviews →
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { initials: 'JB', name: 'Justin B.', meta: 'Chick-fil-A • Commons', rating: 5, quote: 'The spicy deluxe is unmatched. Line moves fast even during lunch rush. A true campus staple.' },
              { initials: 'SC', name: 'Sophie C.', meta: 'True Grits • Main Dining', rating: 5, quote: 'Great variety and the pasta bar never disappoints. Gets crowded but the food is worth the wait.' },
              { initials: 'DM', name: 'David M.', meta: 'Starbucks • University Center', rating: 4, quote: 'Not the best place to get matcha, but the pastries always compensate!' },
            ].map((t) => (
              <article
                key={t.name}
                className={`rounded-2xl border p-5 shadow-sm ${
                  dark ? 'border-white/10 bg-[#161b26]' : 'border-black/10 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-extrabold ${
                      dark ? 'bg-white/10 text-white/90' : 'bg-black/5 text-black/80'
                    }`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className={`font-body text-sm font-extrabold ${dark ? 'text-white/90' : 'text-black/90'}`}>{t.name}</div>
                    <div className={`text-xs ${dark ? 'text-white/60' : 'text-black/60'}`}>{t.meta}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <Stars rating={t.rating} dark={dark} />
                </div>

                <p className={`mt-3 text-sm leading-relaxed ${dark ? 'text-white/75' : 'text-black/70'}`}>“{t.quote}”</p>
              </article>
            ))}
          </div>
        </section>

        {/* Join the pack (hidden when logged in) */}
        {!isAuthenticated && (
          <section className="mx-auto mt-14 max-w-6xl px-4 pb-16 sm:px-6">
            <div
              className={`relative overflow-hidden rounded-3xl border ${
                dark ? 'border-white/10 bg-[#0f1219]' : 'border-black/10 bg-[#1e2430]'
              }`}
            >
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_left,_rgba(245,191,62,0.30),_transparent_45%)] opacity-80" />
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_right,_rgba(255,255,255,0.12),_transparent_40%)] opacity-70" />

              <div className="flex flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center sm:px-10">
                <div>
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                    Join the pack
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white">
                    Share your take.
                    <br />
                    Help the herd.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
                    Create an account to write reviews, save favorites, and track your dining history.
                  </p>
                </div>

                <Link
                  to="/signin?mode=signup"
                  className="inline-flex items-center justify-center rounded-full bg-[#f5bf3e] px-6 py-3 text-sm font-extrabold text-[#16181f] shadow-sm transition hover:bg-[#ffd15e]"
                >
                  Create Free Account
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
