import { test, expect } from "@playwright/test";

test("Razorpay browser checkout opens above our dialog and shows server-verified booking (mock provider)", async ({
  page,
  request,
}) => {
  const email = `online-${Date.now()}@example.com`;
  await request.post("/api/auth/signup", {
    data: {
      name: "Online Admin",
      email,
      password: "library-password",
      role: "owner",
    },
  });
  const created = await request.post("/api/commands", {
    data: {
      type: "library.create",
      payload: {
        seatCount: 1,
        library: {
          name: "Online Library",
          address: "Kanpur",
          open: "06:00",
          close: "23:00",
          price: 40,
          daily: 250,
          weekly: 1000,
          monthly: 3000,
          custom: 0,
        },
      },
    },
  });
  const lib = (await created.json()).libraries.find(
    (l) => l.name === "Online Library" && l.ownerId,
  );
  let workspace,
    input,
    verified = false;
  const booking = () => ({
    ...input,
    id: "LB-online-ui-test",
    userId: workspace.viewerId,
    amount: 80,
    method: "Razorpay",
    status: "Upcoming",
    payment: "Paid",
  });
  await page.route("**/api/workspace", async (route) => {
    workspace = await (await route.fetch()).json();
    workspace.paymentOptions.razorpay = true;
    if (verified) workspace.bookings.unshift(booking());
    await route.fulfill({ json: workspace });
  });
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    window.Razorpay = function(options) {
      this.open = () => setTimeout(() => {
        window.gatewayAccessible = !document.querySelector('dialog[open]');
        options.handler({razorpay_order_id:'order_ui_test',razorpay_payment_id:'pay_ui_test',razorpay_signature:'test-proof'});
      }, 100);
    };
  `,
    }),
  );
  await page.route("**/api/payments/order", async (route) => {
    input = route.request().postDataJSON();
    await route.fulfill({
      json: {
        bookingId: "LB-online-ui-test",
        key: "rzp_test_mock",
        orderId: "order_ui_test",
        amount: 8000,
        currency: "INR",
        name: input.name,
      },
    });
  });
  await page.route("**/api/payments/verify", async (route) => {
    const proof = route.request().postDataJSON();
    expect(proof.razorpay_payment_id).toBe("pay_ui_test");
    expect(proof.bookingId).toBe("LB-online-ui-test");
    verified = true;
    await route.fulfill({
      json: { ...workspace, bookings: [booking(), ...workspace.bookings] },
    });
  });
  await page.goto(`/#/qr/${lib.id}`);
  await page.getByLabel("Study date").fill("2099-01-01");
  await page
    .getByRole("button", { name: "Seat A01, Regular, Available" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Student name").fill("Online Customer");
  await page.getByRole("button", { name: "Razorpay", exact: true }).click();
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your seat is waiting." }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.gatewayAccessible)).toBe(true);
  expect(verified).toBe(true);
  await expect(
    page.getByRole("img", { name: "Scannable QR code" }),
  ).toBeVisible();
});

test("new library admin creates seats and a QR link; a separate phone books", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/auth/signup");
  await page.getByLabel("Account type").selectOption("owner");
  await page.getByLabel("Full name").fill("Library Manager");
  await page
    .getByLabel("Email address")
    .fill(`manager-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("library-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/owner\/libraries/);
  await page.getByRole("button", { name: "Add library" }).click();
  await page.getByLabel("Library name").fill("QR Study Library");
  await page.getByLabel("Number of seats").fill("3");
  await page.getByLabel("Address / location").fill("Civil Lines, Kanpur");
  await page.getByLabel("House rules").fill("Keep your phone silent.");
  await page.getByRole("button", { name: "Save library" }).click();
  await expect(
    page.getByRole("img", { name: "Scannable QR code" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download QR code" }),
  ).toHaveAttribute("href", /^data:image\/png/);
  const href = await page
    .getByRole("link", { name: "Open mobile booking page" })
    .getAttribute("href");
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const customer = await phone.newPage();
    customer.on("pageerror", (e) => errors.push(e.message));
    await customer.goto(new URL(href, page.url()).href);
    await expect(customer.getByRole("dialog")).toBeVisible();
    await customer.getByLabel("Study date").fill("2099-01-01");
    await customer
      .getByRole("button", { name: "Seat A01, Regular, Available" })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.getByLabel("Student name").fill("Phone Customer");
    await customer
      .getByRole("button", { name: "Submit offline request", exact: true })
      .click();
    await expect(
      customer.getByRole("heading", {
        name: "Waiting for payment confirmation.",
      }),
    ).toBeVisible();
    await expect(
      customer.getByText(/awaiting payment confirmation/),
    ).toBeVisible();
    await expect(
      customer.getByRole("img", { name: "Scannable QR code" }),
    ).toHaveCount(0);
    await customer
      .getByRole("button", { name: "View bookings", exact: true })
      .click();
    await expect(customer.locator(".my-booking")).toHaveCount(1);
    await customer.reload();
    await expect(customer.locator(".my-booking")).toHaveCount(1);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("link", { name: "Bookings", exact: true }).click();
    await expect(
      page.getByText("Phone Customer", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^View booking LB-/ }).click();
    await page
      .getByRole("button", { name: "Confirm offline payment", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm payment received", exact: true })
      .click();
    await expect(
      page.locator("dialog").getByText("Upcoming", { exact: true }),
    ).toBeVisible();
    await expect(
      customer.locator(".my-booking").getByText("Upcoming", { exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "View booking", exact: true })
      .click();
    await expect(
      customer.getByRole("img", { name: "Scannable QR code" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await phone.close();
  }
});
