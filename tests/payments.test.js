import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createPaymentService } from "../server/payments.js";
import { createRazorpay, verifySignature } from "../server/razorpay.js";

function setup() {
  let db = {
    libraries: [
      {
        id: "lib",
        status: "Approved",
        open: "06:00",
        close: "23:00",
        price: 40,
        daily: 250,
      },
    ],
    seats: [{ id: "seat", libraryId: "lib", status: "Available" }],
    bookings: [],
    holds: [],
    notifications: [],
  };
  const actor = { id: "customer", role: "guest" },
    admin = { id: "owner", role: "owner" };
  const input = {
    libraryId: "lib",
    seatId: "seat",
    date: "2099-01-01",
    start: "10:00",
    duration: 2,
    name: "Reader",
    coupon: "",
    requestId: "request-0000000001",
  };
  let count = 0;
  const providerPayments = new Map();
  const razorpay = {
    ...createRazorpay({
      keyId: "test-key",
      keySecret: "test-secret",
      webhookSecret: "webhook-secret",
    }),
    createOrder: async (amount) => ({
      id: `order_${++count}`,
      currency: "INR",
      amount,
    }),
    fetchPayment: async (id) => providerPayments.get(id),
    orderPayments: async (orderId) => ({
      items: [...providerPayments.values()].filter(
        (p) => p.order_id === orderId,
      ),
    }),
  };
  const service = createPaymentService({
    getDb: () => db,
    commit: (next) => {
      db = next;
    },
    razorpay,
    requireManager: (actor) => {
      if (actor.id !== admin.id)
        throw Object.assign(new Error("Forbidden"), { status: 403 });
    },
  });
  const sign = (message, secret = "test-secret") =>
    createHmac("sha256", secret).update(message).digest("hex");
  function paid(order, patch = {}) {
    const payment = {
      id: `pay_${order.orderId}`,
      order_id: order.orderId,
      currency: "INR",
      amount: 8000,
      status: "captured",
      captured: true,
      ...patch,
    };
    providerPayments.set(payment.id, payment);
    return {
      payment,
      proof: {
        bookingId: order.bookingId,
        razorpay_order_id: order.orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: sign(`${order.orderId}|${payment.id}`),
      },
    };
  }
  return {
    service,
    actor,
    admin,
    input,
    paid,
    sign,
    db: () => db,
    save: (next) => {
      db = next;
    },
  };
}

test("offline requests do not reserve seats; only owning admin can confirm once", () => {
  const x = setup();
  x.save(
    x.service.offline(
      {
        ...x.input,
        method: "Offline",
        amount: 1,
        status: "Upcoming",
        payment: "Paid",
      },
      x.actor,
    ),
  );
  const b = x.db().bookings[0];
  assert.equal(b.status, "Pending payment");
  assert.equal(b.payment, "Unpaid");
  assert.equal(b.amount, 80);
  assert.equal(x.db().holds.length, 0);
  assert.throws(() => x.service.confirmOffline(b.id, x.actor), /Forbidden/);
  x.save(x.service.confirmOffline(b.id, x.admin));
  assert.equal(x.db().bookings[0].status, "Upcoming");
  assert.equal(x.db().bookings[0].confirmedBy, x.admin.id);
  const total = x.db().notifications.length;
  x.save(x.service.confirmOffline(b.id, x.admin));
  assert.equal(x.db().notifications.length, total);
});

test("offline confirmation rechecks capacity; rejected requests cannot be paid or checked in", () => {
  const x = setup();
  x.save(x.service.offline({ ...x.input, method: "Offline" }, x.actor));
  const first = x.db().bookings[0];
  x.save(x.service.offline({ ...x.input, method: "Offline" }, { id: "other" }));
  const second = x.db().bookings[0];
  x.save(x.service.confirmOffline(first.id, x.admin));
  assert.throws(
    () => x.service.confirmOffline(second.id, x.admin),
    /no longer available/,
  );
  x.save(x.service.rejectOffline(second.id, x.admin));
  assert.throws(
    () => x.service.confirmOffline(second.id, x.admin),
    /no longer pending/,
  );
});

