import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Download,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Wifi,
  Wind,
  Zap,
  X,
  LockKeyhole,
  Camera,
  QrCode,
  AlertCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { useStore } from "./store";
import { payWithRazorpay } from "./payments";
import { api } from "./api";
import { seatState, money, timeLabel, endTime } from "./domain";
export const navigate = (path) => {
  location.hash = path;
};
export function usePath() {
  const [path, setPath] = useState(location.hash.slice(1) || "/student/home");
  useEffect(() => {
    const fn = () => setPath(location.hash.slice(1) || "/student/home");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return path;
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button className={`btn ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Badge({ children, status }) {
  return (
    <span
      className={`badge ${String(status || children)
        .toLowerCase()
        .replaceAll(" ", "-")}`}
    >
      <i />
      {children || status}
    </span>
  );
}
export function Avatar({ name = "Guest", large = false }) {
  return (
    <span className={`avatar ${large ? "large" : ""}`}>
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Empty({
  title = "A fresh page.",
  text = "Nothing here just yet.",
  action,
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <BookOpen />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Field({ label, children, hint, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SectionHeading({ eyebrow, title, text, action }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  suspended = false,
}) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    if (suspended) d.close();
    else if (!d.open) d.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [suspended]);
  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = e.target.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
export function QR({ value, size = 160, download }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: { dark: "#153d36", light: "#ffffff" },
    })
      .then((u) => active && setUrl(u))
      .catch(() => setError("QR unavailable. Use the booking code."));
    return () => {
      active = false;
    };
  }, [value, size]);
  return url ? (
    <>
      <img src={url} width={size} height={size} alt="Scannable QR code" />
      {download && (
        <a className="btn secondary" href={url} download={download}>
          Download QR code
        </a>
      )}
    </>
  ) : (
    <span>{error || "Generating QR…"}</span>
  );
}
export function Facilities({ items }) {
  return (
    <div className="facilities">
      {items.map((x) => {
        const Icon =
          x === "Wi-Fi"
            ? Wifi
            : x === "AC"
              ? Wind
              : x === "Charging"
                ? Zap
                : x === "Lockers"
                  ? LockKeyhole
                  : Check;
        return (
          <span key={x}>
            <Icon size={13} />
            {x}
          </span>
        );
      })}
    </div>
  );
}
export function SeatMap({
  libraryId,
  slot,
  selected,
  onSelect,
  manage = false,
}) {
  const { db, session } = useStore();
  const [floor, setFloor] = useState(1);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10000);
    return () => clearInterval(t);
  }, []);
  const seats = db.seats.filter(
    (s) => s.libraryId === libraryId && s.floor === floor,
  );
  return (
    <div className="seat-map-wrap">
      <div className="flex items-center justify-between gap-3 mb-5">
        <select
          aria-label="Floor"
          value={floor}
          onChange={(e) => setFloor(Number(e.target.value))}
        >
          {[
            ...new Set(
              db.seats
                .filter((s) => s.libraryId === libraryId)
                .map((s) => s.floor),
            ),
          ]
            .sort()
            .map((f) => (
              <option key={f} value={f}>
                Floor {f} · {f === 1 ? "Quiet study" : "Focus zone"}
              </option>
            ))}
        </select>
        <span className="text-xs text-muted">
          {
            seats.filter(
              (s) => seatState(s, db, slot, session?.id) === "Available",
            ).length
          }{" "}
          available
        </span>
      </div>
      <div className="seat-legend">
        {["Available", "Occupied", "Reserved", "Held", "Protected"].map((s) => (
          <span key={s}>
            <i className={s.toLowerCase()} />
            {s}
          </span>
        ))}
      </div>
      <div className="seat-room">
        <div className="windows">NATURAL LIGHT. FRESH IDEAS.</div>
        <div className="seats-grid">
          {seats.map((s) => {
            const state = seatState(s, db, slot, session?.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`Seat ${s.label}, ${s.type}, ${state}`}
                disabled={!manage && state !== "Available"}
                onClick={() => onSelect(s)}
                className={`seat ${state.toLowerCase()} ${selected === s.id ? "selected" : ""}`}
                title={`${s.type} · ${state}`}
              >
                <Armchair size={22} />
                <span>{s.label}</span>
                {s.type === "Premium" && <i className="premium-mark">✦</i>}
              </button>
            );
          })}
        </div>
        {!seats.length && (
          <Empty text="Add seats to this floor to get started." />
        )}
        <div className="entrance">
          <span /> ENTRANCE <ArrowUpRight size={12} />
          <span />
        </div>
      </div>
    </div>
  );
}
export function LibraryCard({ library, slot, saved, onSave }) {
  const { db } = useStore();
  const available = db.seats.filter(
    (s) => s.libraryId === library.id && seatState(s, db, slot) === "Available",
  ).length;
  return (
    <article className="library-card group">
      <button
        className="library-image"
        onClick={() => navigate(`/library/${library.id}`)}
        aria-label={`View ${library.name}`}
      >
        <img
          src={library.photo}
          alt={`${library.name} study space`}
          loading="lazy"
        />
        {library.featured && (
          <span className="image-label">
            <Star size={11} fill="currentColor" /> COMMUNITY FAVORITE
          </span>
        )}
        <span className="image-arrow">
          <ArrowUpRight size={20} />
        </span>
      </button>
      <button
        className={`save-library ${saved ? "saved" : ""}`}
        aria-label={saved ? "Unsave library" : "Save library"}
        onClick={onSave}
      >
        {saved ? "♥" : "♡"}
      </button>
      <div className="library-content">
        <div className="flex justify-between items-center gap-2">
          <h3>
            <button onClick={() => navigate(`/library/${library.id}`)}>
              {library.name}
            </button>
          </h3>
          <span className="rating">
            <Star size={12} fill="currentColor" />
            {library.rating}
          </span>
        </div>
        <p className="location">
          <MapPin size={12} />
          {library.address}
          <span>
            {Number.isFinite(library.distance)
              ? `· ${library.distance.toFixed(1)} km`
              : "Distance unavailable"}
          </span>
        </p>
        <Facilities items={library.facilities.slice(0, 3)} />
        <div className="library-bottom">
          <span>
            <strong>{money(library.price)}</strong>
            <small> / hour</small>
          </span>
          <span className="availability">
            <i />
            {available} seats available
          </span>
        </div>
      </div>
    </article>
  );
}
export function BookingDetails({ booking, onClose }) {
  const { db, session, updateBooking, notify, live, mutate, reload } =
    useStore();
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false);
  const b = db.bookings.find((x) => x.id === booking.id) || booking,
    lib = db.libraries.find((l) => l.id === b.libraryId),
    seat = db.seats.find((s) => s.id === b.seatId);
  async function act(action) {
    setBusy(true);
    try {
      if (action === "confirmOffline" || action === "rejectOffline")
        await mutate((d) => d, {
          type: `payment.${action}`,
          payload: { id: b.id },
        });
      else await updateBooking(b.id, action);
      notify("Booking updated.");
      setConfirm("");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function online(resume) {
    setBusy(true);
    try {
      if (resume)
        await payWithRazorpay(
          { bookingId: b.id },
          {
            onOpen: () => setGatewayOpen(true),
            onClose: () => setGatewayOpen(false),
          },
        );
      else
        await api.request("/payments/reconcile", {
          method: "POST",
          body: { id: b.id },
        });
      await reload(true);
      notify("Payment status updated.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  const pending = b.status === "Pending payment";
  const manager =
    session?.role === "admin" ||
    (session?.role === "owner" && lib?.ownerId === session.id);
  const confirmed = ["Upcoming", "Active", "Completed"].includes(b.status);
  return (
    <Modal
      title="Your study session"
      suspended={gatewayOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="booking-ticket">
        <Badge status={b.status} />
        <h3>{lib?.name}</h3>
        <p>{lib?.address}</p>
        {confirmed && (
          <div className="ticket-qr">
            <QR value={b.id} />
            <strong>{b.id}</strong>
            <button
              className="link"
              onClick={async () => {
                try {
                  const url = await QRCode.toDataURL(b.id, {
                    width: 600,
                    margin: 3,
                  });
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${b.id}.png`;
                  a.click();
                } catch {
                  notify(
                    "Could not save the QR. Use your booking code instead.",
                    "error",
                  );
                }
              }}
            >
              <Download size={13} /> Save booking QR
            </button>
          </div>
        )}
        {pending && (
          <p className="body-copy">
            {b.method === "Offline"
              ? "Not booked yet. Pay the library admin and wait for payment approval. The seat remains available to others."
              : "Not booked yet. Complete checkout or check your payment status before paying again."}
          </p>
        )}
        {b.payment === "Refund required" && (
          <p className="body-copy">
            A refund is required. Contact the library; refunds must be processed
            separately. This is not a confirmed booking.
          </p>
        )}
        <div className="detail-list">
          <span>Seat</span>
          <b>
            {seat?.label || "—"} · {seat?.type}
          </b>
          <span>Date</span>
          <b>{b.date}</b>
          <span>Time</span>
          <b>
            {timeLabel(b.start)} – {timeLabel(endTime(b.start, b.duration))}
          </b>
          <span>Duration</span>
          <b>{b.duration} hours</b>
          <span>Payment</span>
          <b>
            {money(b.amount)} · {b.payment}
          </b>
          <span>Student</span>
          <b>{b.name}</b>
          <span>Payment method</span>
          <b>{b.method}</b>
          {b.confirmedBy && (
            <>
              <span>Confirmed by admin</span>
              <b>{new Date(b.paidAt).toLocaleString()}</b>
            </>
          )}
        </div>
      </div>
      {confirm ? (
        <div className="confirmation">
          <p>
            {confirm === "confirmOffline"
              ? `Confirm that you received ${money(b.amount)} offline? The seat will be booked only if it is still available.`
              : confirm === "rejectOffline"
                ? "Reject this unpaid request? No seat will be booked."
                : confirm === "cancel"
                  ? "Cancel this booking and release the seat?"
                  : `Extend by one hour for ${money(lib.price)}? ${live ? "Pay the additional amount at the library." : "This is a simulated additional payment."}`}
          </p>
          <div className="flex gap-2 mt-3">
            <Button disabled={busy} onClick={() => act(confirm)}>
              {confirm === "confirmOffline"
                ? "Confirm payment received"
                : confirm === "rejectOffline"
                  ? "Reject request"
                  : `Confirm ${confirm === "cancel" ? "cancellation" : "extension"}`}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm("")}>
              Keep booking
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-5">
          {live && pending && b.method === "Offline" && manager && (
            <>
              <Button
                disabled={busy}
                onClick={() => setConfirm("confirmOffline")}
              >
                Confirm offline payment
              </Button>
              <Button
                disabled={busy}
                variant="danger"
                onClick={() => setConfirm("rejectOffline")}
              >
                Reject offline request
              </Button>
            </>
          )}
          {live &&
            b.method === "Razorpay" &&
            ["Pending payment", "Cancelled"].includes(b.status) && (
              <>
                {pending && b.userId === db.viewerId && (
                  <Button disabled={busy} onClick={() => online(true)}>
                    Pay with Razorpay
                  </Button>
                )}
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() => online(false)}
                >
                  Check payment status
                </Button>
              </>
            )}
          {b.status === "Upcoming" &&
            (!live ||
              ["owner", "admin", "receptionist"].includes(session?.role)) && (
              <Button disabled={busy} onClick={() => act("checkin")}>
                Check in <Check size={15} />
              </Button>
            )}
          {b.status === "Active" &&
            (!live ||
              ["owner", "admin", "receptionist"].includes(session?.role)) && (
              <Button disabled={busy} onClick={() => act("checkout")}>
                Check out & release seat
              </Button>
            )}
          {["Pending payment", "Active", "Upcoming"].includes(b.status) && (
            <>
              {!live && (
                <Button
                  variant="secondary"
                  onClick={() => setConfirm("extend")}
                >
                  Extend +1 hour
                </Button>
              )}
              <Button variant="danger" onClick={() => setConfirm("cancel")}>
                Cancel booking
              </Button>
            </>
          )}
          {confirmed && (
            <Button
              variant="ghost"
              onClick={() => {
                const blob = new Blob(
                  [
                    `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${b.id}\nDTSTAMP:${b.date.replaceAll("-", "")}T000000\nDTSTART:${b.date.replaceAll("-", "")}T${b.start.replace(":", "")}00\nDTEND:${b.date.replaceAll("-", "")}T${endTime(b.start, b.duration).replace(":", "")}00\nSUMMARY:Study session at ${lib.name}\nEND:VEVENT\nEND:VCALENDAR`,
                  ],
                  { type: "text/calendar" },
                );
                downloadBlob(blob, `${b.id}.ics`);
              }}
            >
              <Download size={15} /> Calendar
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Scanner({ onCode }) {
  const video = useRef(),
    stream = useRef(),
    timer = useRef();
  const [active, setActive] = useState(false),
    [error, setError] = useState("");
  const stop = () => {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setActive(false);
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function start() {
    setError("");
    if (!("BarcodeDetector" in window)) {
      setError(
        "QR scanning is not supported in this browser. Please enter the booking code below.",
      );
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setActive(true);
      setTimeout(async () => {
        if (!video.current) return;
        video.current.srcObject = stream.current;
        await video.current.play();
        const scan = async () => {
          try {
            const codes = await detector.detect(video.current);
            if (codes.length) {
              onCode(codes[0].rawValue);
              stop();
              return;
            }
          } catch {}
          timer.current = setTimeout(scan, 350);
        };
        scan();
      }, 100);
    } catch {
      stop();
      setError(
        "Camera access was denied or unavailable. Use manual code entry.",
      );
    }
  }
  return (
    <>
      <div className="scanner-frame">
        {active ? (
          <video ref={video} muted playsInline aria-label="QR scanner camera" />
        ) : (
          <>
            <QrCode size={76} strokeWidth={1} />
            <p>Point your camera at the booking QR</p>
            <Button variant="secondary" onClick={start}>
              <Camera size={16} /> Enable camera
            </Button>
          </>
        )}
      </div>
      {active && (
        <Button variant="secondary" onClick={stop}>
          Stop camera
        </Button>
      )}
      {error && (
        <div role="alert" className="alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </>
  );
}
