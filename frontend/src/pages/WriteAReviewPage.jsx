import { Star, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { nameToSlug } from "../lib/utils"; // CRITICAL: This must be the same function used everywhere
import { supabase } from "../lib/supabase";

async function writeReview(uid, estInfo, rating, reviewText, navigate) {
  if (!estInfo) return alert("Please select a restaurant");
  if (rating === 0) return alert("Please select a rating");

  const { error: writeError } = await supabase.from("reviews").insert({
    user_id: uid,
    establishment_id: estInfo.id,
    rating: rating,
    body: reviewText,
    is_flagged: false,
  });

  if (writeError) {
    console.error("Error adding review: ", writeError);
  } else {
    alert(`Review successfully written for ${estInfo.name}`);
    navigate(`/restaurants/${nameToSlug(estInfo.name)}`); // Navigate back using the slug
  }
}

export function WriteAReviewPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { slug } = useParams(); // Switched back to slug
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [establishments, setEstablishments] = useState([]);
  const [selectedEst, setSelectedEst] = useState(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initializePage() {
      try {
        setLoading(true);
        
        const { data: userData } = await supabase.auth.getUser();
        setUser(userData.user);

        const { data: estData, error } = await supabase
          .from("establishments")
          .select("establishment_id, name")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (!error && estData) {
          setEstablishments(estData);
          
          // Match by slugified name to handle "True Grit's" correctly
          if (slug) {
            const match = estData.find(e => nameToSlug(e.name) === slug);
            if (match) {
              setSelectedEst({ id: match.establishment_id, name: match.name });
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }
    initializePage();
  }, [slug]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? "bg-[#0f1219]" : "bg-white"}`}>
        <h1 className={`${dark ? "text-white" : "text-black"} text-2xl font-bold animate-pulse`}>Loading Form...</h1>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? "text-white" : "text-black"}`}>
      <div className={`fixed inset-0 -z-10 ${dark ? "bg-[#0f1219]" : "bg-white"}`} />
      
      <main className="container mx-auto px-10 py-16">
        <div className="max-w-4xl mx-auto backdrop-blur-md border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
          <header className="mb-12">
            <h1 className="text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-[#ffbf3e] to-[#ff9f00] bg-clip-text text-transparent">
              Write a Retriever Review
            </h1>
            <p className="text-lg opacity-60">Share your thoughts on UMBC's dining.</p>
          </header>

          <form className="space-y-10">
            <div className="space-y-4">
              <label className="text-sm font-black uppercase tracking-[0.2em] text-[#ffbf3e] ml-1">Select Establishment</label>
              <div className="relative group">
                <select
                  value={selectedEst?.id || ""}
                  onChange={(e) => {
                    const est = establishments.find(item => item.establishment_id.toString() === e.target.value);
                    setSelectedEst(est ? { id: est.establishment_id, name: est.name } : null);
                  }}
                  className={`w-full appearance-none rounded-2xl border-2 px-6 py-5 pr-12 text-lg font-bold transition-all duration-300 outline-none
                    ${dark 
                      ? "bg-[#1a1f2b] border-white/10 text-white focus:border-[#ffbf3e]" 
                      : "bg-gray-50 border-black/5 text-black focus:border-[#ffbf3e]"
                    }`}
                >
                  <option value="" disabled>Choose a place...</option>
                  {establishments.map((est) => (
                    <option key={est.establishment_id} value={est.establishment_id} className={dark ? "bg-[#1a1f2b]" : "bg-white"}>
                      {est.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[#ffbf3e]">
                  <ChevronDown className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-black uppercase tracking-[0.2em] text-[#ffbf3e] ml-1">Rating</label>
              <div className={`flex items-center gap-4 w-fit p-5 rounded-3xl border ${dark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(0)}
                    className={`w-10 h-10 cursor-pointer transition-all ${
                      i <= (hover || rating) ? "fill-[#ffbf3e] text-[#ffbf3e] scale-125" : "fill-transparent text-gray-400"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-black uppercase tracking-[0.2em] text-[#ffbf3e] ml-1">Your Thoughts</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={6}
                className={`w-full rounded-3xl border-2 p-6 text-lg transition-all outline-none ${
                  dark ? "bg-[#1a1f2b] border-white/10" : "bg-gray-50 border-black/5"
                } focus:border-[#ffbf3e]`}
                placeholder="How was the food?"
              />
            </div>

            <button
              onClick={() => writeReview(user.id, selectedEst, rating, reviewText, navigate)}
              type="button"
              disabled={!selectedEst || rating === 0}
              className="w-full bg-[#ffbf3e] text-black font-black text-xl py-6 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 mt-4"
            >
              Submit Review
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}