test("online checkout uses server pricing, holds capacity, and rejects forged or uncaptured payments", async () => {
  const x = setup();
  const order = await x.service.order(
    { ...x.input, amount: 1, payment: "Paid" },
    x.actor,
  );
  assert.equal(order.amount, 8000);
  assert.equal(x.db().bookings[0].status, "Pending payment");
  await assert.rejects(
    x.service.order(
      { ...x.input, requestId: "another-0000000001" },
      { id: "other" },
    ),
    /no longer available/,
  );
  const { proof } = x.paid(order, { status: "authorized", captured: false });
  await assert.rejects(
    x.service.verify({ ...proof, razorpay_signature: "0".repeat(64) }, x.actor),
    /signature/,
  );
  await assert.rejects(x.service.verify(proof, { id: "other" }), /not found/);
  await assert.rejects(x.service.verify(proof, x.actor), /not captured/);
  x.paid(order, { amount: 1 });
  await assert.rejects(x.service.verify(proof, x.actor), /expected amount/);
  x.paid(order);
  await x.service.verify(proof, x.actor);
  assert.equal(x.db().bookings[0].payment, "Paid");
  assert.equal(x.db().bookings[0].status, "Upcoming");
  assert.equal(x.db().holds.length, 0);
});

test("checkout and captured webhook are idempotent; raw webhook signatures are required", async () => {
  const x = setup();
  const [a, b] = await Promise.all([
    x.service.order(x.input, x.actor),
    x.service.order(x.input, x.actor),
  ]);
  assert.equal(a.orderId, b.orderId);
  assert.equal(x.db().bookings.length, 1);
  const { proof, payment } = x.paid(a);
  await x.service.verify(proof, x.actor);
  const raw = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: payment } },
  });
  await assert.rejects(x.service.webhook(raw, "wrong"), /signature/);
  const count = x.db().notifications.length;
  await x.service.webhook(raw, x.sign(raw, "webhook-secret"));
  await x.service.verify(proof, x.actor);
  assert.equal(x.db().notifications.length, count);
});

test("webhook recovers payment after browser closes; late conflicting capture requires refund", async () => {
  const x = setup();
  const order = await x.service.order(x.input, x.actor);
  const { payment, proof } = x.paid(order);
  x.save({ ...x.db(), holds: [] }); // Checkout hold expired.
  x.save(x.service.offline({ ...x.input, method: "Offline" }, { id: "other" }));
  const offline = x.db().bookings[0];
  x.save(x.service.confirmOffline(offline.id, x.admin));
  const raw = JSON.stringify({
    event: "order.paid",
    payload: { payment: { entity: payment } },
  });
  await x.service.webhook(raw, x.sign(raw, "webhook-secret"));
  const late = x.db().bookings.find((b) => b.id === order.bookingId);
  assert.equal(late.status, "Payment review");
  assert.equal(late.payment, "Refund required");
  assert.equal(
    x.db().bookings.filter((b) => b.status === "Upcoming").length,
    1,
  );
  await x.service.verify(proof, x.actor);
  assert.equal(
    x.db().bookings.find((b) => b.id === order.bookingId).status,
    "Payment review",
  );
});

test("reconcile recovers captured payment; canceled request never becomes booked", async () => {
  const x = setup();
  const order = await x.service.order(x.input, x.actor);
  x.paid(order);
  x.save(x.service.cancelPending(order.bookingId, x.actor));
  await x.service.reconcile(order.bookingId, x.actor);
  assert.equal(x.db().bookings[0].status, "Payment review");
  assert.equal(x.db().bookings[0].payment, "Refund required");
});

test("Razorpay transport sends credentials only to provider and signatures reject malformed input", async () => {
  const calls = [];
  const gateway = createRazorpay({
    keyId: "key",
    keySecret: "secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ id: "order_1" }) };
    },
  });
  await gateway.createOrder(8000, "receipt");
  assert.equal(calls[0].url, "https://api.razorpay.com/v1/orders");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    amount: 8000,
    currency: "INR",
    receipt: "receipt",
  });
  assert.equal(verifySignature("body", "", "secret"), false);
  assert.equal(verifySignature("body", "g".repeat(64), "secret"), false);
});
