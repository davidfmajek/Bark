import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js'; // Adjust path to your supabase client
import { Clock, MapPin, ArrowRight, Star, StarHalf, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function RestaurantsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  
  // 1. State for your data and loading status
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. Fetch logic
  useEffect(() => {
    async function fetchRestaurants() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('establishments')
          .select(`*`)
          .eq('is_active', true) // Only grab active restaurants
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

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? 'text-white' : 'text-black'}`}>
      {/* Background Logic (remains the same) */}
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
            {restaurants.map((restaurant) => (
              <div key={restaurant.establishment_id} className="max-w-5xl mx-auto w-full">
                <a 
                  href={restaurant.name} 
                  className={`group relative block overflow-hidden rounded-3xl border transition-all duration-500 hover:shadow-[0_20px_50px_rgba(255,191,62,0.15)] 
                    ${dark ? 'border-white/10 bg-gray-900/50' : 'border-black/5 bg-white'}`}
                >
                  {/* Image Section */}
                  <div className="aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
                    <img
                      alt={restaurant.name}
                      src={`restaurantPage/${restaurant.establishment_id}.png`} // Ensure this is a full URL or correct path
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${dark ? 'from-[#0f1219] via-[#0f1219]/40' : 'from-black/70 via-black/20'} to-transparent`} />
                  </div>

                  {/* Content Section */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md w-fit px-3 py-1 rounded-full border border-white/10">
                          <div className="flex items-center text-[#ffbf3e]">
                            {[...Array(4)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-current" />
                            ))}
                            <StarHalf className="w-3.5 h-3.5 fill-current" />
                          </div>
                          <span className="text-xs font-bold text-white">
                            {restaurant.rating} ({restaurant.reviews} reviews)
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
                            {/* Removed <h1> from data; handle as simple text here */}
                            <span className="text-sm line-clamp-1">{restaurant.building_name == null ? restaurant.address : restaurant.building_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-xl bg-[#ffbf3e] px-6 py-3 text-black font-bold transition-all group-hover:bg-white group-hover:scale-105 active:scale-95 whitespace-nowrap">
                        To {restaurant.name} 
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}