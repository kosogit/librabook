import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBackend } from "../server/app.js";

test("shared library setup, guest booking, ownership, conflicts and restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "libra-test-"));
  const file = join(dir, "db.json");
  let server;
  async function start() {
    const middleware = createBackend({ file, secure: false });
    server = createServer((req, res) =>
      middleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}/api`;
  }
  let base = await start();
  function client() {
    let cookie = "";
    return async (path, body) => {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: cookie,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      return { status: response.status, data: await response.json() };
    };
  }
  try {
    const owner = client(),
      other = client(),
      guest = client(),
      rival = client();
    const signup = await owner("/auth/signup", {
      name: "New Admin",
      email: "admin@example.com",
      password: "good-password",
      role: "owner",
    });
    assert.equal(signup.data.session.role, "owner");
    const escalation = await other("/auth/signup", {
      name: "Other",
      email: "other@example.com",
      password: "good-password",
      role: "admin",
    });
    assert.equal(escalation.data.session.role, "student");
    const library = {
      id: "new-library",
      name: "New library",
      address: "Kanpur",
      open: "06:00",
      close: "23:00",
      price: 40,
      daily: 250,
      weekly: 1000,
      monthly: 3000,
      custom: 0,
    };
    const created = await owner("/commands", {
      type: "library.create",
      payload: { library, seatCount: 3 },
    });
    assert.equal(created.status, 200);
    assert.equal(created.data.libraries[0].status, "Approved");
    assert.equal(created.data.seats.length, 3);
    assert.equal(
      (
        await other("/commands", {
          type: "libraries.save",
          payload: { ...library, name: "Stolen" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await other("/commands", {
          type: "library.create",
          payload: { library, seatCount: 3 },
        })
      ).status,
      403,
    );
    const publicData = (await guest("/workspace")).data;
    await rival("/workspace");
    assert.equal(publicData.libraries[0].name, "New library");
    const slot = {
      date: "2099-01-01",
      start: "10:00",
      duration: 2,
      seatId: publicData.seats[0].id,
      libraryId: library.id,
      name: "Customer",
      userId: "forged-id",
      amount: 1,
      payment: "Paid",
      method: "Offline",
    };
    const held = await guest("/commands", {
      type: "hold.create",
      payload: slot,
    });
    assert.equal(held.status, 200);
    assert.equal(
      (await rival("/commands", { type: "booking.create", payload: slot }))
        .status,
      409,
    );
    const booked = await guest("/commands", {
      type: "booking.create",
      payload: slot,
    });
    assert.equal(booked.status, 200);
    const booking = booked.data.bookings[0];
    assert.equal(booking.userId, publicData.viewerId);
    assert.equal(booking.amount, 80);
    assert.equal(booking.payment, "Unpaid");
    assert.equal(booking.status, "Pending payment");
    assert.equal(
      (
        await guest("/commands", {
          type: "payment.confirmOffline",
          payload: { id: booking.id },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await owner("/commands", {
          type: "booking.checkin",
          payload: { id: booking.id },
        })
      ).status,
      409,
    );
    const approved = await owner("/commands", {
      type: "payment.confirmOffline",
      payload: { id: booking.id },
    });
    assert.equal(approved.data.bookings[0].status, "Upcoming");
    assert.equal(approved.data.bookings[0].payment, "Paid");
    assert.equal(
      (
        await rival("/commands", {
          type: "booking.cancel",
          payload: { id: booking.id },
        })
      ).status,
      404,
    );
    const rivalData = (await rival("/workspace")).data;
    assert.equal(rivalData.bookings[0].name, undefined);
    assert.equal(rivalData.bookings[0].userId, undefined);
    assert.equal((await owner("/workspace")).data.bookings[0].name, "Customer");
    const slot2 = { ...slot, seatId: publicData.seats[1].id };
    const race = await Promise.all([
      guest("/commands", { type: "booking.create", payload: slot2 }),
      rival("/commands", { type: "booking.create", payload: slot2 }),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 200]);
    const requests = race.map((r) =>
      r.data.bookings.find((b) => b.seatId === slot2.seatId && b.name),
    );
    const approvals = await Promise.all(
      requests.map((b) =>
        owner("/commands", {
          type: "payment.confirmOffline",
          payload: { id: b.id },
        }),
      ),
    );
    assert.deepEqual(approvals.map((r) => r.status).sort(), [200, 409]);
    await new Promise((resolve) => server.close(resolve));
    base = await start();
    assert.equal(
      (await guest("/workspace")).data.bookings.find((b) => b.id === booking.id)
        .name,
      "Customer",
    );
    assert.equal(
      (await owner("/auth/session")).data.id,
      signup.data.session.id,
    );
    assert.equal((await owner("/auth/logout", {})).status, 200);
    assert.equal((await owner("/auth/session")).data, null);
    assert.equal(
      (
        await owner("/auth/login", {
          email: "admin@example.com",
          password: "good-password",
        })
      ).status,
      200,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
