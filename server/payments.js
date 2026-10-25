import { randomUUID } from "node:crypto";
import { quote, seatState, validateSlot } from "../src/domain.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const now = () => new Date().toISOString();

// All final state transitions are synchronous. Remote provider calls happen before
// reading current state again, so concurrent callbacks cannot overwrite a booking.
export function createPaymentService({
  getDb,
  commit,
  requireManager,
  razorpay,
}) {
  const creating = new Map();
  function validate(p, actor) {
    const db = getDb(),
      lib = db.libraries.find(
        (l) => l.id === p.libraryId && l.status === "Approved",
      );
    const seat = db.seats.find(
      (s) => s.id === p.seatId && s.libraryId === lib?.id,
    );
    if (!lib || !seat) fail("Library or seat is unavailable.", 409);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start) ||
      ![1, 2, 4, 8].includes(p.duration)
    )
      fail("Choose a valid date, time and duration.");
    const date = new Date(`${p.date}T12:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== p.date
    )
      fail("Choose a valid date.");
    validateSlot(lib, p);
    if (seatState(seat, db, p, actor.id) !== "Available")
      fail("That seat is no longer available.", 409);
    const name = typeof p.name === "string" ? p.name.trim().slice(0, 60) : "";
    if (!name) fail("Enter the customer's name.");
    const coupon =
      typeof p.coupon === "string" ? p.coupon.trim().toUpperCase() : "";
    return {
      libraryId: lib.id,
      seatId: seat.id,
      date: p.date,
      start: p.start,
      duration: p.duration,
      name,
      coupon,
      userId: actor.id,
      amount: quote(lib, p.duration, coupon).total,
    };
  }
  function pending(input, method, requestId) {
    return {
      ...input,
      id: `LB-${randomUUID()}`,
      method,
      requestId,
      status: "Pending payment",
      payment: "Unpaid",
      createdAt: now(),
    };
  }
  function notify(db, b, title, message) {
    return [
      {
        id: randomUUID(),
        userId: b.userId,
        title,
        message,
        type: "booking",
        read: false,
      },
      ...db.notifications,
    ];
  }
  function own(id, actor) {
    const b = getDb().bookings.find((b) => b.id === id);
    if (!b || b.userId !== actor.id) fail("Payment request not found.", 404);
    return b;
  }
  function available(b) {
    const db = getDb();
    const lib = db.libraries.find(
      (l) => l.id === b.libraryId && l.status === "Approved",
    );
    const seat = db.seats.find(
      (s) => s.id === b.seatId && s.libraryId === b.libraryId,
    );
    if (!lib || !seat) fail("The library or seat is no longer available.", 409);
    validateSlot(lib, b);
    // Check other holds too, even when another request belongs to this customer.
    const occupancy = {
      ...db,
      holds: db.holds.filter(
        (h) => h.bookingId !== b.id && !(h.userId === b.userId && !h.bookingId),
      ),
    };
    if (seatState(seat, occupancy, b, undefined) !== "Available")
      fail(
        "This seat is no longer available. Do not confirm payment; arrange another seat or return the payment.",
        409,
      );
  }
  function offline(p, actor) {
    if (p.method !== "Offline")
      fail("Choose Offline or use Razorpay Checkout.");
    const input = validate(p, actor),
      db = getDb();
    const existing = db.bookings.find(
      (b) =>
        b.userId === actor.id &&
        b.method === "Offline" &&
        b.status === "Pending payment" &&
        b.seatId === input.seatId &&
        b.date === input.date &&
        b.start === input.start &&
        b.duration === input.duration,
    );
    if (existing) return db;
    const b = pending(input, "Offline");
    return {
      ...db,
      bookings: [b, ...db.bookings],
      holds: db.holds.filter((h) => h.userId !== actor.id || h.bookingId),
      notifications: notify(
        db,
        b,
        "Payment approval needed",
        `${b.id}: pay the library admin. The seat is not booked until payment is confirmed.`,
      ),
    };
  }
  function confirmOffline(id, actor) {
    const db = getDb(),
      b = db.bookings.find((b) => b.id === id);
    if (!b) fail("Request not found.", 404);
    requireManager(actor, b.libraryId);
    if (b.method !== "Offline")
      fail("Razorpay payments must be verified by the payment provider.", 409);
    if (
      b.payment === "Paid" &&
      ["Upcoming", "Active", "Completed"].includes(b.status)
    )
      return db;
    if (b.status !== "Pending payment")
      fail("This request is no longer pending.", 409);
    available(b);
    return {
      ...db,
      bookings: db.bookings.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "Upcoming",
              payment: "Paid",
              paidAt: now(),
              confirmedBy: actor.id,
            }
          : x,
      ),
      notifications: notify(
        db,
        b,
        "Booking confirmed",
        `${b.id}: offline payment received. Your seat is now booked.`,
      ),
    };
  }
  function rejectOffline(id, actor) {
    const db = getDb(),
      b = db.bookings.find((b) => b.id === id);
    if (!b) fail("Request not found.", 404);
    requireManager(actor, b.libraryId);
    if (b.method !== "Offline" || b.status !== "Pending payment")
      fail("Only pending offline requests can be rejected.", 409);
    return {
      ...db,
      bookings: db.bookings.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "Rejected",
              rejectedBy: actor.id,
              rejectedAt: now(),
            }
          : x,
      ),
      notifications: notify(
        db,
        b,
        "Payment request rejected",
        `${b.id}: contact the library about this request.`,
      ),
    };
  }
  function cancelPending(id, actor) {
    const db = getDb(),
      b = db.bookings.find((b) => b.id === id);
    if (!b || b.status !== "Pending payment")
      fail("Request is not pending.", 409);
    // Caller's ownership/manager authorization is checked by the command router.
    return {
      ...db,
      bookings: db.bookings.map((x) =>
        x.id === id ? { ...x, status: "Cancelled", cancelledBy: actor.id } : x,
      ),
      holds: db.holds.filter((h) => h.bookingId !== id),
    };
  }
  function checkout(b) {
    return {
      bookingId: b.id,
      key: razorpay.keyId,
      orderId: b.orderId,
      amount: Math.round(b.amount * 100),
      currency: "INR",
      name: b.name,
    };
  }
  async function order(p, actor) {
    if (!razorpay.enabled)
      fail("Online payment is not configured. Please choose Offline.", 503);
    let b;
    if (p.bookingId) b = own(p.bookingId, actor);
    else {
      if (
        typeof p.requestId !== "string" ||
        !/^[a-zA-Z0-9-]{16,100}$/.test(p.requestId)
      )
        fail("A checkout request ID is required.");
      b = getDb().bookings.find(
        (b) => b.userId === actor.id && b.requestId === p.requestId,
      );
      if (
        b &&
        [
          "libraryId",
          "seatId",
          "date",
          "start",
          "duration",
          "name",
          "coupon",
        ].some((k) => (b[k] || "") !== (p[k] || ""))
      )
        fail(
          "This checkout ID belongs to different booking details. Start a new checkout.",
          409,
        );
      if (!b) {
        const input = validate(p, actor);
        if (
          getDb().holds.some(
            (h) =>
              h.bookingId &&
              h.seatId === input.seatId &&
              h.userId === actor.id &&
              h.expiresAt > Date.now(),
          )
        )
          fail(
            "You already have a payment in progress for this seat. Open it in My bookings.",
            409,
          );
        b = pending(input, "Razorpay", p.requestId);
        commit({ ...getDb(), bookings: [b, ...getDb().bookings] });
      }
    }
    if (b.method !== "Razorpay" || b.status !== "Pending payment")
      fail(
        "This payment request is no longer pending. Check My bookings.",
        409,
      );
    if (creating.has(b.id)) return creating.get(b.id);
    const run = async () => {
      available(b);
      const db = getDb();
      commit({
        ...db,
        holds: [
          ...db.holds.filter(
            (h) =>
              h.bookingId !== b.id && (h.userId !== actor.id || h.bookingId),
          ),
          {
            seatId: b.seatId,
            date: b.date,
            start: b.start,
            duration: b.duration,
            userId: b.userId,
            bookingId: b.id,
            expiresAt: Date.now() + 10 * 60000,
          },
        ],
      });
      if (!b.orderId) {
        const providerOrder = await razorpay.createOrder(
          Math.round(b.amount * 100),
          b.id,
        );
        if (
          !providerOrder.id ||
          providerOrder.amount !== Math.round(b.amount * 100) ||
          providerOrder.currency !== "INR"
        )
          fail("Unexpected payment order response.", 502);
        const current = getDb();
        // Keep a canceled request linked to its provider order for late webhook reconciliation.
        commit({
          ...current,
          bookings: current.bookings.map((x) =>
            x.id === b.id ? { ...x, orderId: providerOrder.id } : x,
          ),
        });
      }
      const updated = getDb().bookings.find((x) => x.id === b.id);
      if (updated.status !== "Pending payment")
        fail("This request was cancelled.", 409);
      return checkout(updated);
    };
    const task = run();
    creating.set(b.id, task);
    try {
      return await task;
    } finally {
      creating.delete(b.id);
    }
  }
  function finalize(payment) {
    const db = getDb(),
      b = db.bookings.find(
        (b) => b.orderId === payment.order_id && b.method === "Razorpay",
      );
    if (!b) fail("Unknown payment order.", 404);
    if (
      payment.status !== "captured" ||
      payment.captured !== true ||
      payment.currency !== "INR" ||
      payment.amount !== Math.round(b.amount * 100) ||
      (payment.amount_refunded || 0) > 0
    )
      fail(
        "Payment is not captured for the expected amount. Check payment status before trying again.",
        409,
      );
    if (b.paymentId) {
      if (b.paymentId !== payment.id)
        fail("A different payment is already linked to this request.", 409);
      return; // Replayed callback/webhook: no duplicate confirmation or notifications.
    }
    if (db.bookings.some((x) => x.paymentId === payment.id))
      fail("Payment is already used.", 409);
    let status = "Upcoming",
      paymentStatus = "Paid",
      message = "Payment verified. Your seat is booked.";
    try {
      if (b.status !== "Pending payment") fail("Request cancelled.", 409);
      available(b);
    } catch {
      status = "Payment review";
      paymentStatus = "Refund required";
      message =
        "Payment received, but this seat could not be booked. Contact the library for a refund. Do not pay again.";
    }
    commit({
      ...db,
      bookings: db.bookings.map((x) =>
        x.id === b.id
          ? {
              ...x,
              status,
              payment: paymentStatus,
              paymentId: payment.id,
              paidAt: now(),
            }
          : x,
      ),
      holds: db.holds.filter((h) => h.bookingId !== b.id),
      notifications: notify(
        db,
        b,
        status === "Upcoming" ? "Booking confirmed" : "Payment needs review",
        `${b.id}: ${message}`,
      ),
    });
  }
  async function verify(p, actor) {
    const b = own(p.bookingId, actor);
    if (
      !b.orderId ||
      p.razorpay_order_id !== b.orderId ||
      !razorpay.verifyCheckout(
        b.orderId,
        p.razorpay_payment_id,
        p.razorpay_signature,
      )
    )
      fail("Invalid payment signature.", 400);
    const payment = await razorpay.fetchPayment(p.razorpay_payment_id);
    if (payment.order_id !== b.orderId || payment.id !== p.razorpay_payment_id)
      fail("Payment does not match this order.", 400);
    finalize(payment);
  }
  async function reconcile(id, actor) {
    const b = getDb().bookings.find((x) => x.id === id);
    if (!b) fail("Request not found.", 404);
    if (b.userId !== actor.id) requireManager(actor, b.libraryId);
    if (b.method !== "Razorpay" || !b.orderId)
      fail("No online payment order to check.");
    const result = await razorpay.orderPayments(b.orderId);
    const payment = result.items?.find(
      (p) => p.order_id === b.orderId && p.status === "captured",
    );
    if (!payment)
      fail(
        "Payment is not captured yet. Wait and check again before paying again.",
        409,
      );
    finalize(payment);
  }
  async function webhook(raw, signature) {
    if (!razorpay.verifyWebhook(raw, signature))
      fail("Invalid webhook signature.", 400);
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      fail("Invalid webhook body.");
    }
    if (!["payment.captured", "order.paid"].includes(event.event)) return;
    const entity = event.payload?.payment?.entity;
    if (
      !entity?.id ||
      !getDb().bookings.some((b) => b.orderId === entity.order_id)
    )
      return;
    const payment = await razorpay.fetchPayment(entity.id);
    if (payment.order_id !== entity.order_id)
      fail("Webhook payment does not match order.");
    finalize(payment);
  }
  return {
    offline,
    confirmOffline,
    rejectOffline,
    cancelPending,
    order,
    verify,
    reconcile,
    webhook,
  };
}
