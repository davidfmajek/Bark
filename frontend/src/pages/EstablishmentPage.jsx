import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import {
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Star,
  Loader2,
  Utensils,
  Info,
  FilePenLine,
  Images,
  X,
  ThumbsUp,
  Trash2,
  Pen,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from "../contexts/AuthContext";
import { fetchEstablishmentGalleryUrls, resolveReviewImageForDisplay } from '../lib/restaurantImages.js';
import { formatRelativeReviewTime, formatTo12Hour } from '../lib/utils.js';



const StarFilter = ({ value, onChange, dark }) => {
  return (
    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1.5 px-3 rounded-full">
      {/* "All" button to reset the filter */}
      <button
        onClick={() => onChange('all')}
        className={`text-xs font-bold mr-2 uppercase transition-colors ${
          value === 'all' 
            ? (dark ? 'text-white' : 'text-black') 
            : 'text-gray-400 hover:text-gray-500'
        }`}
      >
        All
      </button>

      {/* The Stars */}
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            onClick={() => onChange(num)}
            className="transition-transform active:scale-90"
          >
            <span className={`text-xl ${
              // If current star is less than or equal to selection, highlight it
              value !== 'all' && num <= value 
                ? 'text-yellow-400' 
                : 'text-gray-300 dark:text-gray-600'
            }`}>
              ★
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
const CustomDropdown = ({ label, value, options, onChange, dark, colorClass }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 font-bold text-sm focus:outline-none transition-opacity hover:opacity-80 ${colorClass}`}
      >
        {selectedOption?.label || label}
        <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute z-50 mt-2 min-w-[140px] rounded-xl shadow-2xl overflow-hidden border ${
          dark 
            ? 'bg-[#161b26] border-white/10 text-white' 
            : 'bg-white border-black/5 text-gray-700'
        }`}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                dark ? 'hover:bg-blue-800' : 'hover:bg-gray-100'
              } ${value === opt.value ? (dark ? 'bg-blue-900' : 'bg-gray-50') : ''}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function Stars({ rating, dark }) {
  const safeRating = Number.isFinite(rating) ? rating : 0;
  const rounded = Math.round(safeRating * 10) / 10;
  const filledCount = Math.max(0, Math.min(5, Math.round(safeRating)));

  return (
    <div className={`flex items-center gap-1 ${dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}`}>
      <div className="flex items-center gap-0.5" aria-label={`Rating: ${rounded} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < filledCount;
          return (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 ${filled ? 'opacity-100' : 'opacity-25'}`}
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73 1.64 7.03z" />
            </svg>
          );
        })}
      </div>
      <span className={`ml-1 text-xs font-semibold ${dark ? 'text-[#f5bf3e]' : 'text-[#D4A017]'}`}>
        {rounded}
      </span>
    </div>
  );
}
// Add this near your other functions (above the return)

function buildCollagePanels(allUrls, offset) {
  const u = allUrls.filter(Boolean);
  //console.log(`UrlArray Length: ${u.length}`);
  /*
  if (u.length === 0) {
    return { panels: [null, null, null], photoCount: 0, galleryMaxOffset: 0 };
  }
  if (u.length === 1) {
    return {
      panels: [
        { src: u[0], objectPosition: 'left center' },
        { src: u[0], objectPosition: 'center center' },
        { src: u[0], objectPosition: 'right center' },
      ],
      photoCount: 1,
      galleryMaxOffset: 0,
    };
  }
  if (u.length === 2) {
    return {
      panels: [
        { src: u[0], objectPosition: 'center' },
        { src: u[1], objectPosition: 'center' },
        { src: u[0], objectPosition: 'center' },
      ],
      photoCount: 2,
      galleryMaxOffset: 0,
    };
  }
  const len = u.length;
  const maxO = Math.max(0, len - 3);
  const o = Math.min(Math.max(0, offset), maxO);
  return {
    panels: [0, 1, 2].map((i) => ({
      src: u[o + i],
      objectPosition: 'center',
    })),
    photoCount: len,
    galleryMaxOffset: maxO,
  };
  */
  const len = u.length;
  const max0 = Math.max(0, len - 3);
  const o = Math.min(Math.max(0, offset), max0);

  return {
    panels: [0, 1, 2].map((i) => ({
      src: u[o + i],
      objectPosition: "center",
    })),
    photoCount: len,
    galleryMaxOffset: max0,
  };
}

