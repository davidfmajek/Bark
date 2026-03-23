import React from "react";
import { Clock, MapPin, ArrowRight, Star, StarHalf, FilePenLine, } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { nameToSlug } from "../lib/utils";

export function RestaurantsPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { isAuthenticated } = useAuth();

  // Mock data - in a real app, this would come from props or an API
  const TrueGrits = {
    name: "True Grit's",
    slug: nameToSlug("True Grit's"),
    rating: 4.8,
    reviews: 124,
    hours: "7:00 AM - 2:00 pm, 4:00 - 8:00 pm",
    location: "1000 Hilltop Cir, Baltimore, MD 21250",
    image: "../../public/trueGritRestaurantPage.jpg",
  };

  return (
    <div
      className={`min-h-[calc(100vh-3.5rem)] ${dark ? "text-white" : "text-black"}`}
    >
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
        <div className="max-w-4xl mx-auto">
          <div
            className={`group relative block overflow-hidden rounded-3xl border transition-all duration-500 hover:shadow-[0_20px_50px_rgba(255,191,62,0.15)] 
              ${dark ? "border-white/10 bg-gray-900/50" : "border-black/5 bg-white"}`}
          >
            {/* Image Section */}
            <div className="aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
              <img
                alt={TrueGrits.name}
                src={TrueGrits.image}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1219] via-[#0f1219]/40 to-transparent" />
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
                      {TrueGrits.rating} ({TrueGrits.reviews} reviews)
                    </span>
                  </div>

                  <h2 className="text-3xl font-bold text-white sm:text-4xl">
                    {TrueGrits.name}
                  </h2>

                  <div className="flex flex-wrap gap-y-2 gap-x-6 text-gray-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#ffbf3e]" />
                      <span className="text-sm">{TrueGrits.hours}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#ffbf3e]" />
                      <span className="text-sm">{TrueGrits.location}</span>
                    </div>
                  </div>
                </div>

                {/* Button Style Links */}
                <div className="flex flex-col gap-2">
                  {isAuthenticated == true && (
                    <a
                      href={`/restaurants/${TrueGrits.slug}/writeareview`}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#ffbf3e] px-6 py-3 text-black font-bold transition-all hover:bg-white hover:scale-105 active:scale-100"
                    >
                      Write a Review
                      <FilePenLine className="w-5 h-5" />
                    </a>
                  )}
                  <a
                    href="/restaurant-details"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ffbf3e] px-8 py-3 text-black font-bold transition-all hover:bg-white hover:scale-105 active:scale-100"
                  >
                    To {TrueGrits.name}
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
