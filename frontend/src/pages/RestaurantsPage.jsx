import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { Clock, MapPin, ArrowRight, Star, StarHalf, Loader2, FilePenLine } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from "../contexts/AuthContext";
import { resolveRestaurantCardImageUrl } from '../lib/restaurantImages';

// FIX: Added 'new' keyword. Date() returns a string; new Date() returns the object.
const CurrentDay = new Date().toLocaleDateString('en-US', { weekday: 'short' });
function formatTo12Hour(timeStr) {
  if (!timeStr) return '';
  // Split the "HH:mm:ss" string
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // Convert 0 to 12 for midnight
  return `${h}:${minutes} ${ampm}`;
}
function getBusinessStatus(restaurant) {
  if (!restaurant.is_open) return 'Closed';

  const now = new Date();
  // Get current minutes since midnight (e.g., 2:30 PM = 14 * 60 + 30 = 870)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Helper to convert "HH:mm:ss" to total minutes
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    // If the time is 00:00:00, we treat it as 1440 (end of day) for comparison
    return h === 0 && m === 0 ? 1440 : h * 60 + m;
  };

  const openMinutes = timeToMinutes(restaurant.open_time);
  let closeMinutes = timeToMinutes(restaurant.close_time);

  // Handle midnight wrap-around (e.g., Open 6 PM, Close 2 AM)
  // If closing time is less than opening time, it means it closes the next day
  if (closeMinutes <= openMinutes) {
    if (currentMinutes >= openMinutes || currentMinutes <= closeMinutes) {
      return `${formatTo12Hour(restaurant.open_time)} - ${formatTo12Hour(restaurant.close_time)}`;
    }
  } else {
    // Normal same-day hours
    if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
      return `${formatTo12Hour(restaurant.open_time)} - ${formatTo12Hour(restaurant.close_time)}`;
    }
  }

  return 'Closed';
}
export function RestaurantsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const filterEstablishmentId = searchParams.get('e');

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardImageByEstablishmentId, setCardImageByEstablishmentId] = useState({});

