import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { 
  Clock, 
  MapPin, 
  ChevronLeft, 
  ChevronRight,
  Star, 
  Loader2, 
  Utensils, 
  Info, 
  FilePenLine,
  Images,
  X,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from "../contexts/AuthContext";
import { fetchEstablishmentGalleryUrls } from '../lib/restaurantImages.js';

function buildCollagePanels(allUrls, offset) {
  const u = allUrls.filter(Boolean);
  if (u.length === 0) {
    return { panels: [null, null, null], photoCount: 0, galleryMaxOffset: 0 };
  }
  if (u.length === 1) {
    return {
      panels: [
        { src: u[0], objectPosition: 'left center' },
        { src: u[0], objectPosition: 'center center' },
        { src: u[0], objectPosition: 'right center' },
      ],
      photoCount: 1,
      galleryMaxOffset: 0,
    };
  }
  if (u.length === 2) {
    return {
      panels: [
        { src: u[0], objectPosition: 'center' },
        { src: u[1], objectPosition: 'center' },
        { src: u[0], objectPosition: 'center' },
      ],
      photoCount: 2,
      galleryMaxOffset: 0,
    };
  }
  const len = u.length;
  const maxO = Math.max(0, len - 3);
  const o = Math.min(Math.max(0, offset), maxO);
  return {
    panels: [0, 1, 2].map((i) => ({
      src: u[o + i],
      objectPosition: 'center',
    })),
    photoCount: len,
    galleryMaxOffset: maxO,
  };
}

function CollageCell({ panel, index, panelBroken, setPanelBroken, dark, className }) {
  const broken = panelBroken[index];
  return (
    <>
      {panel && !broken ? (
        <img
          alt=""
          src={panel.src}
          className={`w-full object-cover ${className}`}
          style={{ objectPosition: panel.objectPosition || 'center' }}
          onError={() =>
            setPanelBroken((prev) => {
              const next = [...prev];
              next[index] = true;
              return next;
            })
          }
        />
      ) : (
        <div
          className={`flex w-full items-center justify-center ${className} ${
            dark ? 'bg-[#1a1f2e]' : 'bg-gray-200'
          }`}
        >
          <Utensils className={`h-10 w-10 ${dark ? 'text-white/15' : 'text-black/10'}`} />
        </div>
      )}
    </>
  );
}

export function EstablishmentPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const dark = theme === 'dark';

  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [galleryOffset, setGalleryOffset] = useState(0);
  const [panelBroken, setPanelBroken] = useState([false, false, false]);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  const { panels, photoCount, galleryMaxOffset } = useMemo(
    () => buildCollagePanels(galleryUrls, galleryOffset),
    [galleryUrls, galleryOffset],
  );

  useEffect(() => {
    if (!establishment) return;
    let cancelled = false;
    setGalleryLoading(true);
    setGalleryUrls([]);
    (async () => {
      const urls = await fetchEstablishmentGalleryUrls(supabase, establishment);
      if (!cancelled) {
        setGalleryUrls(urls);
        setGalleryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [establishment?.establishment_id]);

  useEffect(() => {
    setGalleryOffset(0);
    setPanelBroken([false, false, false]);
  }, [establishment?.establishment_id, galleryUrls.join('|')]);

  useEffect(() => {
    setGalleryOffset((prev) => Math.min(prev, galleryMaxOffset));
  }, [galleryMaxOffset]);

  useEffect(() => {
    setPanelBroken([false, false, false]);
  }, [galleryOffset]);

  useEffect(() => {
    if (!galleryModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setGalleryModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [galleryModalOpen]);

  useEffect(() => {
  async function fetchEstablishment() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('establishments_with_ratings')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      // This helper function must match the logic in your utils.js exactly
      const cleanSlug = (text) => 
        text
          .toLowerCase()
        // replaces spaces with dashes
        .replace(/\s+/g, '-')
        // removes any character that is not a letter, number, or a dash
        .replace(/[^a-z0-9\-]/g, '');

      const match = data.find(
        (item) =>
          String(item.establishment_id) === String(slug) ||
          cleanSlug(item.name) === slug,
      );

      setEstablishment(match);
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  }
  fetchEstablishment();
}, [slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#ffbf3e]" />
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <h2 className="text-2xl font-bold">Establishment not found</h2>
        <Link to="/restaurants" className="text-[#ffbf3e] hover:underline font-bold">
          Return to UMBC Establishments
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'text-white' : 'text-black'}`}>
      {/* Background Logic */}
      {dark ? (
        <>
          <div className="fixed inset-0 -z-10 bg-[#0f1219]" />
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
        </>
      ) : (
        <div className="fixed inset-0 -z-10 bg-white" />
      )}

      {/* Photo strip — Yelp-style 3-up collage (URLs resolved from bucket) */}
      <div className="relative w-full overflow-hidden">
        <div className="relative">
          <div className="flex flex-col sm:grid sm:h-[min(52vh,520px)] sm:grid-cols-3 sm:gap-0">
            <div className="relative h-[min(42vh,320px)] w-full overflow-hidden sm:h-full">
              <CollageCell
                panel={panels[0]}
                index={0}
                panelBroken={panelBroken}
                setPanelBroken={setPanelBroken}
                dark={dark}
                className="min-h-[140px] h-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-0 sm:contents">
              <div className="relative h-36 overflow-hidden sm:h-full">
                <CollageCell
                  panel={panels[1]}
                  index={1}
                  panelBroken={panelBroken}
                  setPanelBroken={setPanelBroken}
                  dark={dark}
                  className="h-full min-h-[9rem]"
                />
              </div>
              <div className="relative h-36 overflow-hidden sm:h-full">
                <CollageCell
                  panel={panels[2]}
                  index={2}
                  panelBroken={panelBroken}
                  setPanelBroken={setPanelBroken}
                  dark={dark}
                  className="h-full min-h-[9rem]"
                />
              </div>
            </div>
          </div>
          {galleryLoading && (
            <div className="absolute inset-0 z-[25] flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
              <Loader2 className="h-10 w-10 animate-spin text-[#ffbf3e]" aria-label="Loading photos" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-white/90 backdrop-blur-md transition-all hover:bg-black/50 hover:text-[#ffbf3e] sm:left-6 sm:top-6"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {!galleryLoading && photoCount > 3 && galleryMaxOffset > 0 && (
          <>
            <button
              type="button"
              aria-label="Previous photos"
              aria-disabled={galleryOffset <= 0}
              disabled={galleryOffset <= 0}
              className="absolute left-2 top-[42%] z-20 flex -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60 disabled:pointer-events-none disabled:opacity-35 sm:top-1/2 sm:p-2.5"
              onClick={() => setGalleryOffset((o) => Math.max(0, o - 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photos"
              aria-disabled={galleryOffset >= galleryMaxOffset}
              disabled={galleryOffset >= galleryMaxOffset}
              className="absolute right-2 top-[42%] z-20 flex -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60 disabled:pointer-events-none disabled:opacity-35 sm:top-1/2 sm:p-2.5"
              onClick={() => setGalleryOffset((o) => Math.min(galleryMaxOffset, o + 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {!galleryLoading && photoCount >= 1 && (
          <div className="absolute bottom-4 right-4 z-20 sm:bottom-5 sm:right-6">
            <button
              type="button"
              onClick={() => setGalleryModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1a1a1a]/90 px-4 py-2 text-sm font-semibold text-white/95 shadow-lg backdrop-blur-md transition hover:bg-black/90 hover:ring-1 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf3e]"
              aria-label={`View all ${photoCount} photos`}
            >
              <Images className="h-4 w-4 shrink-0" aria-hidden />
              {photoCount === 1 ? '1 photo' : `${photoCount} photos`}
            </button>
          </div>
        )}

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[min(55%,280px)] bg-gradient-to-t to-transparent ${
            dark ? 'from-[#0f1219] via-[#0f1219]/55' : 'from-black/85 via-black/40'
          }`}
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end px-6 pb-10 sm:container sm:mx-auto sm:px-6 sm:pb-12">
          <div className="pointer-events-auto space-y-4">
            <h1 className="font-display text-4xl font-black tracking-tight text-white drop-shadow-sm sm:text-5xl md:text-7xl">
              {establishment.name}
            </h1>
            <div className="flex flex-wrap gap-3 text-white">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-4 py-2 backdrop-blur-md">
                <Star className="h-5 w-5 fill-[#ffbf3e] text-[#ffbf3e]" />
                <span className="text-lg font-bold">
                  {Number(establishment.average_rating ?? establishment.rating ?? 0).toFixed(1)}
                </span>
                <span className="text-sm opacity-80">
                  ({establishment.reviews ?? 0} reviews)
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-4 py-2 backdrop-blur-md">
                <MapPin className="h-5 w-5 text-[#ffbf3e]" />
                <span className="font-medium">{establishment.building_name || establishment.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Left Column: Info & Reviews */}
          <div className="lg:col-span-2 space-y-12">
            <section>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Info className="text-[#ffbf3e] w-6 h-6" /> About this spot
              </h3>
              <p className={`text-xl leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                {establishment.description || `Welcome to ${establishment.name}. Experience quality dining located right here at ${establishment.building_name || 'UMBC\' scampus'}.`}
              </p>
            </section>

            {/* Reviews Section */}
            <section className="pt-10 border-t border-white/10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h3 className="text-3xl font-bold">Retriever Reviews</h3>
                
                {isAuthenticated && (
                  <Link
                    to={`/restaurants/${establishment.establishment_id}/writeareview`}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ffbf3e] px-6 py-3 text-black font-bold transition-all hover:bg-white hover:scale-105 active:scale-95"
                  >
                    <FilePenLine className="w-5 h-5" />
                    Write a Review
                  </Link>
                )}
              </div>

              {/* Empty State Placeholder */}
              <div className={`p-16 rounded-[2rem] border-2 border-dashed ${dark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-gray-50'} text-center`}>
                <p className="text-lg opacity-40">No reviews have been posted yet. Be the first to share your thoughts!</p>
              </div>
            </section>
          </div>

          {/* Right Column: Sidebar Stats */}
          <div className="space-y-6">
            <div className={`p-8 rounded-[2rem] border ${dark ? 'bg-gray-900/40 border-white/10' : 'bg-gray-50 border-black/5 shadow-sm'}`}>
              <h4 className="font-bold text-xl mb-6 flex items-center gap-3">
                <Clock className="w-6 h-6 text-[#ffbf3e]" /> Operating Hours
              </h4>
              <div className={`text-lg leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                {establishment.hours || "Hours not listed"}
              </div>
            </div>

            <div className={`p-8 rounded-[2rem] border ${dark ? 'bg-gray-900/40 border-white/10' : 'bg-gray-50 border-black/5 shadow-sm'}`}>
              <h4 className="font-bold text-xl mb-4 flex items-center gap-3">
                <Utensils className="w-6 h-6 text-[#ffbf3e]" /> Highlights
              </h4>
              <ul className={`space-y-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                <li className="flex items-center gap-2">• Student-Friendly</li>
                <li className="flex items-center gap-2">• UMBC Meal Plan Accepted</li>
                <li className="flex items-center gap-2">• Casual Dining</li>
              </ul>
            </div>
          </div>

        </div>
      </main>

      {galleryModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="establishment-gallery-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            aria-label="Close photo gallery"
            onClick={() => setGalleryModalOpen(false)}
          />
          <div
            className={`relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
              dark ? 'border-white/10 bg-[#0f1219]' : 'border-black/10 bg-white'
            }`}
          >
            <div
              className={`flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4 ${
                dark ? 'border-white/10' : 'border-black/10'
              }`}
            >
              <h2 id="establishment-gallery-title" className="text-lg font-bold">
                Photos · {establishment.name}
              </h2>
              <button
                type="button"
                onClick={() => setGalleryModalOpen(false)}
                className={`rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf3e] ${
                  dark ? 'text-white/90' : 'text-black/80'
                }`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {galleryUrls.length === 0 ? (
                <p className={`py-10 text-center text-sm ${dark ? 'text-white/50' : 'text-black/50'}`}>
                  No photos are stored for this spot yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {galleryUrls.map((src, i) => (
                    <div
                      key={`${src}-${i}`}
                      className={`overflow-hidden rounded-xl ${
                        dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-gray-100 ring-1 ring-black/5'
                      }`}
                    >
                      <img
                        src={src}
                        alt=""
                        className="aspect-[4/3] h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}