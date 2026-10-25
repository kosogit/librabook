import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Armchair,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Heart,
  LoaderCircle,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useStore } from "./store";
import { payWithRazorpay } from "./payments";
import { localDate } from "./data";
import { libraryDistance } from "./workspace";
import LibraryMap, { mapLocation } from "./LibraryMap";
import {
  distanceKm,
  endTime,
  money,
  quote,
  seatState,
  timeLabel,
  validateSlot,
} from "./domain";
import {
  Badge,
  BookingDetails,
  Button,
  Empty,
  Facilities,
  Field,
  LibraryCard,
  Modal,
  QR,
  SeatMap,
  SectionHeading,
  navigate,
} from "./components";
export function LibraryDetail({ id, publicQr = false, onBook }) {
  const { db, session, saveItem, notify } = useStore();
  const lib = db.libraries.find((l) => l.id === id);
  const openedQr = useRef(null);
  useEffect(() => {
    if (publicQr && lib?.status === "Approved" && openedQr.current !== id) {
      openedQr.current = id;
      onBook(id);
    }
  }, [publicQr, id, lib?.status, onBook]);
  const [tab, setTab] = useState("About"),
    [photo, setPhoto] = useState(null),
    [review, setReview] = useState(false);
  if (!lib || lib.status !== "Approved")
    return (
      <Empty
        title="This library isn’t available."
        text="Explore another space while we get this one ready."
        action={
          <Button onClick={() => navigate("/student/explore")}>
            Explore spaces
          </Button>
        }
      />
    );
  return (
    <>
      <button
        className="back-link mb-6"
        onClick={() => navigate("/student/explore")}
      >
        <ArrowLeft size={15} /> Back to spaces
      </button>
      {publicQr && (
        <div className="public-qr-note">
          <QrMini /> You’re in the right place. Book a seat here — no app
          download needed.
        </div>
      )}
      <div className="detail-hero">
        <img src={photo || lib.photo} alt={lib.name} />
        <span className="image-label">
          <Star size={12} /> YOUR QUIET CORNER AWAITS
        </span>
      </div>
      {lib.photos?.length > 0 && (
        <div className="photo-thumbs">
          {[lib.photo, ...lib.photos].map((p, i) => (
            <button
              key={i}
              onClick={() => setPhoto(p)}
              aria-label={`View library photo ${i + 1}`}
            >
              <img src={p} alt={`Library photo ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
      <div className="library-detail-grid">
        <div>
          <div className="flex justify-between gap-4">
            <div>
              <span className="eyebrow">THOUGHTFULLY MADE FOR FOCUS</span>
              <h1>{lib.name}</h1>
              <p className="location mt-3">
                <MapPin size={15} />
                {lib.address}
                <a
                  className="link"
                  href={mapLocation(lib).directions}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get directions <ArrowUpRight size={12} />
                </a>
              </p>
            </div>
            <span className="rating">
              <Star size={16} fill="currentColor" />
              {lib.rating}
              <small>({lib.reviews})</small>
            </span>
          </div>
          <div className="tabs detail-tabs">
            {["About", "Seats", "Reviews", "Rules"].map((t) => (
              <button
                key={t}
                className={t === tab ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "About" && (
            <>
              <h3>{lib.tagline}</h3>
              <p className="body-copy">
                A welcoming place to settle in, switch off the noise, and do
                your best work. Whether it’s an exam, a new skill, or a chapter
                you can’t put down, there’s room for you here.
              </p>
              <h3 className="mt-7 mb-4">The little things, taken care of</h3>
              <Facilities items={lib.facilities} />
              <div className="info-columns">
                <div>
                  <Clock size={19} />
                  <h4>Opening hours</h4>
                  <p>
                    Every day · {timeLabel(lib.open)} – {timeLabel(lib.close)}
                  </p>
                </div>
                <div>
                  <ShieldCheck size={19} />
                  <h4>A space you can count on</h4>
                  <p>Verified library · Helpful on-site staff</p>
                </div>
              </div>
            </>
          )}
          {tab === "Seats" && (
            <SeatMap
              libraryId={lib.id}
              slot={{ date: localDate(), start: "10:00", duration: 2 }}
              onSelect={(s) => onBook(lib.id, s.id)}
            />
          )}
          {tab === "Rules" && (
            <div className="body-copy">
              <h3>A little consideration goes a long way.</h3>
              <p>{lib.rules}</p>
            </div>
          )}
          {tab === "Reviews" && (
            <>
              <div className="flex justify-between mb-4">
                <h3>From our community</h3>
                {session?.role === "student" && (
                  <button className="link" onClick={() => setReview(true)}>
                    Write a review
                  </button>
                )}
              </div>
              {db.reviews
                .filter((r) => r.libraryId === id && r.status === "Published")
                .map((r) => (
                  <div className="review" key={r.id}>
                    <b>{r.name}</b>
                    <span>{"★".repeat(r.rating)}</span>
                    <p>{r.text}</p>
                  </div>
                ))}
              {!db.reviews.some(
                (r) => r.libraryId === id && r.status === "Published",
              ) && <Empty text="Be the first to share your experience." />}
            </>
          )}
        </div>
        <aside className="booking-aside">
          <span className="eyebrow">YOUR SPACE, YOUR PACE</span>
          <h2>
            {money(lib.price)} <small>/ hour</small>
          </h2>
          <p>Stay a little. Or make a day of it.</p>
          <div className="price-options">
            <div>
              <span>Day pass</span>
              <b>{money(lib.daily)}</b>
            </div>
            <div>
              <span>Weekly membership</span>
              <b>{money(lib.weekly)}</b>
            </div>
            <div>
              <span>Monthly membership</span>
              <b>{money(lib.monthly)}</b>
            </div>
          </div>
          <Button className="w-full" onClick={() => onBook(lib.id)}>
            Find your seat <ArrowRight size={16} />
          </Button>
          <span className="aside-note">
            <ShieldCheck size={13} /> Instant confirmation. A little peace of
            mind.
          </span>
          <p className="text-xs">
            Weekly and monthly memberships are arranged at reception.
          </p>
        </aside>
      </div>
      <LibraryMap library={lib} />
      {review && (
        <Modal title="Share your experience" onClose={() => setReview(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              try {
                await saveItem("reviews", {
                  id: crypto.randomUUID(),
                  userId: session.id,
                  name: session.name,
                  libraryId: id,
                  rating: Number(f.get("rating")),
                  text: f.get("text"),
                  status: "Published",
                });
                setReview(false);
                notify("Thanks for sharing your experience.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            <Field label="Rating">
              <select name="rating">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your review">
              <textarea name="text" required maxLength={1000} />
            </Field>
            <Button>Publish review</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function QrMini() {
  return <BookOpen size={17} />;
}
export function Checkout({ libraryId, initialSeat, onClose, walkIn = false }) {
  const { db, session, book, mutate, notify, live, reload } = useStore();
  const lib = db.libraries.find((l) => l.id === libraryId);
  const [step, setStep] = useState(1),
    [date, setDate] = useState(localDate()),
    [start, setStart] = useState("10:00"),
    [duration, setDuration] = useState(2),
    [seat, setSeat] = useState(initialSeat || ""),
    [coupon, setCoupon] = useState(""),
    [applied, setApplied] = useState(""),
    [method, setMethod] = useState(live ? "Offline" : walkIn ? "Cash" : "UPI"),
    [name, setName] = useState(session?.role === "student" ? session.name : ""),
    [student, setStudent] = useState(""),
    [outcome, setOutcome] = useState("success"),
    [payment, setPayment] = useState("idle"),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false);
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const checkoutRequest = useRef({ key: "", id: "" });
  const [guestId] = useState(() => crypto.randomUUID());
  const userId = live
    ? db.viewerId
    : walkIn
      ? student || guestId
      : session?.id || guestId;
  const slot = { date, start, duration };
  const price = quote(lib, duration, applied);
  useEffect(
    () => () => {
      mutate(
        (d) => ({ ...d, holds: d.holds.filter((h) => h.userId !== userId) }),
        { type: "hold.release", payload: { userId } },
      ).catch(() => {});
    },
    [userId],
  );
  async function hold() {
    setError("");
    try {
      validateSlot(lib, slot);
      if (!seat) throw new Error("Choose an available seat first.");
      await mutate(
        (d) => {
          const s = d.seats.find((s) => s.id === seat);
          if (!s || seatState(s, d, slot, userId) !== "Available")
            throw new Error(
              "That seat is no longer available. Choose another.",
            );
          return {
            ...d,
            holds: [
              ...d.holds.filter((h) => h.userId !== userId),
              {
                ...slot,
                seatId: seat,
                userId,
                expiresAt: Date.now() + 5 * 60 * 1000,
              },
            ],
          };
        },
        { type: "hold.create", payload: { ...slot, seatId: seat, userId } },
      );
      setStep(2);
    } catch (e) {
      setError(e.message);
    }
  }
  async function pay() {
    setError("");
    if (!name.trim()) {
      setError("Please enter the student’s name.");
      return;
    }
    setBusy(true);
    setPayment("processing");
    try {
      if (!live) {
        await new Promise((r) => setTimeout(r, 1200));
        if (outcome !== "success") {
          setPayment(outcome);
          return;
        }
      }
      const input = {
        libraryId,
        seatId: seat,
        date,
        start,
        duration,
        name,
        userId,
        coupon: applied,
        method,
      };
      let next, bookingId;
      if (live && method === "Razorpay") {
        const key = JSON.stringify(input);
        if (checkoutRequest.current.key !== key)
          checkoutRequest.current = { key, id: crypto.randomUUID() };
        const paid = await payWithRazorpay(
          { ...input, requestId: checkoutRequest.current.id },
          {
            onOpen: () => setGatewayOpen(true),
            onClose: () => setGatewayOpen(false),
          },
        );
        next = paid.snapshot;
        bookingId = paid.bookingId;
        await reload(true);
      } else next = await book(input);
      const b = next.bookings.find((b) =>
        bookingId
          ? b.id === bookingId
          : b.userId === userId &&
            b.seatId === seat &&
            b.date === date &&
            b.start === start &&
            b.duration === duration,
      );
      if (!b)
        throw new Error(
          "Payment has not been confirmed by the server. Refresh your bookings before retrying.",
        );
      setResult(b);
      if (!session) {
        const ids = JSON.parse(
          localStorage.getItem("libra-guest-bookings") || "[]",
        );
        localStorage.setItem(
          "libra-guest-bookings",
          JSON.stringify([...ids, b.id]),
        );
      }
      setPayment("success");
      setStep(3);
      notify(
        b.status === "Upcoming"
          ? "Your seat is booked."
          : b.status === "Pending payment"
            ? "Request sent. Waiting for admin payment confirmation."
            : "Payment received. Contact the library for help.",
      );
    } catch (e) {
      setError(e.message);
      setPayment("failed");
      if (live) await reload(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      suspended={gatewayOpen}
      title={
        walkIn
          ? "Welcome them in."
          : step === 3
            ? "One good study day, coming up."
            : "Make a little room for focus."
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {step !== 3 && (
        <div className="checkout-steps">
          {["Choose your seat", "A few details", "You’re all set"].map(
            (t, i) => (
              <span className={step >= i + 1 ? "active" : ""} key={t}>
                <i>{i + 1}</i>
                {t}
              </span>
            ),
          )}
        </div>
      )}
      {step === 1 && (
        <div className="checkout-layout">
          <div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Study date"
                type="date"
                min={localDate()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSeat("");
                }}
                required
              />
              <Field
                label="Start time"
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setSeat("");
                }}
                required
              />
            </div>
            <Field label="How long are you staying?">
              <div className="duration-options">
                {[1, 2, 4, 8].map((h) => (
                  <button
                    type="button"
                    key={h}
                    className={duration === h ? "active" : ""}
                    onClick={() => {
                      setDuration(h);
                      setSeat("");
                    }}
                  >
                    <b>{h === 8 ? "Day pass" : `${h} hours`}</b>
                    <span>{money(h === 8 ? lib.daily : h * lib.price)}</span>
                  </button>
                ))}
              </div>
            </Field>
            <SeatMap
              libraryId={libraryId}
              slot={slot}
              selected={seat}
              onSelect={(s) => setSeat(s.id)}
            />
          </div>
          <aside className="checkout-summary">
            <img src={lib.photo} alt={lib.name} />
            <h3>{lib.name}</h3>
            <p>
              <MapPin size={12} />
              {lib.address}
            </p>
            <div className="detail-list">
              <span>Your seat</span>
              <b>
                {db.seats.find((s) => s.id === seat)?.label || "Choose a seat"}
              </b>
              <span>Date</span>
              <b>{date}</b>
              <span>Duration</span>
              <b>{duration} hours</b>
              <span>Total</span>
              <b>{money(price.total)}</b>
            </div>
            <Button className="w-full" onClick={hold}>
              Continue <ArrowRight size={16} />
            </Button>
            <p className="text-xs mt-3">
              Your seat is held for 5 minutes during checkout.
            </p>
          </aside>
        </div>
      )}
      {step === 2 && (
        <div className="checkout-layout">
          <div>
            {walkIn && (
              <Field label="Existing student">
                <select
                  value={student}
                  onChange={(e) => {
                    setStudent(e.target.value);
                    setName(
                      db.members.find((m) => m.id === e.target.value)?.name ||
                        "",
                    );
                  }}
                >
                  <option value="">New / walk-in student</option>
                  {db.members
                    .filter((m) => m.status === "Active")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field
              label="Student name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={60}
            />
            <Field label="Have a little something extra? (coupon)">
              <div className="flex gap-2">
                <input
                  placeholder="Try STUDY10"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    try {
                      quote(lib, duration, coupon);
                      setApplied(coupon.trim().toUpperCase());
                      setError("");
                      notify(
                        coupon ? "10% discount applied." : "Coupon removed.",
                      );
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Apply
                </Button>
              </div>
            </Field>
            <Field label="Payment method">
              <div className="duration-options">
                {(live
                  ? ["Offline", "Razorpay"]
                  : walkIn
                    ? ["Cash", "UPI"]
                    : ["UPI", "Card", "Wallet"]
                ).map((m) => (
                  <button
                    key={m}
                    disabled={
                      busy ||
                      (live && m === "Razorpay" && !db.paymentOptions?.razorpay)
                    }
                    className={method === m ? "active" : ""}
                    onClick={() => setMethod(m)}
                  >
                    <CreditCard size={17} />
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            {live && !db.paymentOptions?.razorpay && (
              <p className="text-xs mb-4">
                Online payment is not available yet. You can pay offline.
              </p>
            )}
            <div className="payment-demo">
              <ShieldCheck size={17} />
              <div>
                <strong>
                  {live
                    ? method === "Offline"
                      ? "Admin confirmation required"
                      : "Pay securely with Razorpay"
                    : "Demo payment · no money is collected"}
                </strong>
                <p>
                  {live
                    ? method === "Offline"
                      ? "Pay the library admin. Your seat is booked only after the admin confirms receipt, subject to availability. This request does not reserve a seat."
                      : "Your seat is booked after the server verifies your payment. Checkout holds the seat for up to 10 minutes."
                    : "Try the different payment states to preview the full experience."}
                </p>
              </div>
            </div>
            {!live && (
              <Field label="Simulate payment result">
                <select
                  value={outcome}
                  onChange={(e) => {
                    setOutcome(e.target.value);
                    setPayment("idle");
                  }}
                >
                  <option value="success">Successful payment</option>
                  <option value="failed">Failed payment</option>
                  <option value="pending">Pending payment</option>
                </select>
              </Field>
            )}
            {payment === "processing" && (
              <div className="payment-state">
                <LoaderCircle className="animate-spin" /> Processing your
                payment…
              </div>
            )}
            {payment === "failed" && (
              <div className="alert" role="alert">
                {live
                  ? "Booking is not yet confirmed. If money was deducted, check payment status in My bookings before paying again."
                  : "Payment failed. No booking was created and no money was charged. Choose another method or retry."}
              </div>
            )}
            {payment === "pending" && (
              <div className="alert">
                Payment is pending. No seat is booked yet. In this demo, select
                a successful result and try again.
              </div>
            )}
          </div>
          <aside className="checkout-summary">
            <span className="eyebrow">YOUR NEXT STUDY SESSION</span>
            <h3>{lib.name}</h3>
            <div className="detail-list">
              <span>Seat</span>
              <b>{db.seats.find((s) => s.id === seat)?.label}</b>
              <span>Date</span>
              <b>{date}</b>
              <span>Start</span>
              <b>{timeLabel(start)}</b>
              <span>Duration</span>
              <b>{duration} hours</b>
              <span>Subtotal</span>
              <b>{money(price.base)}</b>
              <span>Discount</span>
              <b>−{money(price.discount)}</b>
            </div>
            <div className="checkout-total">
              <span>Total</span>
              <strong>{money(price.total)}</strong>
            </div>
            <Button className="w-full" disabled={busy} onClick={pay}>
              {busy
                ? "Processing…"
                : live
                  ? method === "Offline"
                    ? "Submit offline request"
                    : "Pay with Razorpay"
                  : walkIn
                    ? "Confirm walk-in"
                    : live
                      ? "Confirm booking"
                      : "Pay & confirm"}
              <ArrowRight size={15} />
            </Button>
            <button
              disabled={busy}
              className="link mt-4"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={13} /> Change seat
            </button>
          </aside>
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {step === 3 && result && (
        <div className="booking-success">
          <span className="success-icon">
            <Check size={30} />
          </span>
          <h2>
            {result.status === "Pending payment"
              ? "Waiting for payment confirmation."
              : result.status === "Payment review"
                ? "Your payment needs review."
                : "Your seat is waiting."}
          </h2>
          <p>
            {result.status === "Pending payment"
              ? "Pay the library admin. Your seat will be booked after they confirm payment and availability."
              : result.status === "Payment review"
                ? "Payment was received but the seat could not be booked. Contact the library for a refund. Do not pay again."
                : "Your payment is confirmed and your seat is booked."}
          </p>
          <div className="success-ticket">
            {result.status === "Upcoming" && <QR value={result.id} />}
            <h3>{lib.name}</h3>
            <strong className="tracking-wider">{result.id}</strong>
            <p>
              Seat {db.seats.find((s) => s.id === seat)?.label} · {date}
            </p>
            <p>
              {timeLabel(start)} – {timeLabel(endTime(start, duration))} ·{" "}
              {money(result.amount)}{" "}
              {result.payment === "Paid"
                ? "paid"
                : result.payment === "Refund required"
                  ? "refund required"
                  : "awaiting payment confirmation"}
            </p>
            <Badge
              status={
                result.status === "Upcoming" ? "Confirmed" : result.status
              }
            />
          </div>
          <Button
            onClick={() => {
              onClose();
              navigate(
                session?.role === "student" || !session
                  ? "/student/bookings"
                  : `/${session.role}/bookings`,
              );
            }}
          >
            View bookings <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </Modal>
  );
}
export function MyBookings() {
  const { db, session, live } = useStore();
  const [tab, setTab] = useState(live ? "All" : "Upcoming"),
    [detail, setDetail] = useState(null);
  const guestIds = JSON.parse(
    localStorage.getItem("libra-guest-bookings") || "[]",
  );
  const mine = db.bookings.filter(
    (b) =>
      (session
        ? b.userId === session.id
        : b.userId === db.viewerId || guestIds.includes(b.id)) &&
      (tab === "All" || b.status === tab),
  );
  return (
    <>
      <SectionHeading
        eyebrow="ROOM FOR WHAT MATTERS"
        title="Your study days, all together."
        text="Every booking. Every little step forward."
        action={
          <Button onClick={() => navigate("/student/explore")}>
            Find a space <ArrowRight size={16} />
          </Button>
        }
      />
      <div className="tabs mb-7">
        {[
          ...(live
            ? ["All", "Pending payment", "Payment review", "Rejected"]
            : []),
          "Upcoming",
          "Active",
          "Completed",
          "Cancelled",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="booking-cards">
        {mine.map((b) => {
          const lib = db.libraries.find((l) => l.id === b.libraryId);
          return (
            <article className="my-booking" key={b.id}>
              <img src={lib?.photo} alt={lib?.name} />
              <div>
                <div className="flex justify-between items-center">
                  <Badge status={b.status} />
                  <span className="text-xs text-muted">{b.id}</span>
                </div>
                <h3>{lib?.name}</h3>
                <p>
                  <MapPin size={13} />
                  {lib?.address}
                </p>
                <div className="booking-facts">
                  <span>
                    <CalendarDays size={14} />
                    {b.date}
                  </span>
                  <span>
                    <Clock size={14} />
                    {timeLabel(b.start)} · {b.duration} hours
                  </span>
                  <span>
                    <Armchair size={14} />
                    Seat {db.seats.find((s) => s.id === b.seatId)?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-5">
                  <strong>
                    {money(b.amount)}{" "}
                    <small className="text-muted font-normal">
                      · {b.payment}
                    </small>
                  </strong>
                  <Button variant="secondary" onClick={() => setDetail(b)}>
                    View booking <ArrowUpRight size={14} />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!mine.length && (
        <Empty
          title={`No ${tab.toLowerCase()} bookings yet.`}
          text="Your next great study day is just a seat away."
          action={
            <Button onClick={() => navigate("/student/explore")}>
              Explore libraries
            </Button>
          }
        />
      )}
      {detail && (
        <BookingDetails booking={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
