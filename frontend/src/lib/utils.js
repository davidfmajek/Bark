import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function nameToSlug(restaurantName) {
  return restaurantName
    .toLowerCase()
    .replace(/\s+/g, '-') // spaces → dashes
    .replace(/[^a-z0-9\-]/g, ''); // drop everything except a-z 0-9 -
}

/** Review timestamps: "Just now", "5 min ago", "2 hours ago", "3 days ago", or a short locale date if older. */
export function formatRelativeReviewTime(iso) {
  if (iso == null || iso === '') return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diffMs = Date.now() - then.getTime();
  if (diffMs < 0) return then.toLocaleDateString();
  if (diffMs < 60_000) return 'Just now';
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return min === 1 ? '1 min ago' : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? '1 day ago' : `${day} days ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTo12Hour(timeStr) {
  if (!timeStr) return '';
  // Split the "HH:mm:ss" string
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // Convert 0 to 12 for midnight
  return `${h}:${minutes} ${ampm}`;
}