function CollageCell({ panel, index, panelBroken, setPanelBroken, dark, className }) {
  const broken = panelBroken[index];
  //console.log(`broken: ${broken}`);
  return (
    <>
      {/*panel && !broken ? (*/}
      {panel ? (
        <img
          alt=""
          src={panel.src}
          className={`w-full object-cover ${className}`}
          style={{ objectPosition: panel.objectPosition || 'center' }}
          onError={() =>
            setPanelBroken((prev) => {
              const next = [...prev];
              next[index] = true;
              return next;
            })
          }
        />
      ) : (
        <div
          className={`flex w-full items-center justify-center ${className} ${
            dark ? 'bg-[#1a1f2e]' : 'bg-gray-200'
          }`}
        >
          <Utensils className={`h-10 w-10 ${dark ? 'text-white/15' : 'text-black/10'}`} />
        </div>
      )}
    </>
  );
}

function getDisplayName(user) {
  const name = user?.display_name;
  if (name && String(name).trim()) return String(name).trim();
  const email = user?.email ?? '';
  const emailName = String(email).split('@')[0]?.trim();
  if (emailName) return emailName;
  return 'User';
}

function getInitials(displayName) {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (displayName.slice(0, 2) || 'U').toUpperCase();
}

function getAvatarUrl(user) {
  const candidate = user?.avatar_url;
  if (!candidate) return '';
  const trimmed = String(candidate).trim();
  return trimmed || '';
}

function getAffiliation(user) {
  const value = user?.affiliation;
  if (!value) return '';
  const trimmed = String(value).trim();
  return trimmed || '';
}

export function EstablishmentPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const dark = theme === 'dark';
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [establishment, setEstablishment] = useState(null);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [likeButton, setLikeButton] = useState([]);
  const [loading, setLoading] = useState(true);
  const [galleryOffset, setGalleryOffset] = useState(0);
  const [panelBroken, setPanelBroken] = useState([false, false, false]);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [hours, setHours] = useState([]);
  const [filterStar, setFilterStar] = useState('all');
