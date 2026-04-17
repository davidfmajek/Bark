import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

const campusCenter = [39.2551, -76.7113];
const campusBounds = [
  [39.2475, -76.7215],
  [39.2628, -76.7015],
];

const defaultMarkerIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [20, 35],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function MapPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const tileLayerURL = dark ?
  'https://api.maptiler.com/maps/openstreetmap-dark/256/{z}/{x}/{y}.png?key=KkbRJwIUKKiVqIk5Mogg'
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const [diningLocations, setDiningLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDiningLocations() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('establishments_with_ratings')
          .select('establishment_id, name, description, category, latitude, longitude, average_rating')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;

        const mappedLocations = (data ?? [])
          .map((location) => {
            const latitude = Number(location.latitude);
            const longitude = Number(location.longitude);

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return null;
            }

            return {
              id: location.establishment_id,
              name: location.name,
              href: `/restaurants/${location.establishment_id}`,
              position: [latitude, longitude],
              rating: location.average_rating,
              description:
                location.description || location.category,
            };
          })
          .filter(Boolean);

        setDiningLocations(mappedLocations);
      } catch (error) {
        console.error('Error fetching dining locations:', error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDiningLocations();
  }, []);

  return (
    <div className={`relative min-h-[calc(100vh-3.5rem)] overflow-hidden ${dark ? 'bg-[#0f1219]' : 'bg-white'}`}>
      {dark ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      ) : (
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
      )}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">

        <div className={`grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] ${dark ? 'text-white' : 'text-black'}`}>
          <div className={`overflow-hidden rounded-[2rem] border shadow-2xl ${dark ? 'border-white/10 bg-white/[0.03] shadow-black/30' : 'border-black/10 bg-white shadow-black/10'}`}>
            <MapContainer
              center={campusCenter}
              zoom={16}
              scrollWheelZoom
              maxBounds={campusBounds}
              maxBoundsViscosity={1}
              minZoom={15}
              maxZoom={18}
              className="h-[95vh] min-h-[460px] w-full"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url={tileLayerURL}
              />
              {diningLocations.map((location) => (
                <Marker key={location.name} position={location.position} icon={defaultMarkerIcon}>
                
                  <Popup>
                    <div className="space-y-1">
                      <a
                        href={location.href}
                        className="text-sm font-bold underline underline-offset-2"
                      >
                        {location.name}
                      </a>
                      <p className="text-xs leading-relaxed">{location.description}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <aside className={`flex max-h-[95vh] min-h-[460px] flex-col rounded-[2rem] border p-5 backdrop-blur ${dark ? 'border-white/10 bg-white/[0.05]' : 'border-black/10 bg-white/90'}`}>
            <h2 className={`font-display text-2xl font-black tracking-tight ${dark ? 'text-white' : 'text-black'}`}>
              Dining Locations
            </h2>

            <div className={`mt-5 flex-1 space-y-3 overflow-y-auto pr-1 text-sm ${dark ? 'text-white/80' : 'text-black/75'}`}>

              {diningLocations.map((location) => (
                <div
                  key={location.name}
                  className={`rounded-2xl border p-4 ${dark ? 'border-white/10 bg-black/10' : 'border-black/10 bg-[#faf7ef]'}`}
                >
                  <a
                    href={location.href}
                    className={`font-semibold underline underline-offset-2 transition-colors ${
                      dark ? 'hover:text-[#f5bf3e]' : 'hover:text-[#8a6110]'
                    }`}
                  >
                    {location.name}
                  </a>
                  
                  <p className={`mt-1 text-xs leading-relaxed ${dark ? 'text-white/65' : 'text-black/60'}`}>
                    {location.description}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
