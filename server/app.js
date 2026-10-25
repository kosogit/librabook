import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { addLibrary } from "../src/workspace.js";
import { createPaymentService } from "./payments.js";
import { createRazorpay } from "./razorpay.js";
import { changeBooking, seatState, validateSlot } from "../src/domain.js";

const derive = promisify(scrypt);
const empty = () =>
  Object.fromEntries(
    [
      "libraries",
      "seats",
      "members",
      "bookings",
      "holds",
      "notifications",
      "complaints",
      "reviews",
      "accounts",
      "sessions",
    ].map((k) => [k, []]),
  );
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const text = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

export function createBackend({
  file = resolve(process.env.LIBRA_DATA_FILE || "data/workspace.json"),
  secure = process.env.NODE_ENV === "production",
  razorpay = createRazorpay(),
} = {}) {
  let db;
  try {
    db = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    db = empty();
  }
  const clients = new Set(),
    attempts = new Map();
  // Migrate the old pay-at-library reservations to requests awaiting approval.
  db.bookings = db.bookings.map((b) =>
    b.payment === "Unpaid" && b.status === "Upcoming"
      ? { ...b, status: "Pending payment", method: "Offline" }
      : b,
  );
  function commit(next) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify(next), { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
    db = next;
    for (const res of clients) res.write("data: update\n\n");
  }
  const manages = (actor, id) =>
    actor.role === "admin" ||
    db.libraries.some(
      (l) => l.id === id && l.ownerId === actor.id && actor.role === "owner",
    );
  const requireManager = (actor, id) => {
    if (!manages(actor, id)) fail("You cannot manage this library.", 403);
  };
  const payments = createPaymentService({
    getDb: () => db,
    commit,
    requireManager,
    razorpay,
  });
  function snapshot(actor) {
    const libraries = db.libraries.filter(
      (l) => l.status === "Approved" || manages(actor, l.id),
    );
    const ids = new Set(libraries.map((l) => l.id));
    const visible = (b) => b.userId === actor.id || manages(actor, b.libraryId);
    const customerIds = new Set(
      db.bookings
        .filter((b) => manages(actor, b.libraryId))
        .map((b) => b.userId),
    );
    return {
      viewerId: actor.id,
      paymentOptions: { offline: true, razorpay: razorpay.enabled },
      libraries,
      seats: db.seats.filter((s) => ids.has(s.libraryId)),
      bookings: db.bookings
        .filter((b) => ids.has(b.libraryId) || visible(b))
        .map((b) =>
          visible(b)
            ? b
            : {
                id: b.id,
                libraryId: b.libraryId,
                seatId: b.seatId,
                date: b.date,
                start: b.start,
                duration: b.duration,
                status: b.status,
              },
        ),
      holds: db.holds
        .filter((h) => h.expiresAt > Date.now())
        .map((h) => ({
          ...h,
          userId: h.userId === actor.id ? actor.id : "another-customer",
        })),
      members: db.members.filter(
        (m) =>
          m.id === actor.id || actor.role === "admin" || customerIds.has(m.id),
      ),
      notifications: db.notifications.filter((n) => n.userId === actor.id),
      reviews: db.reviews.filter((r) => ids.has(r.libraryId)),
      complaints: db.complaints.filter(
        (c) => c.userId === actor.id || actor.role === "admin",
      ),
    };
  }
  function session(req, res) {
    const token = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("libra_session="))
      ?.slice(14);
    const existing = db.sessions.find(
      (s) => s.token === token && s.expiresAt > Date.now(),
    );
    if (existing) return existing;
    const s = {
      token: randomBytes(32).toString("hex"),
      userId: `guest-${randomUUID()}`,
      expiresAt: Date.now() + 30 * 86400000,
    };
    commit({
      ...db,
      sessions: [...db.sessions.filter((s) => s.expiresAt > Date.now()), s],
    });
    cookie(res, s.token);
    return s;
  }
  function cookie(res, token) {
    res.setHeader(
      "Set-Cookie",
      `libra_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure ? "; Secure" : ""}`,
    );
  }
  function libraryInput(p, existing, actor) {
    const l = {
      id: existing?.id || text(p.id, 100) || randomUUID(),
      name: text(p.name),
      address: text(p.address, 500),
      open: text(p.open, 5),
      close: text(p.close, 5),
      rules: text(p.rules, 3000),
      facilities: Array.isArray(p.facilities)
        ? p.facilities.filter((f) => typeof f === "string").slice(0, 20)
        : [],
      ownerId: existing?.ownerId || actor.id,
      owner: existing?.owner || actor.name,
      status: existing?.status || "Approved",
      rating: existing?.rating || 0,
      reviews: existing?.reviews || 0,
      photo: "/images/studyhub.jpg",
      photos: [],
      lat: null,
      lng: null,
      distance: null,
    };
    if (
      !l.name ||
      !l.address ||
      !/^\d{2}:\d{2}$/.test(l.open) ||
      !/^\d{2}:\d{2}$/.test(l.close) ||
      l.open >= l.close ||
      l.close > "23:59" ||
      l.open > "23:59"
    )
      fail("Enter a name, address, and valid opening hours.");
    for (const k of ["price", "daily", "weekly", "monthly", "custom"]) {
      l[k] = Number(p[k]);
      if (
        !Number.isFinite(l[k]) ||
        l[k] < (k === "custom" ? 0 : 1) ||
        l[k] > 1000000
      )
        fail("Enter valid prices.");
    }
    const validPhoto = (v) =>
      typeof v === "string" &&
      (v.startsWith("/images/") ||
        /^data:image\/(png|jpeg|webp|gif);base64,/.test(v));
    if (validPhoto(p.photo)) l.photo = p.photo;
    if (Array.isArray(p.photos))
      l.photos = p.photos.filter(validPhoto).slice(0, 3);
    if (p.lat != null || p.lng != null) {
      if (
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lng) ||
        Math.abs(p.lat) > 90 ||
        Math.abs(p.lng) > 180
      )
        fail("Enter valid coordinates.");
      l.lat = p.lat;
      l.lng = p.lng;
    }
    if (
      actor.role === "admin" &&
      ["Approved", "Pending", "Suspended"].includes(p.status)
    )
      l.status = p.status;
    return l;
  }
  function command(type, p, actor) {
    if (type === "booking.create") return payments.offline(p, actor);
    if (type === "payment.confirmOffline")
      return payments.confirmOffline(p.id, actor);
    if (type === "payment.rejectOffline")
      return payments.rejectOffline(p.id, actor);
    if (type === "library.create") {
      if (!["owner", "admin"].includes(actor.role))
        fail("Sign in as a library admin.", 403);
      const library = libraryInput(p.library || {}, null, actor);
      const next = addLibrary(db, library, p.seatCount, actor);
      // Registered library admins publish their own spaces immediately.
      next.libraries[0].status = "Approved";
      return next;
    }
    if (type === "libraries.save") {
      const old = db.libraries.find((l) => l.id === p.id);
      if (!old) fail("Library not found.", 404);
      requireManager(actor, old.id);
      const library = libraryInput(p, old, actor);
      return {
        ...db,
        libraries: db.libraries.map((l) => (l.id === old.id ? library : l)),
      };
    }
    if (type === "seats.save" || type === "seats.delete") {
      const old = db.seats.find((s) => s.id === p.id);
      const libraryId = old?.libraryId || p.libraryId;
      requireManager(actor, libraryId);
      if (type === "seats.delete") {
        if (
          db.bookings.some(
            (b) =>
              b.seatId === p.id && ["Active", "Upcoming"].includes(b.status),
          )
        )
          fail("This seat has active bookings.");
        return { ...db, seats: db.seats.filter((s) => s.id !== p.id) };
      }
      const seat = {
        id: old?.id || randomUUID(),
        libraryId,
        label: text(p.label, 20),
        floor: Number(p.floor),
        type: p.type,
        status: p.status,
      };
      if (
        !seat.label ||
        !Number.isInteger(seat.floor) ||
        !["Regular", "Premium", "Private cabin"].includes(seat.type) ||
        !["Available", "Maintenance", "Protected"].includes(seat.status)
      )
        fail("Enter valid seat details.");
      if (
        db.seats.some(
          (s) =>
            s.id !== seat.id &&
            s.libraryId === libraryId &&
            s.label === seat.label,
        )
      )
        fail("Seat label already exists.");
      return {
        ...db,
        seats: [...db.seats.filter((s) => s.id !== seat.id), seat],
      };
    }
    if (type === "hold.release")
      return {
        ...db,
        holds: db.holds.filter((h) => h.userId !== actor.id || h.bookingId),
      };
    if (type === "hold.create") {
      const seat = db.seats.find((s) => s.id === p.seatId);
      const lib = db.libraries.find(
        (l) => l.id === seat?.libraryId && l.status === "Approved",
      );
      if (!lib || (type === "booking.create" && p.libraryId !== lib.id))
        fail("Library or seat is unavailable.");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start) ||
        ![1, 2, 4, 8].includes(p.duration)
      )
        fail("Choose a valid date, time and duration.");
      const slot = { date: p.date, start: p.start, duration: p.duration };
      validateSlot(lib, slot);
      if (seatState(seat, db, slot, actor.id) !== "Available")
        fail("That seat is no longer available.", 409);
      if (type === "hold.create")
        return {
          ...db,
          holds: [
            ...db.holds.filter(
              (h) =>
                (h.userId !== actor.id || h.bookingId) &&
                h.expiresAt > Date.now(),
            ),
            {
              ...slot,
              seatId: seat.id,
              userId: actor.id,
              expiresAt: Date.now() + 300000,
            },
          ],
        };
    }
    if (type.startsWith("booking.")) {
      const booking = db.bookings.find((b) => b.id === p.id);
      if (
        !booking ||
        (booking.userId !== actor.id && !manages(actor, booking.libraryId))
      )
        fail("Booking not found.", 404);
      const action = type.slice(8);
      if (booking.status === "Pending payment" && action === "cancel")
        return payments.cancelPending(booking.id, actor);
      if (action === "extend")
        fail(
          "Please make a separate booking for extra time so payment can be verified.",
        );
      if (
        ["checkin", "checkout"].includes(action) &&
        booking.payment !== "Paid"
      )
        fail("Payment must be confirmed before check-in.", 409);
      if (["checkin", "checkout"].includes(action))
        requireManager(actor, booking.libraryId);
      const next = changeBooking(
        db,
        p.id,
        action,
        manages(actor, booking.libraryId)
          ? actor
          : { ...actor, role: "student" },
      );
      next.bookings = next.bookings.map((b) =>
        b.id === p.id
          ? {
              ...b,
              payment:
                action === "cancel" && booking.payment === "Paid"
                  ? "Refund required"
                  : booking.payment,
            }
          : b,
      );
      next.notifications = next.notifications.map((n) => ({
        ...n,
        message: n.message.replace(" Your demo payment was refunded.", ""),
      }));
      return next;
    }
    if (type === "notifications.read" || type === "notifications.readAll")
      return {
        ...db,
        notifications: db.notifications.map((n) =>
          n.userId === actor.id && (type.endsWith("readAll") || n.id === p.id)
            ? { ...n, read: true }
            : n,
        ),
      };
    if (type === "members.save") {
      if (p.id !== actor.id || actor.role === "guest")
        fail("You can only edit your own profile.", 403);
      const name = text(p.name, 60);
      if (!name) fail("Enter your name.");
      return {
        ...db,
        accounts: db.accounts.map((u) =>
          u.id === actor.id ? { ...u, name } : u,
        ),
        members: db.members.map((u) =>
          u.id === actor.id ? { ...u, name } : u,
        ),
      };
    }
    fail("This action is not supported by the shared server.");
  }
  async function body(req) {
    let raw = "",
      size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) fail("Request is too large.", 413);
      raw += chunk;
    }
    return raw;
  }
  function parseBody(raw) {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      fail("Invalid JSON.");
    }
  }
  return async function middleware(req, res, next) {
    const path = req.url.split("?")[0];
    if (!path.startsWith("/api/")) return next();
    const send = (data, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === "POST" && path === "/api/payments/webhook") {
        const raw = await body(req);
        await payments.webhook(raw, req.headers["x-razorpay-signature"]);
        return send({ received: true });
      }
      if (!["GET", "POST"].includes(req.method))
        fail("Method not allowed.", 405);
      if (req.method === "POST") {
        const origin = req.headers.origin;
        if (
          req.headers["sec-fetch-site"] === "cross-site" ||
          (origin && new URL(origin).host !== req.headers.host)
        )
          fail("Cross-origin writes are not allowed.", 403);
        if (!req.headers["content-type"]?.startsWith("application/json"))
          fail("JSON content required.", 415);
      }
      const s = session(req, res);
      const account = db.accounts.find((u) => u.id === s.userId);
      const actor = account
        ? publicUser(account)
        : { id: s.userId, role: "guest" };
      if (req.method === "GET" && path === "/api/auth/session")
        return send(account ? actor : null);
      if (req.method === "GET" && path === "/api/workspace")
        return send(snapshot(actor));
      if (req.method === "GET" && path === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        clients.add(res);
        const timer = setInterval(() => res.write(": keepalive\n\n"), 25000);
        req.on("close", () => {
          clearInterval(timer);
          clients.delete(res);
        });
        return;
      }
      if (req.method !== "POST") fail("Not found.", 404);
      const p = parseBody(await body(req));
      if (path === "/api/payments/order")
        return send(await payments.order(p, actor));
      if (path === "/api/payments/verify") {
        await payments.verify(p, actor);
        return send(snapshot(actor));
      }
      if (path === "/api/payments/reconcile") {
        await payments.reconcile(p.id, actor);
        return send(snapshot(actor));
      }
      if (path === "/api/auth/signup" || path === "/api/auth/login") {
        const key = req.socket.remoteAddress;
        const recent = (attempts.get(key) || []).filter(
          (t) => t > Date.now() - 60000,
        );
        if (recent.length >= 20)
          fail("Too many attempts. Try again in a minute.", 429);
        attempts.set(key, [...recent, Date.now()]);
        const email = text(p.email, 254).toLowerCase(),
          password = p.password;
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          typeof password !== "string" ||
          password.length < 8 ||
          password.length > 200
        )
          fail("Enter a valid email and password (8–200 characters).");
        let user;
        if (path.endsWith("signup")) {
          const salt = randomBytes(16).toString("hex");
          const hash = (await derive(password, salt, 64)).toString("hex");
          if (db.accounts.some((u) => u.email === email))
            fail("An account with this email already exists.", 409);
          const name = text(p.name, 60);
          if (!name) fail("Enter your name.");
          user = {
            id: randomUUID(),
            name,
            email,
            role: p.role === "owner" ? "owner" : "student",
            salt,
            hash,
          };
        } else {
          user = db.accounts.find((u) => u.email === email);
          const hash = await derive(
            password,
            user?.salt || "invalid-account-salt",
            64,
          );
          if (!user || !timingSafeEqual(hash, Buffer.from(user.hash, "hex")))
            fail("Email or password is incorrect.", 401);
        }
        const token = randomBytes(32).toString("hex");
        const newAccount = !db.accounts.some((u) => u.id === user.id);
        commit({
          ...db,
          accounts: newAccount ? [...db.accounts, user] : db.accounts,
          members: newAccount
            ? [
                ...db.members,
                { ...publicUser(user), membership: "Hourly", status: "Active" },
              ]
            : db.members,
          bookings: db.bookings.map((b) =>
            b.userId === actor.id && actor.role === "guest"
              ? { ...b, userId: user.id }
              : b,
          ),
          sessions: [
            ...db.sessions.filter((x) => x.token !== s.token),
            { token, userId: user.id, expiresAt: Date.now() + 30 * 86400000 },
          ],
        });
        cookie(res, token);
        return send({ session: publicUser(user) });
      }
      if (path === "/api/auth/logout") {
        commit({
          ...db,
          sessions: db.sessions.filter((x) => x.token !== s.token),
        });
        res.setHeader(
          "Set-Cookie",
          "libra_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        );
        return send(null);
      }
      if (path === "/api/commands") {
        if (typeof p.type !== "string") fail("Command type required.");
        // No await between availability validation and durable commit: writes are serialized in this process.
        commit(command(p.type, p.payload || {}, actor));
        return send(snapshot(actor));
      }
      fail("This service is not configured.", 404);
    } catch (e) {
      if (!res.headersSent)
        send(
          {
            message:
              e.status || !["EACCES", "ENOSPC", "EPERM"].includes(e.code)
                ? e.message
                : "Could not save changes. Please retry.",
          },
          e.status || 400,
        );
      else res.end();
    }
  };
}
