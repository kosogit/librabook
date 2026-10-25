import { localDate } from "./data.js";
export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
export const minutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const timeLabel = (t) =>
  new Date(`2000-01-01T${t}`).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
export const endTime = (t, h) => {
  const m = minutes(t) + h * 60;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
export const overlap = (a, b) =>
  a.date === b.date &&
  minutes(a.start) < minutes(b.start) + b.duration * 60 &&
  minutes(b.start) < minutes(a.start) + a.duration * 60;
export function seatState(seat, db, slot, ownerId) {
  if (seat.status !== "Available") return seat.status;
  const b = db.bookings.find(
    (b) =>
      b.seatId === seat.id &&
      ["Active", "Upcoming"].includes(b.status) &&
      overlap(b, slot),
  );
  if (b) return b.status === "Active" ? "Occupied" : "Reserved";
  if (
    db.holds.some(
      (h) =>
        h.seatId === seat.id &&
        h.userId !== ownerId &&
        h.expiresAt > Date.now() &&
        overlap(h, slot),
    )
  )
    return "Held";
  return "Available";
}
export function quote(library, duration, coupon = "") {
  const base = duration === 8 ? library.daily : duration * library.price;
  const code = coupon.trim().toUpperCase();
  if (code && code !== "STUDY10")
    throw new Error("That coupon is not valid. Try STUDY10 for 10% off.");
  const discount = code === "STUDY10" ? Math.round(base * 0.1) : 0;
  return { base, discount, total: base - discount };
}
export function validateSlot(library, slot) {
  if (
    !slot.date ||
    !slot.start ||
    !Number.isFinite(slot.duration) ||
    slot.duration <= 0
  )
    throw new Error("Choose a date, time, and duration.");
  if (
    minutes(slot.start) < minutes(library.open) ||
    minutes(slot.start) + slot.duration * 60 > minutes(library.close)
  )
    throw new Error(
      `Choose a session within opening hours (${library.open}–${library.close}).`,
    );
  if (slot.date < localDate())
    throw new Error("Please choose today or a future date.");
}
export function canAccess(role, path) {
  if (path.startsWith("/student")) return role === "student";
  if (path.startsWith("/owner")) return role === "owner";
  if (path.startsWith("/receptionist"))
    return role === "receptionist" || role === "owner";
  if (path.startsWith("/admin")) return role === "admin";
  return true;
}
export function createBooking(db, input) {
  if (
    db.members.some(
      (member) => member.id === input.userId && member.status === "Suspended",
    )
  ) {
    throw new Error(
      "This student account is suspended. Contact the library for assistance.",
    );
  }
  const lib = db.libraries.find((l) => l.id === input.libraryId),
    seat = db.seats.find((s) => s.id === input.seatId);
  if (!lib || lib.status !== "Approved")
    throw new Error("This library is not currently accepting bookings.");
  validateSlot(lib, input);
  if (
    !seat ||
    seat.libraryId !== lib.id ||
    seatState(seat, db, input, input.userId) !== "Available"
  )
    throw new Error(
      "That seat is no longer available. Please select another seat.",
    );
  if (!input.name?.trim()) throw new Error("Enter the student’s name.");
  const amount = quote(lib, input.duration, input.coupon).total;
  const booking = {
    ...input,
    id: `LB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name: input.name.trim(),
    amount,
    status: "Upcoming",
    payment: "Paid",
    createdAt: new Date().toISOString(),
  };
  return {
    ...db,
    bookings: [booking, ...db.bookings],
    holds: db.holds.filter((h) => h.userId !== input.userId),
    notifications: [
      {
        id: crypto.randomUUID(),
        userId: input.userId,
        title: "Booking confirmed",
        message: `Your seat at ${lib.name} is booked. ${booking.id}`,
        type: "booking",
        read: false,
      },
      {
        id: crypto.randomUUID(),
        userId: input.userId,
        title: "Payment successful",
        message: `${money(amount)} received via ${input.method}. Your demo receipt is ${booking.id}.`,
        type: "payment",
        read: false,
      },
      ...db.notifications,
    ],
  };
}
export function changeBooking(db, id, action, actor) {
  if (!actor)
    throw new Error(
      "Sign in or open your guest booking on the device where it was created.",
    );
  const b = db.bookings.find((b) => b.id === id);
  if (!b) throw new Error("Booking not found.");
  if (actor.role === "student" && b.userId !== actor.id)
    throw new Error("This booking belongs to another student.");
  let patch = {};
  if (action === "cancel") {
    if (!["Upcoming", "Active"].includes(b.status))
      throw new Error("This booking cannot be cancelled.");
    patch = { status: "Cancelled", payment: "Refunded" };
  } else if (action === "checkin") {
    if (b.status !== "Upcoming")
      throw new Error("Only upcoming bookings can be checked in.");
    if (b.date !== localDate())
      throw new Error("Check-in is available on your booking date.");
    patch = { status: "Active", checkedInAt: new Date().toISOString() };
  } else if (action === "checkout") {
    if (b.status !== "Active")
      throw new Error("Only active bookings can be checked out.");
    patch = { status: "Completed", checkedOutAt: new Date().toISOString() };
  } else if (action === "extend") {
    if (!["Active", "Upcoming"].includes(b.status))
      throw new Error("This booking cannot be extended.");
    const slot = { ...b, duration: b.duration + 1 };
    const lib = db.libraries.find((l) => l.id === b.libraryId);
    validateSlot(lib, slot);
    if (
      db.bookings.some(
        (other) =>
          other.id !== id &&
          other.seatId === b.seatId &&
          ["Upcoming", "Active"].includes(other.status) &&
          overlap(other, slot),
      )
    )
      throw new Error("The next hour is already booked.");
    if (
      db.holds.some(
        (h) =>
          h.seatId === b.seatId && h.expiresAt > Date.now() && overlap(h, slot),
      )
    )
      throw new Error("The next hour is held by another student.");
    patch = { duration: slot.duration, amount: b.amount + lib.price };
  } else throw new Error("Unsupported booking action.");
  return {
    ...db,
    bookings: db.bookings.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    notifications: [
      {
        id: crypto.randomUUID(),
        userId: b.userId,
        title: `Booking ${action === "cancel" ? "cancelled" : action === "extend" ? "extended" : action === "checkin" ? "checked in" : "completed"}`,
        message: `${b.id} has been updated.${action === "cancel" ? " Your demo payment was refunded." : ""}`,
        type: "booking",
        read: false,
      },
      ...db.notifications,
    ],
  };
}
export function distanceKm(a, b) {
  const r = Math.PI / 180,
    dLat = (b.lat - a.lat) * r,
    dLng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Browser-demo reminders. A production backend owns these timers and delivery.
export function refreshReminders(db, now = new Date()) {
  const notifications = [...db.notifications];
  let changed = false;
  const add = (booking, kind, title, message) => {
    const id = `${booking.id}:${kind}:${booking.duration}`;
    if (!notifications.some((n) => n.id === id)) {
      notifications.unshift({
        id,
        userId: booking.userId,
        title,
        message,
        type: "reminder",
        read: false,
      });
      changed = true;
    }
  };
  const bookings = db.bookings.map((b) => {
    if (!["Upcoming", "Active"].includes(b.status)) return b;
    const start = new Date(`${b.date}T${b.start}:00`).getTime();
    const end = start + b.duration * 3600000;
    const time = now.getTime();
    if (time >= end) {
      add(
        b,
        "expired",
        "Your study session has ended",
        `${b.id} has expired. The seat is available for its next chapter.`,
      );
      changed = true;
      return { ...b, status: "Completed", expiredAt: now.toISOString() };
    }
    if (b.status === "Active" && end - time <= 15 * 60000)
      add(
        b,
        "expiry-warning",
        "A little time check",
        `${b.id} ends in less than 15 minutes. Extend if you need a little more room.`,
      );
    if (b.status === "Upcoming" && time >= start)
      add(
        b,
        "checkin",
        "Your seat is ready",
        `Check in with your booking code ${b.id} when you arrive.`,
      );
    if (
      b.status === "Upcoming" &&
      start - time > 0 &&
      start - time <= 30 * 60000
    )
      add(
        b,
        "upcoming",
        "Your next good study day is close",
        `${b.id} starts in less than 30 minutes. We’ll see you soon.`,
      );
    return b;
  });
  return changed ? { ...db, bookings, notifications } : db;
}
