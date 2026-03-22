import { Clock, MapPin, ArrowRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function RestaurantsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? 'text-white' : 'text-black'}`}>
      {/* Background Logic */}
      {dark ? (
        <>
          <div className="fixed inset-0 -z-10 bg-[#0f1219]" />
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
          <div className="fixed inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      ) : (
        <>
          <div className="fixed inset-0 -z-10 bg-white" />
          <div className="fixed inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      )}

      {/* Restaurant Section */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <a 
            href="/restaurant-details" 
            className={`group relative block overflow-hidden rounded-3xl border transition-all duration-300 hover:shadow-2xl 
              ${dark ? 'border-white/10 bg-gray-900/50' : 'border-black/5 bg-white'}`}
          >
            {/* Image container with aspect ratio */}
            <div className="aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
              <img
                alt="Cozy Restaurant Interior"
                src="../../public/trueGritRestaurantPage.jpg"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Overlay for text contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </div>

            {/* Content overlaying the image */}
            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white sm:text-4xl mb-3">
                    True Grit's
                  </h2>
                  
                  <div className="flex flex-wrap gap-y-2 gap-x-6 text-gray-200">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#ffbf3e]" />
                      <span className="text-sm font-medium">9:00 AM - 7:00 PM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#ffbf3e]" />
                      <span className="text-sm font-medium">1000 Hilltop Cir, Baltimore, MD 21250</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-[#ffbf3e] px-5 py-2.5 text-black font-bold text-sm transition-transform active:scale-95 group-hover:bg-[#ffd166]">
                  Visit True Grit's
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
