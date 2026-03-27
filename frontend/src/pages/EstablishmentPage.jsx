import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { 
  Clock, 
  MapPin, 
  ChevronLeft, 
  Star, 
  Loader2, 
  Utensils, 
  Info, 
  FilePenLine 
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from "../contexts/AuthContext";

export function EstablishmentPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const dark = theme === 'dark';

  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);

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

      const match = data.find(item => cleanSlug(item.name) === slug);

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

      {/* Hero Banner Section */}
      <div className="relative h-[45vh] w-full overflow-hidden">
        <img
          alt={establishment.name}
          src={establishment.header_image}
          className="h-full w-full object-cover"
        />
        {/* Overlay Gradient */}
        <div className={`absolute inset-0 bg-gradient-to-t ${dark ? 'from-[#0f1219] via-[#0f1219]/60' : 'from-black/70 via-black/30'} to-transparent`} />
        
        <div className="absolute inset-0 flex flex-col justify-end container mx-auto px-6 pb-12">
          <button 
            onClick={() => navigate(-1)}
            className="absolute top-8 left-6 flex items-center gap-2 text-white/90 hover:text-[#ffbf3e] transition-all bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 group"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back
          </button>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">
              {establishment.name}
            </h1>
            
            <div className="flex flex-wrap gap-4 text-white">
              <div className="flex items-center text-[#ffbf3e]">
                              {[...Array(5)].map((_, i) => {
                                const starNumber = i + 1;
                                const rating = establishment.average_rating || 0;

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
                                <span className="text-xs font-bold text-white">
                              {Number(establishment.average_rating || 0).toFixed(1)}
                            </span>
                            </div>
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <MapPin className="w-5 h-5 text-[#ffbf3e]" />
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
                    to={`/restaurants/${slug}/writeareview`}
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
    </div>
  );
}