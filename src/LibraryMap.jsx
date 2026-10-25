import { MapPin, Navigation, ArrowUpRight } from "lucide-react";

export function mapLocation(library) {
  const precise =
    Number.isFinite(library.lat) &&
    Number.isFinite(library.lng) &&
    Math.abs(library.lat) <= 90 &&
    Math.abs(library.lng) <= 180;
  const destination = precise
    ? `${library.lat},${library.lng}`
    : library.address;
  return {
    precise,
    embed: `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&z=16&output=embed`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
  };
}

export default function LibraryMap({ library }) {
  const location = mapLocation(library);
  return (
    <section
      className="library-map"
      aria-labelledby={`map-heading-${library.id}`}
    >
      <div className="library-map-heading">
        <div>
          <span className="eyebrow">FIND YOUR WAY HERE</span>
          <h3 id={`map-heading-${library.id}`}>
            A little closer to your next chapter.
          </h3>
        </div>
        <span className="map-pin-icon">
          <MapPin size={21} />
        </span>
      </div>
      <div className="library-map-frame">
        <iframe
          key={location.embed}
          title={`Location map for ${library.name}`}
          src={location.embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <div className="library-map-address">
        <div>
          <strong>{library.name}</strong>
          <p>
            <MapPin size={14} />
            {library.address}
          </p>
        </div>
        <a
          className="btn secondary"
          href={location.directions}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Navigation size={15} /> Get directions <ArrowUpRight size={14} />
        </a>
      </div>
      <p className="map-help">
        {location.precise
          ? "Use the map to explore the area, or open directions for your route."
          : "Showing an address search. Confirm the exact entrance with the library."}{" "}
        If the map does not load, use Get directions.
      </p>
    </section>
  );
}
