import test from "node:test";
import assert from "node:assert/strict";
import { makeSeed, localDate } from "../src/data.js";
import {
  assignedLibraries,
  libraryDistance,
  normalizeWorkspace,
} from "../src/workspace.js";
import {
  overlap,
  quote,
  seatState,
  createBooking,
  changeBooking,
  canAccess,
  validateSlot,
  refreshReminders,
} from "../src/domain.js";
const input = {
  libraryId: "studyhub",
  seatId: "studyhub-2",
  userId: "student-1",
  name: "Alex Morgan",
  date: localDate(),
  start: "10:00",
  duration: 2,
  method: "UPI",
  coupon: "",
};
test("adjacent sessions do not overlap, intersecting sessions do", () => {
  assert.equal(
    overlap({ ...input, start: "10:00" }, { ...input, start: "12:00" }),
    false,
  );
  assert.equal(overlap(input, { ...input, start: "11:00" }), true);
});
test("coupon and day pricing are derived, never trusted from checkout", () => {
  const lib = makeSeed().libraries[0];
  assert.deepEqual(quote(lib, 2, "study10"), {
    base: 80,
    discount: 8,
    total: 72,
  });
  assert.equal(quote(lib, 8).total, 300);
  assert.throws(() => quote(lib, 2, "FAKE"));
});
test("booking conflict checked again at confirmation", () => {
  const first = createBooking(makeSeed(), input);
  assert.equal(first.bookings[0].amount, 80);
  assert.throws(
    () => createBooking(first, { ...input, userId: "student-2" }),
    /no longer available/,
  );
});
test("protected seats and held seats cannot be booked by another student", () => {
  const db = makeSeed();
  assert.throws(() => createBooking(db, { ...input, seatId: "studyhub-0" }));
  db.holds.push({ ...input, expiresAt: Date.now() + 10000 });
  assert.equal(seatState(db.seats[2], db, input, "other"), "Held");
  assert.equal(seatState(db.seats[2], db, input, "student-1"), "Available");
});
test("expired hold releases its seat", () => {
  const db = makeSeed();
  db.holds.push({ ...input, expiresAt: Date.now() - 1 });
  assert.equal(seatState(db.seats[2], db, input, "other"), "Available");
});
test("cancel refunds the demo transaction and releases the seat", () => {
  let db = createBooking(makeSeed(), input);
  db = changeBooking(db, db.bookings[0].id, "cancel", {
    id: "student-1",
    role: "student",
  });
  assert.equal(db.bookings[0].payment, "Refunded");
  assert.equal(seatState(db.seats[2], db, input), "Available");
});
test("check-in and checkout enforce valid transitions", () => {
  let db = createBooking(makeSeed(), input);
  const id = db.bookings[0].id,
    actor = { id: "owner-1", role: "owner" };
  db = changeBooking(db, id, "checkin", actor);
  assert.equal(db.bookings[0].status, "Active");
  assert.throws(() => changeBooking(db, id, "checkin", actor));
  db = changeBooking(db, id, "checkout", actor);
  assert.equal(db.bookings[0].status, "Completed");
});
test("students cannot modify another booking", () => {
  assert.throws(
    () =>
      changeBooking(makeSeed(), "LB-20261002", "cancel", {
        id: "student-1",
        role: "student",
      }),
    /another student/,
  );
});
test("extension cannot collide with the next student", () => {
  let db = createBooking(makeSeed(), input);
  const id = db.bookings[0].id;
  db = createBooking(db, { ...input, userId: "student-2", start: "12:00" });
  assert.throws(
    () => changeBooking(db, id, "extend", { id: "owner-1", role: "owner" }),
    /already booked/,
  );
});
test("reject sessions outside opening hours", () => {
  assert.throws(
    () =>
      validateSlot(makeSeed().libraries[0], {
        ...input,
        start: "22:00",
        duration: 4,
      }),
    /opening hours/,
  );
});
test("owner includes receptionist access, other roles are separated", () => {
  assert.equal(canAccess("owner", "/receptionist/checkin"), true);
  assert.equal(canAccess("student", "/admin/home"), false);
  assert.equal(canAccess("receptionist", "/owner/libraries"), false);
  assert.equal(canAccess("student", "/qr/studyhub"), true);
});

test("reminders deduplicate, warn before expiry, and release expired seats", () => {
  let db = createBooking(makeSeed(), input);
  const id = db.bookings[0].id;
  db = changeBooking(db, id, "checkin", { id: "student-1", role: "student" });
  db = refreshReminders(db, new Date(`${input.date}T11:50:00`));
  assert(db.notifications.some((n) => n.id === `${id}:expiry-warning:2`));
  const count = db.notifications.length;
  db = refreshReminders(db, new Date(`${input.date}T11:51:00`));
  assert.equal(db.notifications.length, count);
  db = refreshReminders(db, new Date(`${input.date}T12:01:00`));
  assert.equal(db.bookings.find((b) => b.id === id).status, "Completed");
  assert.equal(seatState(db.seats[2], db, input), "Available");
});
test("suspended students cannot create bookings", () => {
  const db = makeSeed();
  db.members = db.members.map((m) =>
    m.id === "student-1" ? { ...m, status: "Suspended" } : m,
  );
  assert.throws(() => createBooking(db, input), /suspended/);
});

test("ownership follows IDs after an owner changes their display name", () => {
  const db = normalizeWorkspace(makeSeed());
  assert.equal(
    assignedLibraries(db, {
      id: "owner-1",
      role: "owner",
      name: "Updated Name",
    })[0].id,
    "studyhub",
  );
  assert.equal(
    assignedLibraries(db, { id: "owner-2", role: "owner" }).some(
      (l) => l.id === "studyhub",
    ),
    false,
  );
  assert.equal(
    assignedLibraries(db, { id: "receptionist-1", role: "receptionist" })
      .length,
    1,
  );
});
test("nearby search does not invent a distance for missing coordinates", () => {
  assert.equal(
    libraryDistance({ lat: 26, lng: 80 }, { lat: null, lng: null }),
    null,
  );
  assert.equal(libraryDistance({ lat: 26, lng: 80 }, { lat: 26, lng: 80 }), 0);
  assert(libraryDistance({ lat: 26, lng: 80 }, { lat: 27, lng: 80 }) > 100);
});
