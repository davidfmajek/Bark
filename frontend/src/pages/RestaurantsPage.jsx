import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { Clock, MapPin, ArrowRight, Star, StarHalf, Loader2, FilePenLine } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from "../contexts/AuthContext"; // 1. Added Auth Context
import { resolveRestaurantCardImageUrl } from '../lib/restaurantImages';

export function RestaurantsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { isAuthenticated } = useAuth(); // 3. Get auth status
  const [searchParams] = useSearchParams();
  const filterEstablishmentId = searchParams.get('e');

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  /** Resolved public image URL per establishment, or null if none; undefined while resolving. */
  const [cardImageByEstablishmentId, setCardImageByEstablishmentId] = useState({});

  useEffect(() => {
    async function fetchRestaurants() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('establishments_with_ratings')
          .select(`*`)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;
        setRestaurants(data || []);
      } catch (error) {
        console.error('Error fetching restaurants:', error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRestaurants();
  }, []);

  const restaurantsToShow = useMemo(
    () =>
      filterEstablishmentId
        ? restaurants.filter(
            (r) => String(r.establishment_id) === String(filterEstablishmentId),
          )
        : restaurants,
    [restaurants, filterEstablishmentId],
  );

  const cardImageResolveKey = useMemo(
    () => restaurantsToShow.map((r) => String(r.establishment_id)).join('|'),
    [restaurantsToShow],
  );

  useEffect(() => {
    if (restaurantsToShow.length === 0) {
      setCardImageByEstablishmentId({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        restaurantsToShow.map(async (r) => {
          const url = await resolveRestaurantCardImageUrl(supabase, r);
          return [String(r.establishment_id), url];
        }),
      );
      if (!cancelled) {
        setCardImageByEstablishmentId(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve when visible establishment ids change; `restaurantsToShow` identity can churn without id changes
  }, [cardImageResolveKey]);

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? 'text-white' : 'text-black'}`}>
      {/* Background Logic */}
      {dark ? (
        <>
          <div className="fixed inset-0 -z-10 bg-[#0f1219]" />
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
        </>
      ) : (
        <div className="fixed inset-0 -z-10 bg-white" />
      )}

      <main className="container mx-auto px-6 py-12">
        <h1 className="text-4xl font-black mb-10 tracking-tight">UMBC Establishments</h1>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#ffbf3e]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {restaurantsToShow.map((restaurant) => {
              const imageSrc = cardImageByEstablishmentId[String(restaurant.establishment_id)];
              
              return (
                <div key={restaurant.establishment_id} className="max-w-5xl mx-auto w-full">
                  <div 
                    className={`group relative block overflow-hidden rounded-3xl border transition-all duration-500 hover:shadow-[0_20px_50px_rgba(255,191,62,0.15)] 
                      ${dark ? 'border-white/10 bg-gray-900/50' : 'border-black/5 bg-white'}`}
                  >
                    {/* Image Section */}
                    <div className="aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
                      {imageSrc === undefined ? (
                        <div
                          aria-hidden
                          className={`flex h-full w-full items-center justify-center ${dark ? 'bg-[#111827]' : 'bg-gray-200'}`}
                        >
                          <Loader2 className="h-8 w-8 animate-spin text-[#ffbf3e]/80" />
                        </div>
                      ) : !imageSrc ? (
                        <div
                          aria-label={`${restaurant.name} placeholder image`}
                          className={`h-full w-full ${dark ? 'bg-[#111827]' : 'bg-gray-200'}`}
                        />
                      ) : (
                        <img
                          alt={restaurant.name}
                          src={imageSrc}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      )}
                      <div className={`absolute inset-0 bg-gradient-to-t ${dark ? 'from-[#0f1219] via-[#0f1219]/40' : 'from-black/70 via-black/20'} to-transparent`} />
                    </div>

                    {/* Content Section */}
                    <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
                      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md w-fit px-3 py-1 rounded-full border border-white/10">
                           <div className="flex items-center text-[#ffbf3e]">
                              {[...Array(5)].map((_, i) => {
                                const starNumber = i + 1;
                                const rating = restaurant.average_rating || 0;

                                if (rating >= starNumber) {
                                  // Full Star: Rating is higher than or equal to current star (e.g., 4.2 >= 4)
                                  return <Star key={i} className="w-3.5 h-3.5 fill-current" />;
                                } else if (rating > starNumber - 1 && rating < starNumber) {
                                  // Half Star: Rating is between two integers (e.g., 4.2 is > 4 and < 5)
                                  return <StarHalf key={i} className="w-3.5 h-3.5 fill-current" />;
                                } else {
                                  // Empty Star: Rating is lower than this star level
                                  return <Star key={i} className="w-3.5 h-3.5" />; 
                                }
                              })}
                            </div>
                            <span className="text-xs font-bold text-white">
                              {Number(restaurant.average_rating || 0).toFixed(1)}   ({restaurant.total_reviews || 0} reviews)
                            </span>
                          </div>

                          <h2 className="text-3xl font-bold text-white sm:text-4xl">
                            {restaurant.name}
                          </h2>
                          
                          <div className="flex flex-wrap gap-y-2 gap-x-6 text-gray-200">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[#ffbf3e]" />
                              <span className="text-sm">{restaurant.hours}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-[#ffbf3e]" />
                              <span className="text-sm line-clamp-1">
                                {restaurant.address ||restaurant.building_name}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 4. Action Buttons Container */}
                        <div className="flex flex-col gap-3">
                          {isAuthenticated && (
                            <a
                              href={`/restaurants/${restaurant.establishment_id}/writeareview`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffbf3e] px-6 py-3 text-black font-bold transition-all hover:bg-white hover:scale-105 active:scale-95 whitespace-nowrap"
                            >
                              Write a Review
                              <FilePenLine className="w-5 h-5" />
                            </a>
                          )}
                          <a 
                            href={`/restaurants/${restaurant.establishment_id}`} 
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffbf3e] backdrop-blur-md border border-white/20 px-6 py-3 text-black font-bold transition-all hover:bg-[#ffffff] hover:text-black hover:scale-105 active:scale-95 whitespace-nowrap"
                          >
                            To {restaurant.name} 
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}