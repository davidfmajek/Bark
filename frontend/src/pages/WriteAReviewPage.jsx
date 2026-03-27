import { Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

function cleanSlug(text) {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function WriteAReviewPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { slug: establishmentSlug } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [establishments, setEstablishments] = useState([]);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
      }
      setUser(data.user ?? null);
    }
    loadUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadEstablishments() {
      setLoading(true);
      const { data, error } = await supabase
        .from('establishments')
        .select('establishment_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching establishments:', error);
        if (mounted) setErrorMessage('Unable to load restaurants right now.');
        if (mounted) setLoading(false);
        return;
      }

      const rows = data ?? [];
      if (mounted) {
        setEstablishments(rows);
        setLoading(false);
      }

      if (!mounted || rows.length === 0) return;
      if (establishmentSlug) {
        const matched = rows.find(
          (e) =>
            String(e.establishment_id) === String(establishmentSlug) ||
            cleanSlug(e.name) === cleanSlug(establishmentSlug),
        );
        if (matched) {
          setSelectedEstablishmentId(String(matched.establishment_id));
          return;
        }
      }
      setSelectedEstablishmentId((prev) => prev || String(rows[0].establishment_id));
    }
    loadEstablishments();
    return () => {
      mounted = false;
    };
  }, [establishmentSlug]);

  const selectedEstablishment = useMemo(
    () => establishments.find((e) => String(e.establishment_id) === String(selectedEstablishmentId)) ?? null,
    [establishments, selectedEstablishmentId],
  );

  async function handleSubmitReview() {
    if (!user?.id) {
      setErrorMessage('Please sign in to submit a review.');
      return;
    }
    if (!selectedEstablishmentId) {
      setErrorMessage('Please select a restaurant first.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage('Please choose a rating from 1 to 5 stars.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await supabase.from('reviews').insert({
      user_id: user.id,
      establishment_id: selectedEstablishmentId,
      rating,
      body: reviewText.trim(),
      is_flagged: false,
    });

    if (error) {
      console.error('Error adding review to database:', error);
      setErrorMessage(error.message || 'Unable to submit review right now.');
      setSaving(false);
      return;
    }

    setSuccessMessage(`Review submitted for ${selectedEstablishment?.name ?? 'restaurant'}.`);
    setSaving(false);
    navigate('/my-reviews');
  }

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? 'text-white' : 'text-black'}`}>
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
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold">
            Write a Review{selectedEstablishment ? ` for ${selectedEstablishment.name}` : ''}
          </h1>
          <div className={`mb-6 border-b ${dark ? 'border-white/10' : 'border-black/10'}`} />

          {loading ? (
            <p>Loading restaurants...</p>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitReview();
              }}
            >
              <div>
                <label htmlFor="restaurant-select" className="mb-2 block text-2xl font-bold">
                  Restaurant
                </label>
                <select
                  id="restaurant-select"
                  value={selectedEstablishmentId}
                  onChange={(e) => setSelectedEstablishmentId(e.target.value)}
                  className={`block w-full rounded-md border px-3 py-2 ${
                    dark
                      ? 'border-white/10 bg-[#0f1219] text-white'
                      : 'border-black/15 bg-white text-black'
                  }`}
                >
                  {establishments.map((e) => (
                    <option key={e.establishment_id} value={e.establishment_id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h2 className="mb-2 block text-3xl font-bold">Rating</h2>
                <div className="mt-1 flex items-center gap-1 py-2">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const active = i <= (hover || rating);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(i)}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(0)}
                        className="inline-flex items-center justify-center"
                        aria-label={`Set rating to ${i}`}
                      >
                        <Star
                          className={`h-6 w-6 cursor-pointer transition ${
                            active ? 'fill-[#ffbf3e] text-[#ffbf3e]' : 'fill-transparent text-current opacity-40'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="review" className="mb-3 block text-2xl font-medium">
                  Your Review
                </label>
                <textarea
                  id="review"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={5}
                  className={`block w-full rounded-md border px-3 py-2 ${
                    dark
                      ? 'border-white/10 bg-[#0f1219] text-white placeholder:text-white/50'
                      : 'border-[#ffbf3e] bg-white text-black placeholder:text-black/50'
                  }`}
                  placeholder="Share your experience..."
                />
              </div>

              {errorMessage ? <p className="text-sm font-semibold text-red-500">{errorMessage}</p> : null}
              {successMessage ? <p className="text-sm font-semibold text-green-500">{successMessage}</p> : null}

              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition ${
                    dark
                      ? 'border-white/15 bg-white/5 text-white/90 hover:bg-white/10 disabled:opacity-60'
                      : 'border-black/15 bg-black/5 text-black/80 hover:bg-black/10 disabled:opacity-60'
                  }`}
                >
                  {saving ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}