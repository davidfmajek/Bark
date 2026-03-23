import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function nameToSlug(restaurantName) {
  return restaurantName
    .toLowerCase()
    // replaces spaces with dashes
    .replace(/\s+/g, '-')
    // removes any character that is not a letter, number, or a dash
    .replace(/[^a-z0-9\-]/g, '');
}
