import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { nameToSlug } from "../lib/utils";
import { supabase } from "../lib/supabase";

async function writeReview(uid, eid, rating, reviewText) {
  const { writeData, writeError } = await supabase.from("reviews").insert({
    user_id: uid,
    establishment_id: eid,
    rating: rating,
    body: reviewText,
    is_flagged: false,
  });
  if (writeError) {
    console.error("Error adding review to database: ", writeError);
  } else {
    console.log("Review successfully added: ", writeData);
  }
}

export function WriteAReviewPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { slug } = useParams();
  const [user, setUser] = useState(null);
  const [Establishment, setEstablishment] = useState(null);
  const [Rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [ReviewText, setReviewText] = useState("");

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user: ", error);
      }
      setUser(data.user);
    }
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(event == "SIGNED_IN" ? session.user : null);
      },
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function getEstablishment() {
      const { data, error } = await supabase
        .from("establishments")
        .select("establishment_id, name")
        .eq("is_active", true);
      if (error || data == null) {
        console.error("Error fetching establishment: ", (error ?? ""));
      };
      const establishment = data.find((e) => nameToSlug(e.name) == slug);
      if (mounted && establishment)
        setEstablishment({
          id: establishment.establishment_id,
          name: establishment.name,
        });
    }

    getEstablishment();
    return () => {
      mounted = false;
    };
  }, []);

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
          <h1 className="text-3xl font-bold mb-6">
            Write a Review for {Establishment?.name}
          </h1>
          <div className="border-b mb-6" />
          {/* Form fields for writing a review would go here */}
          <form className="space-y-4">
            <div>
              <h2 htmlFor="rating" className="block text-3xl font-bold mb-2">
                Rating
              </h2>
              <div className="mt-1 flex items-center gap-1 py-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    type="button"
                    onClick={() => {
                      setRating(i);
                    }}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(0)}
                    key={i}
                    className={`w-6 h-6 cursor-pointer transition ${
                      i <= Rating
                        ? "fill-[#ffbf3e]"
                        : "fill-transparent" && i <= hover
                          ? "fill-[#ffbf3e]/40"
                          : "fill-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div>
              <h2 htmlFor="review" className="block text-2xl font-medium mb-3">
                Your Review
              </h2>
              <textarea
                id="review"
                value={ReviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={4}
                className={`mt-1 block w-full rounded-md border ${
                  dark
                    ? "border-white/10 bg-[#0f1219] text-white placeholder:text-white/50"
                    : "border-[#ffbf3e] bg-white text-black placeholder:text-black/50"
                } `}
                placeholder="Share your experience..."
              />
            </div>
            <div>
              <button
                onClick={() =>
                  writeReview(user.id, Establishment.id, Rating, ReviewText)
                }
                type="submit"
                className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition ${
                  dark
                    ? "border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
                    : "border-black/15 bg-black/5 text-black/80 hover:bg-black/10"
                }`}
              >
                Submit Review
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
