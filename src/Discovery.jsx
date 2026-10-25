import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  TicketPercent,
  UserRound,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useStore } from "./store";
import { localDate } from "./data";
import { libraryDistance } from "./workspace";
import { money, seatState, timeLabel } from "./domain";
import {
  BookingDetails,
  Button,
  Empty,
  Field,
  Modal,
  navigate,
} from "./components";

const searchPrompts = [
  "study spots",
  "quiet spaces",
  "nearby libraries",
  "reading corners",
  "available seats",
];

const categories = [
  {
    id: "all",
    name: "All spaces",
    image: "/images/studyhub.jpg",
    icon: BookOpen,
  },
  { id: "ac", name: "AC rooms", image: "/images/focus.jpg", icon: Wind },
  {
    id: "quiet",
    name: "Quiet study",
    image: "/images/reading-room.jpg",
    icon: BookOpen,
  },
  {
    id: "charging",
    name: "Charging",
    image: "/images/knowledge.jpg",
    icon: Zap,
  },
  { id: "late", name: "Open late", image: "/images/focus.jpg", icon: Clock },
];

export default function Discovery({
  explore = false,
  savedOnly = false,
  budgetOnly = false,
  offersOnly = false,
}) {
  const { db, session, notify } = useStore();
  const [promptIndex, setPromptIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPromptIndex((index) => (index + 1) % searchPrompts.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);
  const searchRow = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () =>
      setScrolled(
        window.scrollY > 0 &&
          searchRow.current?.getBoundingClientRect().top <= 0,
      );
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("Recommended"),
    [filters, setFilters] = useState(false),
    [maxPrice, setMaxPrice] = useState(budgetOnly ? 40 : 100),
    [maxDistance, setMaxDistance] = useState(50),
    [minRating, setMinRating] = useState(0),
    [onlyAvailable, setOnlyAvailable] = useState(false),
    [openOnly, setOpenOnly] = useState(false),
    [position, setPosition] = useState(null),
    [locating, setLocating] = useState(false),
    [nearby, setNearby] = useState(false),
    [saved, setSaved] = useState(() =>
      JSON.parse(localStorage.getItem("libra-saved") || "[]"),
    ),
    [detail, setDetail] = useState(null),
    [hideShortcut, setHideShortcut] = useState(false),
    [offer, setOffer] = useState(false);
  const slot = { date: localDate(), start: "10:00", duration: 2 };
  const guestIds = JSON.parse(
    localStorage.getItem("libra-guest-bookings") || "[]",
  );
  const nextBooking = db.bookings.find(
    (b) =>
      (session ? b.userId === session.id : guestIds.includes(b.id)) &&
      ["Upcoming", "Active"].includes(b.status),
  );
  function save(id) {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(next);
    localStorage.setItem("libra-saved", JSON.stringify(next));
    notify(
      next.includes(id)
        ? "Added to your saved spaces."
        : "Removed from saved spaces.",
    );
  }
  function locate() {
    if (!navigator.geolocation) {
      notify(
        "Location is unavailable. Search by neighborhood instead.",
        "error",
        "location-error",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort("Nearest");
        setNearby(true);
        setLocating(false);
        notify("Showing distances from your location.");
      },
      () => {
        setLocating(false);
        notify(
          "Location access unavailable. You can search by neighborhood.",
          "error",
          "location-error",
        );
      },
      { timeout: 10000 },
    );
  }
  function reset() {
    setSearch("");
    setCategory("all");
    setMaxPrice(budgetOnly ? 40 : 100);
    setMaxDistance(50);
    setMinRating(0);
    setOnlyAvailable(false);
    setOpenOnly(false);
    setNearby(false);
    setSort("Recommended");
  }
  const results = db.libraries
    .filter((l) => l.status === "Approved")
    .map((l) => ({
      ...l,
      distance: position ? libraryDistance(position, l) : l.distance,
    }))
    .filter(
      (l) =>
        (!savedOnly || saved.includes(l.id)) &&
        `${l.name} ${l.address}`.toLowerCase().includes(search.toLowerCase()) &&
        (category === "all" ||
          (category === "ac" && l.facilities.includes("AC")) ||
          (category === "charging" && l.facilities.includes("Charging")) ||
          (category === "quiet" && /quiet|silent/i.test(l.rules)) ||
          (category === "late" && l.close >= "22:00")) &&
        l.price <= maxPrice &&
        (Number.isFinite(l.distance)
          ? l.distance <= maxDistance
          : maxDistance === 50 && !nearby) &&
        l.rating >= minRating &&
        (!onlyAvailable ||
          db.seats.some(
            (s) =>
              s.libraryId === l.id && seatState(s, db, slot) === "Available",
          )) &&
        (!openOnly ||
          (new Date().toTimeString().slice(0, 5) >= l.open &&
            new Date().toTimeString().slice(0, 5) <= l.close)),
    )
    .sort((a, b) =>
      sort === "Nearest"
        ? (a.distance ?? Infinity) - (b.distance ?? Infinity)
        : sort === "Price: low to high"
          ? a.price - b.price
          : sort === "Top rated"
            ? b.rating - a.rating
            : Number(b.featured) - Number(a.featured),
    );
  const shortcutLibrary =
    db.libraries.find((l) => l.id === nextBooking?.libraryId) || results[0];
  const activeFilters = [
    maxPrice < 100,
    maxDistance < 50,
    minRating > 0,
    openOnly,
  ].filter(Boolean).length;
  return (
    <div className="market-discovery">
      <div className="market-location-bar">
        <button
          className="market-location-button"
          onClick={locate}
          aria-label="Use my location"
        >
          <span>
            <MapPin size={23} fill="currentColor" />
            {locating ? "Locating…" : position ? "Near you" : "Kanpur"}
            <ChevronDown size={19} />
          </span>
          <small>
            {position
              ? "Spaces around your current location"
              : "Civil Lines, Swaroop Nagar & beyond"}
          </small>
        </button>
        <div className="market-location-actions">
          <button
            className="study-perks"
            onClick={() => setOffer(true)}
            aria-label="View study offer"
          >
            <Sparkles size={13} />
            <span>
              STUDY
              <br />
              <b>10% OFF</b>
            </span>
          </button>
          <button
            className="market-profile"
            aria-label="Open student profile"
            onClick={() =>
              navigate(session ? "/student/profile" : "/auth/login")
            }
          >
            {session?.name?.[0] || <UserRound size={22} />}
          </button>
        </div>
      </div>

      <section
        ref={searchRow}
        className={`search-section market-sticky-search${scrolled ? " is-scrolled" : ""}`}
        aria-label="Find a library"
      >
        <form
          className="main-search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(search.trim());
            document
              .getElementById("library-results")
              .scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <Search size={25} />
          <div className="search-text-field">
            <input
              id="discover-search"
              aria-label="Search libraries"
              placeholder=""
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {!search && (
              <span
                key={promptIndex}
                className="rotating-search-prompt"
                aria-hidden="true"
              >
                Search “{searchPrompts[promptIndex]}”
              </span>
            )}
          </div>
          {search ? (
            <button
              type="button"
              className="market-search-clear"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={19} />
            </button>
          ) : (
            <button
              type="submit"
              className="market-search-go"
              aria-label="Find a space"
            >
              <ArrowRight size={21} />
            </button>
          )}
        </form>
        <button
          className={`seat-only-toggle ${nearby ? "on" : ""}`}
          role="switch"
          aria-checked={nearby}
          aria-label="Nearby spaces"
          aria-busy={locating}
          disabled={locating}
          onClick={() => {
            if (nearby) {
              setNearby(false);
              setSort("Recommended");
            } else locate();
          }}
        >
          <span>{locating ? "LOCATING" : "NEARBY SPACES"}</span>
          <i>
            <b />
          </i>
        </button>
      </section>

      {!savedOnly && !explore && !budgetOnly && !offersOnly && (
        <section className="market-campaign">
          <div className="campaign-confetti" aria-hidden="true">
            <span>✦</span>
            <span>✳</span>
            <span>✦</span>
            <span>✳</span>
          </div>
          <div className="campaign-arch" aria-hidden="true" />
          <div className="campaign-books" aria-hidden="true">
            <div className="book-cover">
              <BookOpen size={39} />
              <span>
                BIG
                <br />
                IDEAS
              </span>
            </div>
            <i className="book-spine spine-one" />
            <i className="book-spine spine-two" />
            <i className="book-spine spine-three" />
            <div className="desk-cup">
              <span />
            </div>
          </div>
          <div className="campaign-copy">
            <span className="campaign-eyebrow">
              A LITTLE SPACE. A LOT OF POSSIBILITY.
            </span>
            <h1 aria-label="Make room for your next chapter.">
              YOUR NEXT
              <br />
              CHAPTER.
            </h1>
            <p>Your seat. Your goals. Your time to shine.</p>
            <button
              onClick={() => {
                document
                  .getElementById("library-results")
                  .scrollIntoView({ behavior: "smooth" });
                document
                  .getElementById("discover-search")
                  .focus({ preventScroll: true });
              }}
            >
              Find a seat <ChevronRight size={19} />
            </button>
          </div>
          <div className="campaign-photo" aria-hidden="true">
            <img src="/images/reading-room.jpg" alt="" />
            <span>
              FOCUS
              <br />
              FEELS GOOD.
            </span>
          </div>
          <div className="campaign-leaves" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="campaign-caption">
            <span />
            <b>Good spaces for great things.</b>
            <span />
          </div>
        </section>
      )}

      {(explore || savedOnly || budgetOnly || offersOnly) && (
        <div className="market-page-title">
          <span>
            {savedOnly
              ? "KEEP YOUR FAVORITES CLOSE"
              : budgetOnly
                ? "BIG FOCUS. LITTLE PRICES."
                : offersOnly
                  ? "A LITTLE EXTRA FOR YOUR NEXT SESSION"
                  : "YOUR NEXT GREAT STUDY DAY"}
          </span>
          <h1>
            {savedOnly
              ? "Your saved spaces."
              : budgetOnly
                ? "Study more. Spend less."
                : offersOnly
                  ? "Good spaces. Better deals."
                  : "Find your space."}
          </h1>
          {offersOnly && (
            <button onClick={() => setOffer(true)}>
              10% off with STUDY10 <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}

      <div className="market-categories" aria-label="Library categories">
        <button
          className={`budget-category ${maxPrice === 40 ? "active" : ""}`}
          onClick={() => {
            setMaxPrice(maxPrice === 40 ? 100 : 40);
            setSort("Price: low to high");
          }}
        >
          <span>STUDY SPACES</span>
          <strong>
            UNDER
            <br />
            <b>₹40</b>
          </strong>
          <small>
            per hour <ChevronRight size={10} />
          </small>
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            aria-pressed={category === c.id}
            className={`market-category ${category === c.id ? "active" : ""}`}
            onClick={() => setCategory(c.id)}
          >
            <span className={`category-image category-${c.id}`}>
              <img src={c.image} alt="" />
              <c.icon size={18} />
            </span>
            <strong>{c.name}</strong>
          </button>
        ))}
      </div>

      <div className="market-filter-row">
        <button
          className={filters ? "active" : ""}
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={17} /> Filters{" "}
          {activeFilters > 0 && <b>{activeFilters}</b>}
          <ChevronDown size={14} />
        </button>
        <button
          className={nearby ? "active" : ""}
          onClick={() =>
            nearby ? (setNearby(false), setSort("Recommended")) : locate()
          }
        >
          <Zap size={17} fill="currentColor" />
          {locating ? "Locating…" : "Nearby spaces"}
        </button>
        <button
          className={openOnly ? "active" : ""}
          onClick={() => setOpenOnly(!openOnly)}
        >
          <Clock size={16} /> Open now
        </button>
        <button
          className={minRating === 4.8 ? "active" : ""}
          onClick={() => setMinRating(minRating === 4.8 ? 0 : 4.8)}
        >
          <Star size={15} /> Top rated
        </button>
      </div>

      {filters && (
        <div className="advanced-filters market-advanced-filters">
          <Field label={`Up to ${money(maxPrice)} / hour`}>
            <input
              type="range"
              min="20"
              max="100"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
          </Field>
          <Field label="Distance">
            <select
              value={maxDistance}
              onChange={(e) => setMaxDistance(Number(e.target.value))}
            >
              <option value="50">Within 50 km</option>
              <option value="1">Within 1 km</option>
              <option value="2">Within 2 km</option>
              <option value="5">Within 5 km</option>
            </select>
          </Field>
          <Field label="Minimum rating">
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            >
              <option value="0">All ratings</option>
              <option value="4.8">4.8 and above</option>
              <option value="4.9">4.9 and above</option>
            </select>
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
            />
            Open now
          </label>
          <button className="link" onClick={reset}>
            Reset filters
          </button>
          <button className="link" onClick={() => setFilters(false)}>
            Done <Check size={14} />
          </button>
        </div>
      )}

      <section className="market-recommendations">
        <div id="library-results" className="market-section-title">
          <h2>
            {savedOnly
              ? "SAVED FOR YOUR NEXT SESSION"
              : search
                ? "YOUR SEARCH RESULTS"
                : "RECOMMENDED FOR YOU"}
          </h2>
          <span>{results.length} spaces</span>
          <select
            aria-label="Sort libraries"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {["Recommended", "Nearest", "Price: low to high", "Top rated"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </div>
        <div className="market-card-rail library-grid">
          {results.map((l) => (
            <FeedCard
              key={l.id}
              library={l}
              slot={slot}
              saved={saved.includes(l.id)}
              onSave={() => save(l.id)}
            />
          ))}
        </div>
        {!results.length && (
          <Empty
            title="Your perfect space is still out there."
            text="Try another neighborhood or clear a few filters."
            action={
              <Button variant="secondary" onClick={reset}>
                Clear filters
              </Button>
            }
          />
        )}
      </section>

      {!savedOnly && (
        <button className="market-offer-strip" onClick={() => setOffer(true)}>
          <span className="offer-ticket">
            <TicketPercent size={25} />
          </span>
          <div>
            <span>A LITTLE BOOST FOR YOUR STUDY DAY</span>
            <strong>Good focus. Even better value.</strong>
            <small>Get 10% off your booking with STUDY10</small>
          </div>
          <ArrowUpRight size={23} />
        </button>
      )}

      {!search && results.length > 0 && (
        <section className="market-more-spaces">
          <div className="market-section-title">
            <h2>MORE ROOM FOR YOUR AMBITIONS</h2>
          </div>
          {results.map((l) => (
            <button
              key={l.id}
              className="library-list-item"
              onClick={() => navigate(`/library/${l.id}`)}
              aria-label={`Explore ${l.name}`}
            >
              <img src={l.photo} alt="" />
              <div>
                <span className="list-item-tag">
                  <ShieldCheck size={12} /> VERIFIED STUDY SPACE
                </span>
                <h3>{l.name}</h3>
                <p>{l.address}</p>
                <div>
                  <span className="feed-rating">
                    {l.rating}
                    <Star size={10} fill="currentColor" />
                  </span>
                  <span>{l.facilities.slice(0, 3).join(" · ")}</span>
                </div>
                <strong>
                  {money(l.price)}
                  <small> / hour</small>
                </strong>
              </div>
              <ArrowUpRight size={19} />
            </button>
          ))}
        </section>
      )}
      <div className="market-end-note">
        <BookOpen size={35} strokeWidth={1.3} />
        <h2>
          Less noise.
          <br />
          More possibility.
        </h2>
        <p>Made for the things you’re working toward.</p>
        <span>LIBRABOOK</span>
      </div>

      {!hideShortcut && shortcutLibrary && (
        <div className="market-booking-shortcut">
          <img src={shortcutLibrary.photo} alt="" />
          <div>
            <strong>{shortcutLibrary.name}</strong>
            <button
              onClick={() =>
                nextBooking
                  ? setDetail(nextBooking)
                  : navigate(`/library/${shortcutLibrary.id}`)
              }
            >
              {nextBooking
                ? `${timeLabel(nextBooking.start)} · ${nextBooking.status}`
                : "Your next study spot"}
              <ChevronRight size={12} />
            </button>
          </div>
          <button
            className="shortcut-primary"
            onClick={() =>
              nextBooking
                ? setDetail(nextBooking)
                : navigate(`/library/${shortcutLibrary.id}`)
            }
          >
            {nextBooking ? "View booking" : "View seats"}
            <small>{nextBooking ? "Your session" : "Find your focus"}</small>
          </button>
          <button
            className="shortcut-close"
            aria-label="Dismiss booking shortcut"
            onClick={() => setHideShortcut(true)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {detail && (
        <BookingDetails booking={detail} onClose={() => setDetail(null)} />
      )}
      {offer && (
        <Modal
          title="A little boost for your study day."
          onClose={() => setOffer(false)}
        >
          <div className="offer-modal">
            <span>
              <TicketPercent size={34} />
            </span>
            <h3>10% off your next booking</h3>
            <p>
              Choose any available hourly session or day pass. Apply this code
              at checkout to take 10% off your total.
            </p>
            <strong>STUDY10</strong>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText("STUDY10");
                  notify("STUDY10 copied. Apply it at checkout.");
                } catch {
                  notify("Use STUDY10 at checkout.", "info");
                }
                setOffer(false);
              }}
            >
              Copy code & explore <ArrowRight size={16} />
            </Button>
            <small>Demo offer · no real payment is collected.</small>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FeedCard({ library, slot, saved, onSave }) {
  const { db } = useStore();
  const available = db.seats.filter(
    (s) => s.libraryId === library.id && seatState(s, db, slot) === "Available",
  ).length;
  return (
    <article className="library-card feed-card">
      <div className="feed-image-wrap">
        <button
          className="library-image"
          aria-label={`View ${library.name}`}
          onClick={() => navigate(`/library/${library.id}`)}
        >
          <img
            src={library.photo}
            alt={`${library.name} study space`}
            loading="lazy"
          />
          <span className="feed-offer">
            10% OFF <small>with STUDY10</small>
          </span>
        </button>
        <button
          className={`feed-save ${saved ? "saved" : ""}`}
          aria-label={saved ? `Unsave ${library.name}` : `Save ${library.name}`}
          onClick={onSave}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="feed-rating">
          {library.rating.toFixed(1)}
          <Star size={10} fill="currentColor" />
        </span>
      </div>
      <div className="feed-card-body">
        <h3>
          <button onClick={() => navigate(`/library/${library.id}`)}>
            {library.name}
          </button>
        </h3>
        <p>
          <Zap size={13} fill="currentColor" />
          {available > 0
            ? `${available} seats available`
            : "Check other time slots"}
        </p>
        <span className="feed-distance">
          <MapPin size={12} />
          {Number.isFinite(library.distance)
            ? `${library.distance.toFixed(1)} km away`
            : "Distance unavailable"}
        </span>
        <div className="feed-price">
          <strong>{money(library.price)}</strong>
          <span>/ hour</span>
          <ArrowUpRight size={15} />
        </div>
      </div>
    </article>
  );
}