const [filterTime, setFilterTime] = useState('all');
const [sortType, setSortType] = useState('recency-desc'); // Default: Newest first
  /** @type {Record<string, { src: string; key: string }[]>} */
  const [reviewPhotosByReviewId, setReviewPhotosByReviewId] = useState({});
  /** @type {{ review: object; photos: { src: string; key: string }[]; index: number } | null} */
  const [reviewPhotoLightbox, setReviewPhotoLightbox] = useState(null);
  const [brokenAvatars, setBrokenAvatars] = useState({});
  const [editRating, setEditRating] = useState(0);
  const { panels, photoCount, galleryMaxOffset } = useMemo(
    () => buildCollagePanels(galleryUrls, galleryOffset),
    [galleryUrls, galleryOffset, reviewPhotosByReviewId],
  );
  const handleUpdateReview = async (reviewId) => {
  if (!editBuffer.trim()) return;

  try {
    const { error } = await supabase
      .from('reviews')
      .update({ 
        body: editBuffer, 
        rating: editRating, // Send the new star count
        updated_at: new Date().toISOString() 
      })
      .eq('review_id', reviewId);

    if (error) throw error;

    // Update the local state so the UI updates the stars and text immediately
    setReviews(prev => prev.map(r => 
      r.review_id === reviewId ? { ...r, body: editBuffer, rating: editRating } : r
    ));

    setEditingReviewId(null);
  } catch (error) {
    console.error("Error:", error.message);
  }
};
const handleDeleteReview = async (reviewId) => {
  const confirmed = window.confirm("Are you sure? This will permanently delete the review and all photos.");
  if (!confirmed) return;

  try {
    // 1. List all files in the specific folder for this review
    const folderPath = `review-images/${reviewId}`;
    const { data: files, error: listError } = await supabase
      .storage
      .from('review-media')
      .list(folderPath);

    if (listError) throw listError;

    // 2. If there are photos, delete them from the bucket
    if (files && files.length > 0) {
      const filesToDelete = files.map((file) => `${folderPath}/${file.name}`);
      const { error: deleteStorageError } = await supabase
        .storage
        .from('review-media')
        .remove(filesToDelete);

      if (deleteStorageError) throw deleteStorageError;
      console.log("Deleted photos from storage");
    }

    // 3. Delete the review row from the database
    const { error: dbError } = await supabase
      .from('reviews')
      .delete()
      .eq('review_id', reviewId);

    if (dbError) throw dbError;

    // 4. Update UI: Remove the review from the local state
    setReviews(prev => prev.filter(r => r.review_id !== reviewId));
    
    alert("Review and associated images deleted successfully.");
  } catch (error) {
    console.error("Deletion failed:", error.message);
    alert("Error during deletion: " + error.message);
  }
};
  useEffect(() => {
    if (!establishment) return;
    let cancelled = false;
    setGalleryLoading(true);
    setGalleryUrls([]);
    (async () => {
      const urls = await fetchEstablishmentGalleryUrls(supabase, establishment);
      // add review pictures to galleryUrls
      for (const value of Object.values(reviewPhotosByReviewId)) {
        for (const v of value) {
          urls.push(v.src);
        }
        //console.log(JSON.stringify(value, null, "\t"));
      }
      
      //const urls = await fetchEstablishmentGalleryUrls(supabase, establishment);
      //console.log(urls);
      if (!cancelled) {
        setGalleryUrls(urls);
        setGalleryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [establishment?.establishment_id, Object.values(reviewPhotosByReviewId).length]);

  useEffect(() => {
    setGalleryOffset(0);
    setPanelBroken([false, false, false]);
  }, [establishment?.establishment_id, galleryUrls.join('|')]);

  useEffect(() => {
    setGalleryOffset((prev) => Math.min(prev, galleryMaxOffset));
  }, [galleryMaxOffset]);

  useEffect(() => {
    setPanelBroken([false, false, false]);
  }, [galleryOffset]);

  useEffect(() => {
    if (!galleryModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setGalleryModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [galleryModalOpen]);

  const reviewLightboxOpen = reviewPhotoLightbox != null;
  useEffect(() => {
    if (!reviewLightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setReviewPhotoLightbox(null);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setReviewPhotoLightbox((lb) => {
          if (!lb || lb.photos.length <= 1) return lb;
          const delta = e.key === 'ArrowLeft' ? -1 : 1;
          return {
            ...lb,
            index: (lb.index + delta + lb.photos.length) % lb.photos.length,
          };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [reviewLightboxOpen]);

  useEffect(() => {
  async function fetchData() { // Renamed to fetchData to be more descriptive
    try {
      setLoading(true);

      // 1. Fetch all active establishments
      const { data, error } = await supabase
        .from('establishments_with_ratings')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      const cleanSlug = (text) => 
        text
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-]/g, '');

      // 2. Find the specific establishment matching the slug
      const match = data.find(
        (item) =>
          String(item.establishment_id) === String(slug) ||
          cleanSlug(item.name) === slug,
      );

      if (match) {
        setEstablishment(match);

        // --- NEW LOGIC STARTS HERE ---
        // 3. Fetch the hours for this specific establishment
        const { data: hoursData, error: hoursError } = await supabase
          .from('hours') // Replace with 'establishment_hours' if that's your table name
          .select('*')
          .eq('establishment_id', match.establishment_id)
          .order('day_of_week', { ascending: true });

        if (hoursError) throw hoursError;

        setHours(hoursData || []); 
        // --- NEW LOGIC ENDS HERE ---
      }
      
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (slug) {
    fetchData();
  }
}, [slug]);

  useEffect(() => {
  async function fetchReviews() {
      if (!establishment) return;
      try {
          setLoading(true);
          const { data, error } = await supabase
              .from("reviews")
              .select("*")
              .eq("establishment_id", establishment.establishment_id);
          if (error) throw error;
          setReviews(data);
      } catch (error) {
          console.error('Error fetching reviews:', error.message);
      }
      finally {
          setLoading(false);
      }
  }
  fetchReviews();
  }, [establishment?.establishment_id]);

  useEffect(() => {
    async function fetchUsers() {
        if (reviews.length === 0) return;
        try {
            setLoading(true);
          let { data, error } = await supabase
            .from("users")
            .select("user_id, display_name, email, avatar_url, affiliation")
            .in("user_id", reviews.map((r) => r.user_id));
          if (error && String(error.message || '').toLowerCase().includes('avatar_url')) {
            const fallback = await supabase
              .from("users")
              .select("user_id, display_name, email, affiliation")
              .in("user_id", reviews.map((r) => r.user_id));
            data = (fallback.data ?? []).map((u) => ({ ...u, avatar_url: '' }));
            error = fallback.error;
          }
          if (error) throw error;
          setUsers(data);
        }
        catch (error) {
            console.error('Error fetching users:', error.message);
        }
        finally {
            setLoading(false);
        }
    }
    fetchUsers();
    //this has to be reviews.length or else it will flicker a loading screen
  }, [establishment?.establishment_id, reviews.length]);

  useEffect(() => {
    if (reviews.length === 0) {
      setReviewPhotosByReviewId({});
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = reviews.map((r) => r.review_id).filter(Boolean);
      const { data, error } = await supabase
        .from('review_images')
        .select('image_id, review_id, storage_url, display_order')
        .in('review_id', ids);
      if (cancelled) return;
      if (error) {
        console.error('Error fetching review images:', error.message);
        setReviewPhotosByReviewId({});
        return;
      }
      const grouped = new Map();
      for (const row of data ?? []) {
        const rid = String(row.review_id);
        if (!grouped.has(rid)) grouped.set(rid, []);
        grouped.get(rid).push(row);
      }
      const next = {};
      for (const [rid, rows] of grouped) {
        rows.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        const photos = [];
        for (const r of rows) {
          const src = await resolveReviewImageForDisplay(supabase, r.storage_url);
          photos.push({
            src,
            key: String(r.image_id ?? `${rid}-${r.display_order}`),
          });
        }
        next[rid] = photos.filter((p) => p.src);
      }
      setReviewPhotosByReviewId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [reviews]);
  useEffect(() => {
    async function fetchHelpfulVotes() {
      if (reviews.length > 0) {
        try {
          setLoading(true);
          const ids = reviews.map((r) => r.review_id).filter(Boolean);
          const { data, error } = await supabase
            .from("helpful_votes")
            .select("review_id, user_id")
            .in("review_id", ids)
            //.eq("user_id", user.id);
          if (error) {
            console.error("Error fetching helpful votes: ", error.message);
            setLikeButton(new Array(reviews.length).fill(false));
            return;
          }
          const likeToggles = new Array(reviews.length).fill(false);
          likeToggles.forEach((_, idx) => {
            const reviewID = reviews[idx].review_id;
            likeToggles[idx] = data.some((like) => { 
	          return like.review_id == reviewID && like.user_id == user.id;
	        })
	      return likeToggles[idx];
        });

          setLikeButton(likeToggles);
        }
        catch (error) {
          console.error("Error fetching helpful votes: ", error.message);
        }
        finally {
          setLoading(false);
        }
      }
    }
    
    fetchHelpfulVotes();
  }, [establishment?.establishment_id, reviews.length]);
  
  /*
  useEffect(() => {
    console.log("reviews changed:", reviews);
  }, [reviews.length]);

  useEffect(() => {
    console.log("likeButton state changed:", likeButton);
  }, [likeButton]);
  */

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
  const processedReviews = reviews
  .filter(review => {
    // Filter by Star Level
    if (filterStar !== 'all' && review.rating !== parseInt(filterStar)) return false;

    // Filter by Time Posted
    if (filterTime !== 'all') {
      const reviewDate = new Date(review.created_at);
      const now = new Date();
      const diffInDays = (now - reviewDate) / (1000 * 60 * 60 * 24);

      if (filterTime === 'week' && diffInDays > 7) return false;
      if (filterTime === 'month' && diffInDays > 30) return false;
      if (filterTime === 'year' && diffInDays > 365) return false;
    }
    return true;
  })
  .sort((a, b) => {
    // Sorting Logic
    if (sortType === 'star-asc') return a.rating - b.rating;
    if (sortType === 'star-desc') return b.rating - a.rating;
    if (sortType === 'recency-asc') return new Date(a.created_at) - new Date(b.created_at);
    if (sortType === 'recency-desc') return new Date(b.created_at) - new Date(a.created_at);
    if (sortType === 'likes-asc') return (a.helpful_count || 0) - (b.helpful_count || 0);
    if (sortType === 'likes-desc') return (b.helpful_count || 0) - (a.helpful_count || 0);
    return 0;
  });
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

      {/* Photo strip — Yelp-style 3-up collage (URLs resolved from bucket) */}
      <div className="relative w-full overflow-hidden">
        <div className="relative">
          <div className="flex flex-col sm:grid sm:h-[min(52vh,520px)] sm:grid-cols-3 sm:gap-0">
            <div className="relative h-[min(42vh,320px)] w-full overflow-hidden sm:h-full">
              <CollageCell
                panel={panels[0]}
                index={0}
                panelBroken={panelBroken}
                setPanelBroken={setPanelBroken}
                dark={dark}
                className="min-h-[140px] h-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-0 sm:contents">
              <div className="relative h-36 overflow-hidden sm:h-full">
                <CollageCell
                  panel={panels[1]}
                  index={1}
                  panelBroken={panelBroken}
                  setPanelBroken={setPanelBroken}
                  dark={dark}
                  className="h-full min-h-[9rem]"
                />
              </div>
              <div className="relative h-36 overflow-hidden sm:h-full">
                <CollageCell
                  panel={panels[2]}
                  index={2}
                  panelBroken={panelBroken}
                  setPanelBroken={setPanelBroken}
                  dark={dark}
                  className="h-full min-h-[9rem]"
                />heroesData?.publicUrl
              </div>
            </div>
          </div>
          {galleryLoading && (
            <div className="absolute inset-0 z-[25] flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
              <Loader2 className="h-10 w-10 animate-spin text-[#ffbf3e]" aria-label="Loading photos" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-white/90 backdrop-blur-md transition-all hover:bg-black/50 hover:text-[#ffbf3e] sm:left-6 sm:top-6"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {!galleryLoading && photoCount > 3 && galleryMaxOffset > 0 && (
          <>
            <button
              type="button"
              aria-label="Previous photos"
              aria-disabled={galleryOffset <= 0}
              disabled={galleryOffset <= 0}
              className="absolute left-2 top-[42%] z-20 flex -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60 disabled:pointer-events-none disabled:opacity-35 sm:top-1/2 sm:p-2.5"
              onClick={() => setGalleryOffset((o) => Math.max(0, o - 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photos"
              aria-disabled={galleryOffset >= galleryMaxOffset}
              disabled={galleryOffset >= galleryMaxOffset}
              className="absolute right-2 top-[42%] z-20 flex -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60 disabled:pointer-events-none disabled:opacity-35 sm:top-1/2 sm:p-2.5"
              onClick={() => setGalleryOffset((o) => Math.min(galleryMaxOffset, o + 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {!galleryLoading && photoCount >= 1 && (
          <div className="absolute bottom-4 right-4 z-20 sm:bottom-5 sm:right-6">
            <button
              type="button"
              onClick={() => setGalleryModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1a1a1a]/90 px-4 py-2 text-sm font-semibold text-white/95 shadow-lg backdrop-blur-md transition hover:bg-black/90 hover:ring-1 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf3e]"
              aria-label={`View all ${photoCount} photos`}
            >
              <Images className="h-4 w-4 shrink-0" aria-hidden />
              {photoCount === 1 ? '1 photo' : `${photoCount} photos`}
            </button>
          </div>
        )}

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[min(55%,280px)] bg-gradient-to-t to-transparent ${
            dark ? 'from-[#0f1219] via-[#0f1219]/55' : 'from-black/85 via-black/40'
          }`}
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end px-6 pb-10 sm:container sm:mx-auto sm:px-6 sm:pb-12">
          <div className="pointer-events-auto space-y-4">
            <h1 className="font-display text-4xl font-black tracking-tight text-white drop-shadow-sm sm:text-5xl md:text-7xl">
              {establishment.name}
            </h1>
            <div className="flex flex-wrap gap-3 text-white">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-4 py-2 backdrop-blur-md">
                <Star className="h-5 w-5 fill-[#ffbf3e] text-[#ffbf3e]" />
                <span className="text-lg font-bold">
                  {Number(establishment.average_rating ?? establishment.rating ?? 0).toFixed(1)}
                </span>
                <span className="text-sm opacity-80">
                  ({establishment.total_reviews ?? establishment.reviews ?? reviews.length ?? 0} reviews)
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-4 py-2 backdrop-blur-md">
                <MapPin className="h-5 w-5 text-[#ffbf3e]" />
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
                    to={`/restaurants/${establishment.establishment_id}/writeareview`}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ffbf3e] px-6 py-3 text-black font-bold transition-all hover:bg-white hover:scale-105 active:scale-95"
                  >
                    <FilePenLine className="w-5 h-5" />
                    Write a Review
                  </Link>
                )}
              </div>

              {/* Empty State Placeholder */}
              {/* Filters Container */}
<div className="flex items-center justify-between w-full">  
  {/* Star Filter */}
  <div className="flex items-center gap-2">
  <StarFilter 
      value={filterStar} 
      onChange={setFilterStar} 
      dark={dark} 
    />

  {/* Time Filter */}
  <CustomDropdown
    value={filterTime}
    onChange={setFilterTime}
    dark={dark}
    colorClass={dark ? 'text-white' : 'text-gray-700'}
    options={[
      { value: 'all', label: 'Anytime' },
      { value: 'week', label: 'Past Week' },
      { value: 'month', label: 'Past Month' },
      { value: 'year', label: 'Past Year' },
    ]}
  />
</div>
  {/* Sort Order */}
  <div className="flex items-center gap-2">
    <span className="text-xs font-bold uppercase opacity-50">Sort By:</span>
    <CustomDropdown
      value={sortType}
      onChange={setSortType}
      dark={dark}
      colorClass={dark ? 'text-[#ffbf3e]' : 'text-orange-600'}
      options={[
        { value: 'recency-desc', label: 'Newest First' },
        { value: 'recency-asc', label: 'Oldest First' },
        { value: 'star-desc', label: 'Highest Rated' },
        { value: 'star-asc', label: 'Lowest Rated' },
        { value: 'likes-desc', label: 'Most Helpful' },
        { value: 'likes-asc', label: 'Least Helpful' },
      ]}
    />
  </div>
</div>
              {processedReviews.length === 0 && (
                <div className={`p-16 rounded-[2rem] border-2 border-dashed ${dark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-gray-50'} text-center`}>
                <p className="text-lg opacity-40">No reviews have been posted yet. Be the first to share your thoughts!</p>
                </div>
              )}
              
              {reviews.length > 0 && (
                <div className="space-y-6">
                  {processedReviews.map((review, reviewIdx) => (
                    <div key={review.review_id} className={`p-6 rounded-xl ${dark ? 'bg-gray-900/40' : 'bg-gray-100'} relative`}>
                      {/* Author Actions: Positioned in top right */}
                      
{isAuthenticated && user?.id === review.user_id && (
  <div className="absolute top-6 right-6 flex gap-3">
    {/* Edit Button - Now a button instead of a Link */}
<button
  onClick={() => {
    setEditingReviewId(review.review_id);
    setEditBuffer(review.body);
    setEditRating(review.rating); // Pre-fill the textarea with current text
  }}
  className={`p-2 rounded-lg transition-colors ${
    dark ? 'hover:bg-white/5 text-gray-500 hover:text-[#ffbf3e]' : 'hover:bg-black/5 text-gray-400 hover:text-[#ffbf3e]'
  }`}
>
  <Pen className="w-5 h-5" />
</button>

    {/* Delete Button */}
    <button
      onClick={() => handleDeleteReview(review.review_id)}
      className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-white/5 text-gray-500 hover:text-red-500' : 'hover:bg-black/5 text-gray-400 hover:text-red-500'}`}
      title="Delete Review"
    >
      <Trash2 className="w-5 h-5" />
    </button>
  </div>
)}
                      {(() => {
                        const reviewUser = users.find((u) => u.user_id === review.user_id);
                        const rating = review.rating;
                        const displayName = getDisplayName(reviewUser);
                        const avatarUrl = getAvatarUrl(reviewUser);
                        const affiliation = getAffiliation(reviewUser);
                        const avatarBroken = brokenAvatars[String(review.user_id)] === true;
                        
                        return (
                          
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 overflow-hidden rounded-full bg-[#ffbf3e] ring-1 ring-white/15 flex items-center justify-center text-white font-bold">
                          {avatarUrl && !avatarBroken ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              className="h-full w-full rounded-full object-cover"
                              loading="lazy"
                              onError={() =>
                                setBrokenAvatars((prev) => ({
                                  ...prev,
                                  [String(review.user_id)]: true,
                                }))
                              }
                            />
                          ) : (
                            getInitials(displayName) 
                          )}
                        </div>
                        
                        <div>
                          <h4 className="font-bold leading-tight">{displayName}</h4>
                          {affiliation && (
                            <p className={`text-xs font-semibold leading-tight ${dark ? 'text-white/75' : 'text-black/65'}`}>
                              {affiliation}
                            </p>
                          )}
                          <Stars rating={rating} dark={dark} />
                          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatRelativeReviewTime(review.updated_at)}
                          </p>
                          
                        </div>
                      </div>
                        );
                      })()}
                     {editingReviewId === review.review_id ? (
  <div className="space-y-4 mt-2">
    {/* Star Selection Row */}
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setEditRating(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${
              star <= editRating 
                ? 'fill-[#ffbf3e] text-[#ffbf3e]' 
                : 'text-gray-400'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm font-bold opacity-70">
        {editRating} / 5
      </span>
    </div>
    <textarea
      className={`w-full p-4 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#ffbf3e] ${
        dark 
          ? 'bg-gray-800 border-white/10 text-white placeholder-gray-500' 
          : 'bg-white border-black/10 text-gray-900'
      }`}
      rows="4"
      value={editBuffer}
      onChange={(e) => setEditBuffer(e.target.value)}
      placeholder="Edit your review..."

    />
    
    <div className="flex gap-3">
      {/* THIS IS THE SAVE BUTTON */}
      <button
        type="button"
        onClick={() => handleUpdateReview(review.review_id)}
        className="inline-flex items-center justify-center rounded-xl bg-[#ffbf3e] px-5 py-2.5 text-sm font-bold text-black transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#ffbf3e]/20"
      >
        Save Changes
      </button>

      {/* CANCEL BUTTON */}
      <button
        type="button"
        onClick={() => setEditingReviewId(null)}
        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-opacity-80 ${
          dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'
        }`}
      >
        Cancel
      </button>
    </div>
  </div>
) : (
  /* This is your normal review text display */
  <p className={`leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
    {review.body}
  </p>
)}
                      {(() => {
                        const photos = reviewPhotosByReviewId[String(review.review_id)] ?? [];
                        if (photos.length === 0) return null;
                        return (
                          <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
                            {photos.map((p, photoIdx) => (
                              <button
                                key={p.key}
                                type="button"
                                className="block overflow-hidden rounded-lg ring-1 ring-black/10 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf3e] dark:ring-white/10"
                                onClick={() =>
                                  setReviewPhotoLightbox({ review, photos, index: photoIdx })
                                }
                              >
                                <img
                                  src={p.src}
                                  alt=""
                                  className="aspect-square w-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    <button 
                      type="button"
                      onClick={async () => {
                        const isLiked = likeButton[reviewIdx];
                        const newButtons = likeButton.map((b, bIdx) => bIdx === reviewIdx ? !b : b);
                        setLikeButton(newButtons);

                        setReviews(prevReviews => {
                          return prevReviews.map((r, rIdx) => {
                            if (rIdx == reviewIdx) {
                              return {
                                ...r,
                                helpful_count: isLiked ? Number(r.helpful_count) - 1 : Number(r.helpful_count) + 1
                              };
                            }
                            else {
                              return r;
                            }
                          });
                        });

                        try {
                          if (isLiked == true) {
                            // delete the like from helpful_votes table if the current user has liked this post already
                            await supabase
                              .from("helpful_votes")
                              .delete()
                              .eq("review_id", review.review_id)
                              .eq("user_id", user.id)
                            // update the like counter in the reviews table
                            await supabase
                              .from("reviews")
                              .update({ helpful_count: Number(review.helpful_count) - 1 })
                              .eq("review_id", review.review_id)
                          } else {
                            // create a row in the helpful_votes table to show that the current user has liked this review
                            await supabase
                              .from("helpful_votes")
                              .insert({
                                  review_id: review.review_id,
                                  user_id: user.id
                              })
                            // update like counter in reviews table
                            await supabase
                              .from("reviews")
                              .update({ helpful_count: Number(review.helpful_count) + 1 })
                              .eq("review_id", review.review_id)
                          }
                        }
                        catch (error) {
                          console.error("Error updating like status:", error.message);
                        }
                      }} 
                      className={`flex items-center justify-center rounded-lg ${likeButton[reviewIdx] == true ? 'text-[#ffbf3e] hover:text-[#d08e0f]' : 'text-gray-400 hover:text-gray-500'} transition hover:scale-105 active:scale-95 mt-4`}
                    >
                      <ThumbsUp className="w-5 h-5" />
                    </button>
                    <p>
                      <span className="text-sm text-gray-500 flex items-center gap-1 mt-2">
                        {review.helpful_count} like{review.helpful_count == 1 ? '' : 's'}
                        {/* --- PASTE THIS BLOCK HERE --- */}

                      </span>
                    </p>
                    </div>
                  ))}
                </div>
              )}
            
            </section>
          </div>
          
          {/* Right Column: Sidebar Stats */}
          <div className="space-y-6">
            <div className={`p-8 rounded-[2rem] border ${dark ? 'bg-gray-900/40 border-white/10' : 'bg-gray-50 border-black/5 shadow-sm'}`}>
              <h4 className="font-bold font-serif text-2xl mb-6 flex items-center gap-3 ">
                <Clock font-serif className={"w-6 h-6 text-[#ffbf3e]"} /> Operating Hours
              </h4>
              <div>
                  {hours.length > 0 ? (
                    <ul>
                      {hours.map((row) => (
                        <li key={row.hours_id} className={`text-base leading-relaxed ${dark ? 'text-gray-100' : 'text-gray-600'}`}  >
                          
                          <strong>{row.day_of_week}: </strong> {row.is_open ? `${formatTo12Hour(row.open_time)} - ${formatTo12Hour(row.close_time)}` : 
                          <span style={{ color: '#FA6666', fontWeight: 'bold' }}>CLOSED</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No hours listed for this location.</p>
                  )}
                </div>
            </div>

            
          </div>

        </div>
      </main>

      {reviewPhotoLightbox && establishment && (
        <div
          className="fixed inset-0 z-[110] flex flex-col bg-black sm:flex-row"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-photo-lightbox-title"
        >
          <button
            type="button"
            className="absolute inset-0 z-0 bg-black/95"
            aria-label="Close photo viewer"
            onClick={() => setReviewPhotoLightbox(null)}
          />
          <div className="relative z-10 flex h-full w-full min-h-0 flex-1 flex-col sm:flex-row">
            <div className="relative flex min-h-[45vh] flex-1 items-center justify-center px-4 pb-4 pt-14 sm:min-h-0 sm:px-8 sm:pb-8 sm:pt-6">
              <button
                type="button"
                className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf3e]"
                onClick={() => setReviewPhotoLightbox(null)}
              >
                <X className="h-4 w-4" />
                Close
              </button>
              {reviewPhotoLightbox.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-3 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-40 sm:left-4"
                    aria-label="Previous photo"
                    onClick={() =>
                      setReviewPhotoLightbox((lb) =>
                        lb && lb.photos.length > 1
                          ? {
                              ...lb,
                              index: (lb.index - 1 + lb.photos.length) % lb.photos.length,
                            }
                          : lb,
                      )
                    }
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-3 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-40 sm:right-4"
                    aria-label="Next photo"
                    onClick={() =>
                      setReviewPhotoLightbox((lb) =>
                        lb && lb.photos.length > 1
                          ? {
                              ...lb,
                              index: (lb.index + 1) % lb.photos.length,
                            }
                          : lb,
                      )
                    }
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              )}
              <img
                src={reviewPhotoLightbox.photos[reviewPhotoLightbox.index]?.src}
                alt=""
                className="relative z-10 max-h-[min(70vh,900px)] max-w-full object-contain sm:max-h-[min(85vh,920px)]"
              />
            </div>
            <aside
              className={`relative z-20 flex max-h-[38vh] w-full flex-col border-t sm:max-h-none sm:w-96 sm:max-w-[40vw] sm:border-l sm:border-t-0 ${
                dark
                  ? 'border-white/10 bg-[#14161f] text-white'
                  : 'border-black/10 bg-white text-gray-900'
              }`}
            >
              <div className="overflow-y-auto p-6">
                <h2 id="review-photo-lightbox-title" className="text-xl font-bold leading-tight">
                  Photos for {establishment.name}
                </h2>
                <p className={`mt-2 text-sm ${dark ? 'text-white/55' : 'text-gray-500'}`}>
                  {reviewPhotoLightbox.index + 1} of {reviewPhotoLightbox.photos.length}
                </p>
                <div
                  className={`mt-6 flex items-start gap-3 border-t pt-6 ${
                    dark ? 'border-white/10' : 'border-gray-200'
                  }`}
                >
                  {(() => {
                    const reviewUser = users.find((u) => u.user_id === reviewPhotoLightbox.review.user_id);
                    const displayName = getDisplayName(reviewUser);
                    const avatarUrl = getAvatarUrl(reviewUser);
                    const affiliation = getAffiliation(reviewUser);
                    const avatarBroken = brokenAvatars[String(reviewPhotoLightbox.review.user_id)] === true;
                    return (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ffbf3e] text-sm font-bold text-black">
                        {avatarUrl && !avatarBroken ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={() =>
                              setBrokenAvatars((prev) => ({
                                ...prev,
                                [String(reviewPhotoLightbox.review.user_id)]: true,
                              }))
                            }
                          />
                        ) : (
                          getInitials(displayName)
                        )}
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <p
                      className={`font-semibold ${dark ? 'text-[#ffbf3e]' : 'text-[#0073bb]'}`}
                    >
                      {getDisplayName(users.find((u) => u.user_id === reviewPhotoLightbox.review.user_id))}
                    </p>
                    {getAffiliation(users.find((u) => u.user_id === reviewPhotoLightbox.review.user_id)) && (
                      <p className={`text-xs font-semibold ${dark ? 'text-white/70' : 'text-gray-600'}`}>
                        {getAffiliation(users.find((u) => u.user_id === reviewPhotoLightbox.review.user_id))}
                      </p>
                    )}
                    <p className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                      {formatRelativeReviewTime(reviewPhotoLightbox.review.updated_at)}
                    </p>
                  </div>
                </div>
                {Number(reviewPhotoLightbox.review.helpful_count) > 0 && (
                  <div
                    className={`mt-5 flex items-center gap-2 text-sm ${dark ? 'text-white/65' : 'text-gray-600'}`}
                  >
                    <ThumbsUp className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {reviewPhotoLightbox.review.helpful_count} helpful
                      {Number(reviewPhotoLightbox.review.helpful_count) === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {galleryModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="establishment-gallery-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            aria-label="Close photo gallery"
            onClick={() => setGalleryModalOpen(false)}
          />
          <div
            className={`relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
              dark ? 'border-white/10 bg-[#0f1219]' : 'border-black/10 bg-white'
            }`}
          >
            <div
              className={`flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4 ${
                dark ? 'border-white/10' : 'border-black/10'
              }`}
            >
              <h2 id="establishment-gallery-title" className="text-lg font-bold">
                Photos · {establishment.name}
              </h2>
              <button
                type="button"
                onClick={() => setGalleryModalOpen(false)}
                className={`rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf3e] ${
                  dark ? 'text-white/90' : 'text-black/80'
                }`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {galleryUrls.length === 0 ? (
                <p className={`py-10 text-center text-sm ${dark ? 'text-white/50' : 'text-black/50'}`}>
                  No photos are stored for this spot yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {galleryUrls.map((src, i) => (
                    <div
                      key={`${src}-${i}`}
                      className={`overflow-hidden rounded-xl ${
                        dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-gray-100 ring-1 ring-black/5'
                      }`}
                    >
                      <img
                        src={src}
                        alt=""
                        className="aspect-[4/3] h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
