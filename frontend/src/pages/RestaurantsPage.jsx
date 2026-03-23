import { Clock, MapPin, ArrowRight, Star, StarHalf } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function RestaurantsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const umbc_address = "1000 Hilltop Cir, Baltimore, MD 21250"

  // Array of UMBC Restaurant Objects
  const restaurants = [
    {
      name: "True Grit's",
      rating: 4.8,
      reviews: 124,
      hours: "7:00 AM - 2:00 PM, 4:00 - 8:00 PM",
      location: <h1>{umbc_address}</h1>,
      image: "restaurantPage/truegrits.jpg", // Ensure path is correct for your build tool
      link: "/true-grits"
    },
    {
      name: "Admin Cafe",
      rating: 4.5,
      reviews: 312,
      hours: "10:00 AM - 7:00 PM",
      location: <h1>Admin Building, 1st floor, {umbc_address}</h1>,
      image: "restaurantPage/admin.png",
      link: "/commons"
    },
    {
      name: "Skylight Room",
      rating: 4.2,
      reviews: 89,
      hours: "M-F 11:00 AM - 1:30 PM",
      location: <h1>The Commons, 3rd floor, {umbc_address}</h1>,
      image: "restaurantPage/skylightroom.jpg",
      link: "/wild-greens"
    },
    {
      name: "Einstein Brother's Bagels",
      rating: 4.2,
      reviews: 89,
      hours: "M-F 9:00 AM - 10:00 PM",
      location: <h1>The AOK Library, 1st floor, {umbc_address}</h1>,
      image: "restaurantPage/einsteinbrothersbagels.png",
      link: "/Einstein-Brothers-Bagels"
    }
  ];

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

      <main className="container mx-auto px-6 py-12">
        <h1 className="text-4xl font-black mb-10 tracking-tight">UMBC Restaurants</h1>
        
        {/* The Grid Container - Switched from max-w-4xl for better layout */}
        <div className="grid grid-cols-2 gap-10">
          {restaurants.map((restaurant, index) => (
            <div key={index} className="max-w-5xl mx-auto w-full">
              <a 
                href={restaurant.link} 
                className={`group relative block overflow-hidden rounded-3xl border transition-all duration-500 hover:shadow-[0_20px_50px_rgba(255,191,62,0.15)] 
                  ${dark ? 'border-white/10 bg-gray-900/50' : 'border-black/5 bg-white'}`}
              >
                {/* Image Section */}
                <div className="aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
                  <img
                    alt={restaurant.name}
                    src={restaurant.image}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Overlay - adjusted to blend better with your dark background */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${dark ? 'from-[#0f1219] via-[#0f1219]/40' : 'from-black/70 via-black/20'} to-transparent`} />
                </div>

                {/* Content Section */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div className="space-y-3">
                      {/* Rating Badge */}
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
                          <span className="text-sm line-clamp-1">{restaurant.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Button Style Link */}
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
      </main>
    </div>
  );
}