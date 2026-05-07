import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { PictureCarousel } from '../components/PictureCarousel';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  fetchCarouselSlidesFromStorage
} from '../lib/restaurantImages';

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
  
  const [establishments, setEstablishments] = useState([]);
  const [topSpots, setTopSpots] = useState([]);
  const [featuredReviews, setFeaturedReviews] = useState([]);
  const [carouselSlides, setCarouselSlides] = useState([]);

  const [stats, setStats] = useState({
    reviewCount: 0,
    avgRating: 0,
    establishmentCount: 0
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [estRes, revRes] = await Promise.all([
        supabase.from('establishments').select('*').eq('is_active', true),
        supabase.from('reviews')
          .select('*, users(display_name)')
          .order('helpful_count', { ascending: false })
      ]);
	
      const activeEsts = estRes.data ?? [];
      const allReviews = revRes.data ?? [];

      if (mounted) {
        const totalRating = allReviews.reduce((acc, curr) => acc + curr.rating, 0);
        const average = allReviews.length ? (totalRating / allReviews.length).toFixed(1) : 0;
        
        setStats({
          reviewCount: allReviews.length,
          avgRating: average,
          establishmentCount: activeEsts.length
        });

        const formattedSpots = activeEsts.map(est => {
          const estReviews = allReviews.filter(r => r.establishment_id === est.establishment_id);
          const avg = estReviews.length 
            ? estReviews.reduce((acc, cur) => acc + cur.rating, 0) / estReviews.length 
            : 0;

          // Resolve image candidates using your helper

          return {
            id: est.establishment_id,
            name: est.name,
            meta: `${est.building_name || 'Campus'} \u00b7 ${est.category || 'Dining'}`,
            rating: avg,
            badge: avg >= 4.5 ? 'TOP RATED' : (avg >= 4.0 ? 'POPULAR' : null),
            accent: 'from-[#f5bf3e]/20 to-transparent',
            picture: `https://igxeykkarewzlcxhwcnu.supabase.co/storage/v1/object/public/Resturant-logos/logos/${est.establishment_id}.png`
          };
        });

        const top4 = formattedSpots.sort((a, b) => b.rating - a.rating).slice(0, 4);
        setTopSpots(top4);

        const pickedReviews = top4.map(spot => {
          const latestReview = allReviews.find(r => r.establishment_id === spot.id);
          if (!latestReview) return null;
          const reviewerName = latestReview.users?.display_name || 'Anonymous Retriever';

          return {
            id: latestReview.review_id || latestReview.id, 
            reviewId: latestReview.review_id || latestReview.id,
            establishmentId: spot.id,
            name: reviewerName,
            initials: reviewerName.split(/[ _]/).map(n => n[0]).join('').toUpperCase().substring(0, 2),
            establishmentName: spot.name,
            rating: latestReview.rating,
            content: latestReview.body || latestReview.content || 'Great food and atmosphere!',
          };
        }).filter(Boolean);

        setFeaturedReviews(pickedReviews);
        setEstablishments(activeEsts);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!establishments.length) return;
    let cancelled = false;
    (async () => {
      const slides = await fetchCarouselSlidesFromStorage(supabase, establishments);
      if (!cancelled) setCarouselSlides(slides);
    })();
    return () => { cancelled = true; };
  }, [establishments]);

  return (
    <div className={`relative min-h-screen ${dark ? 'text-white' : 'text-black'}`}>
      {/* Background Carousel */}
      <div className="pointer-events-none absolute inset-0 -z-10 min-h-screen">
        {carouselSlides.length > 0 ? (
          <PictureCarousel
            dark={dark}
            rounded={false}
            pauseOnHover={false}
            showDots={false}
            intervalMs={5200}
            className="h-full w-full"
            overlayClassName={dark ? 'bg-[#0f1219]/60' : 'bg-white/60'}
            imageClassName="h-full w-full object-cover blur-[6px] transform-gpu scale-110"
            slides={carouselSlides}
          />
        ) : (
          <div className={`h-full min-h-screen w-full ${dark ? 'bg-[#0f1219]' : 'bg-gray-100'}`} />
        )}
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
          <div className={`relative overflow-hidden rounded-3xl border ${dark ? 'border-white/10 bg-[#0f1219]' : 'border-black/10 bg-white'}`}>
            <div className="absolute inset-0 -z-10">
              <div className="h-full w-full bg-[radial-gradient(circle_at_left,_rgba(212,160,23,0.30),_transparent_42%)] opacity-80" />
            </div>

            <div className="flex flex-col gap-8 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${dark ? 'bg-white/5 text-white/80' : 'bg-black/5 text-black/70'}`}>
                  <span className="mr-2">•</span> UMBC Campus Dining
                </div>
                <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
                  Honest reviews for <span className={dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}>real Retrievers</span>
                </h1>
                <p className={`mt-4 max-w-lg text-sm leading-relaxed sm:text-base ${dark ? 'text-white/75' : 'text-black/70'}`}>
                  Find the best food on campus, read trusted reviews, and never have a disappointing meal again.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link to="/restaurants" className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${dark ? 'bg-[#f5bf3e] text-[#16181f] hover:bg-[#ffd15e]' : 'bg-[#D4A017] text-black hover:bg-[#c4920f]'}`}>
                    Browse Restaurants
                  </Link>
                  <Link to="/map" className={`rounded-full border px-5 py-2.5 text-sm font-bold transition ${dark ? 'border-white/15 bg-white/5 text-white/90 hover:bg-white/10' : 'border-black/15 bg-black/5 text-black/80 hover:bg-black/10'}`}>
                    Explore Map
                  </Link>
                </div>
              </div>

              <div className="hidden w-full max-w-md sm:block">
                {carouselSlides.length > 0 && (
                  <PictureCarousel
                    dark={dark}
                    className="aspect-[4/3] opacity-95"
                    showDots={false}
                    imageClassName="h-full w-full object-cover"
                    slides={carouselSlides}
                  />
                )}
              </div>
            </div>

            <div className="px-6 pb-6 sm:px-8 sm:pb-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { value: stats.establishmentCount, label: 'Dining Spots' },
                  { value: stats.reviewCount, label: 'Total Reviews' },
                  { value: stats.avgRating, label: 'Campus Rating' },
                ].map((s, idx) => (
                  <div key={idx} className={`rounded-2xl border p-4 text-center ${dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white/80'}`}>
                    <div className="font-display text-2xl font-extrabold">{s.value}</div>
                    <div className={`text-[10px] font-bold uppercase ${dark ? 'text-white/60' : 'text-black/50'}`}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Top Spots Section */}
        <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Top Spots Right Now</h2>
            <Link to="/restaurants" className={`text-sm font-semibold ${dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}`}>View all →</Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topSpots.map((r) => (
              <Link
                key={r.id}
                to={`/restaurants/${r.id}`}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  dark ? 'border-white/10 bg-[#161b26] hover:bg-[#1c2230]' : 'border-black/10 bg-white shadow-sm'
                }`}
              >
                <div className="relative h-32 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {r.picture ? (
                    <img 
                      src={r.picture} 
                      alt={r.name} 
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => { 
                        e.target.onerror = null; 
                        e.target.src = 'https://via.placeholder.com/400x300?text=Dining+Spot'; 
                      }}
                    />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${r.accent} opacity-40`} />
                  )}
                  {r.badge && (
                    <div className="absolute top-2 right-2">
                      <span className="rounded-md bg-black/60 backdrop-blur-md px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white">
                        {r.badge}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-display text-base font-extrabold truncate">{r.name}</h3>
                  <p className={`text-xs ${dark ? 'text-white/60' : 'text-black/60'}`}>{r.meta}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Stars rating={r.rating} dark={dark} />
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                      dark ? 'bg-white/5 text-white/40 group-hover:bg-[#f5bf3e] group-hover:text-black' : 'bg-black/5 text-black/40 group-hover:bg-[#D4A017] group-hover:text-white'
                    }`}>
                      Details
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Latest Reviews Section */}
        <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Latest from Top Spots</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredReviews.map((t) => (
              <Link
                key={t.id}
                to={`/restaurants/${t.establishmentId}?review=${encodeURIComponent(t.reviewId)}`}
                className={`block rounded-2xl border p-5 transition hover:-translate-y-0.5 ${dark ? 'border-white/10 bg-[#161b26] hover:bg-[#1c2230]' : 'border-black/10 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${dark ? 'bg-white/10' : 'bg-black/5'}`}>
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold">{t.name}</div>
                    <div className={`truncate text-[10px] font-bold uppercase ${dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}`}>
                      {t.establishmentName}
                    </div>
                  </div>
                </div>
                <div className="mt-3"><Stars rating={t.rating} dark={dark} /></div>
                <p className={`mt-3 line-clamp-4 break-words text-sm italic leading-relaxed [overflow-wrap:anywhere] ${dark ? 'text-white/75' : 'text-black/70'}`}>
                  “{t.content.length > 120 ? `${t.content.substring(0, 120)}...` : t.content}”
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Signup CTA */}
        {!isAuthenticated && (
          <section className="mx-auto mt-14 max-w-6xl px-4 pb-16 sm:px-6">
            <div className={`rounded-3xl border p-10 text-center ${dark ? 'border-white/10 bg-[#0f1219]' : 'border-black/10 bg-white'}`}>
              <h2 className={`font-display text-3xl font-extrabold ${dark ? 'text-white' : 'text-[#16181f]'}`}>Join the pack.</h2>
              <p className={`mt-3 ${dark ? 'text-white/70' : 'text-black/70'}`}>Create an account to write reviews and track your dining history.</p>
              <Link to="/signin?mode=signup" className="mt-6 inline-flex rounded-full bg-[#f5bf3e] px-8 py-3 text-sm font-extrabold text-[#16181f] hover:bg-[#ffd15e]">
                Create Free Account
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