useEffect(() => {
  async function fetchRestaurants() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hours')
        .select(`
          hours_id, 
          establishment_id, 
          day_of_week, 
          open_time, 
          close_time, 
          is_open, 
          establishments_with_ratings(
            establishment_id, 
            name, 
            category, 
            building_name,
            address, 
            is_active, 
            average_rating, 
            total_reviews
          )
        `)
        .eq('establishments_with_ratings.is_active', true)
        .eq('day_of_week', CurrentDay);
      if (error) throw error;

      // 1. Flatten the data
      const flattenedData = (data || []).map(row => ({
        ...row,
        ...(row.establishments_with_ratings || {})
      }));

      // 2. Sort the data by name alphabetically
      const activeOnly = flattenedData.filter((row) => row?.is_active === true);

      const sortedData = activeOnly.sort((a, b) => {
        const nameA = a.name?.toLowerCase() || '';
        const nameB = b.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      });

      setRestaurants(sortedData);
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
  }, [cardImageResolveKey]);

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? 'text-white' : 'text-black'}`}>
      {dark ? (
        <>
          <div className="fixed inset-0 -z-10 bg-[#0f1219]" />
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
        </>
      ) : (
        <div className="fixed inset-0 -z-10 bg-white" />
      )}

      <main className="container mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-6 text-3xl font-black tracking-tight sm:mb-10 sm:text-4xl">UMBC Establishments</h1>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#ffbf3e]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:gap-10 lg:grid-cols-2">
            {restaurantsToShow.map((restaurant) => {
              const imageSrc = cardImageByEstablishmentId[String(restaurant.establishment_id)];
              const rating = Number(restaurant.average_rating || 0);

              return (
                <div key={restaurant.establishment_id} className="mx-auto w-full max-w-5xl">
                  <div
                    className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-500 hover:shadow-[0_20px_50px_rgba(255,191,62,0.15)] ${
                      dark ? 'border-white/10 bg-gray-900/50' : 'border-black/5 bg-white'
                    }`}
                  >
                    {/* Image hero (always on top) — entire hero links to the establishment page */}
                    <Link
                      to={`/restaurants/${restaurant.establishment_id}`}
                      aria-label={`Open ${restaurant.name}`}
                      className="relative block aspect-[16/9] w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ffbf3e] sm:aspect-[21/9]"
                    >
                      {imageSrc === undefined ? (
                        <div className={`flex h-full w-full items-center justify-center ${dark ? 'bg-[#111827]' : 'bg-gray-200'}`}>
                          <Loader2 className="h-8 w-8 animate-spin text-[#ffbf3e]/80" />
                        </div>
                      ) : !imageSrc ? (
                        <div className={`h-full w-full ${dark ? 'bg-[#111827]' : 'bg-gray-200'}`} />
                      ) : (
                        <img
                          alt={restaurant.name}
                          src={imageSrc}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      )}
                      {/* Strong gradient at the bottom guarantees legibility on bright/white logos */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

                      {/* Rating chip + name pinned to bottom-left */}
                      <div className="pointer-events-none absolute left-3 right-3 bottom-3 flex flex-col items-start gap-2 sm:left-5 sm:right-5 sm:bottom-5">
                        <div className="flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 backdrop-blur-md">
                          <div className="flex items-center text-[#ffbf3e]">
                            {[...Array(5)].map((_, i) => {
                              const starNumber = i + 1;
                              if (rating >= starNumber) {
                                return <Star key={i} className="h-3.5 w-3.5 fill-current" />;
                              } else if (rating > starNumber - 1 && rating < starNumber) {
                                return <StarHalf key={i} className="h-3.5 w-3.5 fill-current" />;
                              } else {
                                return <Star key={i} className="h-3.5 w-3.5" />;
                              }
                            })}
                          </div>
                          <span className="text-xs font-bold text-white">
                            {rating.toFixed(1)} ({restaurant.total_reviews || 0} reviews)
                          </span>
                        </div>
                        <h2 className="break-words text-2xl font-bold text-white drop-shadow-md sm:text-3xl md:text-4xl [overflow-wrap:anywhere]">
                          {restaurant.name}
                        </h2>
                      </div>
                    </Link>

                    {/* Card body — meta + actions on a normal background so contrast is always good */}
                    <div className={`flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between md:gap-6 ${dark ? 'text-white' : 'text-black'}`}>
                      <Link
                        to={`/restaurants/${restaurant.establishment_id}`}
                        className={`-m-2 flex min-w-0 flex-wrap gap-x-5 gap-y-2 rounded-xl p-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf3e] ${
                          dark ? 'hover:bg-white/5' : 'hover:bg-black/[0.04]'
                        }`}
                        aria-label={`Open ${restaurant.name}`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0 text-[#ffbf3e]" />
                          <span
                            className={
                              getBusinessStatus(restaurant) === 'Closed'
                                ? 'font-bold text-red-500'
                                : dark
                                  ? 'text-white/85'
                                  : 'text-black/80'
                            }
                          >
                            {getBusinessStatus(restaurant)}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-[#ffbf3e]" />
                          <span className={`line-clamp-1 ${dark ? 'text-white/85' : 'text-black/80'}`}>
                            {restaurant.building_name || restaurant.address}
                          </span>
                        </div>
                      </Link>

                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 md:shrink-0 md:flex-col md:gap-2 lg:flex-row lg:gap-3">
                        {isAuthenticated && (
                          <Link
                            to={`/restaurants/${restaurant.establishment_id}/writeareview`}
                            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#ffbf3e] px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] hover:bg-[#ffd15e] active:scale-95 sm:w-auto sm:px-5"
                          >
                            Write a Review
                            <FilePenLine className="h-4 w-4" />
                          </Link>
                        )}
                        <Link
                          to={`/restaurants/${restaurant.establishment_id}`}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 sm:w-auto sm:px-5 ${
                            dark
                              ? 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                              : 'border border-black/10 bg-black text-white hover:bg-black/85'
                          }`}
                        >
                          <span className="truncate">View details</span>
                          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                        </Link>
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
