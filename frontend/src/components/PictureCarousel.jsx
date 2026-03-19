import { useEffect, useMemo, useState } from 'react';

export function PictureCarousel({
  slides = [],
  intervalMs = 4500,
  className = '',
  overlayClassName = '',
  showDots = true,
  dark = false,
  pauseOnHover = true,
  imageClassName = 'h-full w-full object-cover',
  rounded = true,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const safeSlides = useMemo(() => (Array.isArray(slides) ? slides : []), [slides]);

  useEffect(() => {
    if (safeSlides.length <= 1) return undefined;
    if (paused) return undefined;

    const t = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % safeSlides.length);
    }, intervalMs);

    return () => window.clearInterval(t);
  }, [paused, intervalMs, safeSlides.length]);

  useEffect(() => {
    // If slides change and the active index is out of range, clamp it.
    if (activeIndex >= safeSlides.length) setActiveIndex(0);
  }, [activeIndex, safeSlides.length]);

  if (!safeSlides.length) return null;

  const defaultOverlay = dark ? 'bg-black/30' : 'bg-black/15';

  return (
    <div
      className={`relative overflow-hidden ${rounded ? 'rounded-2xl' : ''} ${className}`}
      {...(pauseOnHover
        ? { onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) }
        : {})}
      role="region"
      aria-label="Homepage picture carousel"
    >
      {safeSlides.map((s, idx) => {
        const isActive = idx === activeIndex;
        return (
          <div
            key={s.key ?? idx}
            className={`absolute inset-0 transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={!isActive}
          >
            {s.imageSrc ? (
              <img
                src={s.imageSrc}
                alt={s.alt ?? ''}
                className={imageClassName}
                draggable={false}
              />
            ) : (
              <div className={`h-full w-full ${s.bgClass ?? 'bg-gradient-to-br from-[#f5bf3e]/25 to-transparent'}`} />
            )}

            {/* Ensures text is readable on top of the carousel */}
            <div className={`absolute inset-0 ${overlayClassName || defaultOverlay}`} />
          </div>
        );
      })}

      {showDots && safeSlides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {safeSlides.map((_, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  isActive ? (dark ? 'bg-[#f5bf3e]' : 'bg-[#D4A017]') : dark ? 'bg-white/25' : 'bg-black/15'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

