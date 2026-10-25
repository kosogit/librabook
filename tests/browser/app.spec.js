import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  const now = new Date();
  now.setHours(10, 0, 0, 0);
  await page.clock.setFixedTime(now);
});
async function demo(page, role) {
  await page.getByRole("button", { name: /demo$/ }).click();
  await page
    .locator(".role-menu")
    .getByRole("button", { name: new RegExp(`^${role}$`, "i") })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${role}/home`));
}
test("student discovery, full booking, and cancellation", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Make room for your next chapter/ }),
  ).toBeVisible();
  await demo(page, "student");
  await page
    .getByRole("button", { name: "View StudyHub Library", exact: true })
    .click();
  await page.getByRole("button", { name: "Find your seat" }).click();
  await page
    .getByRole("button", { name: "Seat A03, Regular, Available" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByPlaceholder("Try STUDY10").fill("STUDY10");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("button", { name: "Pay & confirm" }).click();
  await expect(
    page.getByRole("heading", { name: "Your seat is waiting." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View bookings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View booking", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(
    page.locator("dialog").getByText("Cancelled", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("all role workspaces render and admin can approve a library", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await demo(page, "owner");
  for (const label of [
    "My libraries",
    "Seats & layout",
    "Bookings",
    "Front desk",
    "Students",
    "Payments",
    "Reports",
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator("main")).not.toContainText("unexpected error");
    await expect(page.locator(".loading-screen")).toHaveCount(0);
  }
  await demo(page, "receptionist");
  await page.getByRole("link", { name: "Check-in / out" }).click();
  await page.getByPlaceholder("e.g. LB-20261001").fill("LB-20261001");
  await page.getByRole("button", { name: "Find booking" }).click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await demo(page, "admin");
  await page.getByRole("link", { name: "Libraries", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    page
      .locator(".managed-library")
      .filter({ hasText: "Knowledge Point" })
      .getByText("Approved", { exact: true }),
  ).toBeVisible();
  for (const label of [
    "Library owners",
    "Users",
    "Payments & commission",
    "Analytics",
    "Complaints",
    "Reviews",
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator(".loading-screen")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test("mobile layout, public QR flow, protected routing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Make room for/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/student-mobile.png",
    fullPage: true,
  });
  await page.goto("/#/qr/studyhub");
  await expect(page.getByText(/no app download needed/)).toBeVisible();
  await expect(page.locator("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/#/admin/home");
  await expect(
    page.getByRole("heading", { name: "A little introduction first." }),
  ).toBeVisible();
});
test("desktop screenshot and search empty state", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Make room for/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/student-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Search libraries" })
    .fill("nonexistent");
  await expect(
    page.getByRole("heading", {
      name: "Your perfect space is still out there.",
    }),
  ).toBeVisible();
});

test("signup, OTP, logout, reset password and login", async ({ page }) => {
  await page.goto("/#/auth/signup");
  await page.getByLabel("Full name").fill("Test Student");
  await page.getByLabel("Email address").fill("test-student@example.com");
  await page.getByLabel("Password", { exact: true }).fill("ExamplePass123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page).toHaveURL(/student\/home/);
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill("test-student@example.com");
  await page.getByRole("button", { name: "Send reset code" }).click();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await page.getByLabel("Password", { exact: true }).fill("NewExamplePass123");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await page.getByLabel("Password", { exact: true }).fill("NewExamplePass123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/student\/home/);
});

test("failed and pending guest payments do not create reservations; successful guest can check in", async ({
  page,
}) => {
  await page.goto("/#/qr/studyhub");
  await page
    .getByRole("button", { name: "Seat A03, Regular, Available" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Student name").fill("Guest Reader");
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("librabook-v2")).bookings.length,
  );
  await page.getByLabel("Simulate payment result").selectOption("failed");
  await page.getByRole("button", { name: "Pay & confirm" }).click();
  await expect(page.getByText(/Payment failed. No booking/)).toBeVisible();
  await page.getByLabel("Simulate payment result").selectOption("pending");
  await page.getByRole("button", { name: "Pay & confirm" }).click();
  await expect(page.getByText(/Payment is pending. No seat/)).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("librabook-v2")).bookings.length,
    ),
  ).toBe(before);
  await page.getByLabel("Simulate payment result").selectOption("success");
  await page.getByRole("button", { name: "Pay & confirm" }).click();
  await page
    .getByRole("button", { name: "View bookings", exact: true })
    .click();
  await page.getByRole("button", { name: "View booking", exact: true }).click();
  await page
    .locator("dialog")
    .getByRole("button", { name: "Check in", exact: true })
    .click();
  await expect(
    page.locator("dialog").getByText("Active", { exact: true }),
  ).toBeVisible();
  await page
    .locator("dialog")
    .getByRole("button", { name: "Check out & release seat" })
    .click();
  await expect(
    page.locator("dialog").getByText("Completed", { exact: true }),
  ).toBeVisible();
});

test("owner walk-in, protected seat editing, and payment export", async ({
  page,
}) => {
  await page.goto("/");
  await demo(page, "owner");
  await page
    .getByRole("link", { name: "Walk-in booking", exact: true })
    .click();
  await page.getByRole("button", { name: "Start walk-in booking" }).click();
  await page
    .getByRole("button", { name: "Seat A03, Regular, Available" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Existing student").selectOption("student-2");
  await page
    .getByRole("button", { name: "Confirm walk-in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your seat is waiting." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View bookings", exact: true })
    .click();
  await page.getByRole("link", { name: "Seats & layout", exact: true }).click();
  await page
    .getByRole("button", { name: "Seat A04, Regular, Available" })
    .click();
  await page
    .locator("dialog")
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Protected");
  await page.getByRole("button", { name: "Save seat" }).click();
  await expect(
    page.getByRole("button", { name: "Seat A04, Regular, Protected" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Payments", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("librabook-report.csv");
});

test("new library setup, approval, walk-in and selected-library reports", async ({
  page,
}) => {
  await page.goto("/");
  await demo(page, "owner");
  await page.getByRole("link", { name: "My libraries", exact: true }).click();
  await page.getByRole("button", { name: "Add library", exact: true }).click();
  await page.getByLabel("Library name", { exact: true }).fill("Chapter Two");
  await page.getByLabel("Address / location").fill("New Market, Kanpur");
  await page.getByLabel("House rules").fill("Keep phones on silent.");
  await page.getByRole("button", { name: "Save library", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.locator(".managed-library").filter({ hasText: "Chapter Two" }),
  ).toBeVisible();
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("librabook-v2")).libraries.find(
        (l) => l.name === "Chapter Two",
      ).id,
  );
  await page
    .getByRole("combobox", { name: "Active library", exact: true })
    .selectOption(id);
  await page.getByRole("link", { name: "Seats & layout", exact: true }).click();
  await page.getByRole("button", { name: "Add seat", exact: true }).click();
  await page.getByLabel("Seat number").fill("N01");
  await page.getByRole("button", { name: "Save seat", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Seat N01, Regular, Available" }),
  ).toBeVisible();
  await demo(page, "admin");
  await page.getByRole("link", { name: "Libraries", exact: true }).click();
  await page
    .locator(".managed-library")
    .filter({ hasText: "Chapter Two" })
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await demo(page, "owner");
  await expect(
    page.getByRole("combobox", { name: "Active library", exact: true }),
  ).toHaveValue(id);
  await page
    .getByRole("link", { name: "Walk-in booking", exact: true })
    .click();
  await page.getByRole("button", { name: "Start walk-in booking" }).click();
  await page
    .getByRole("button", { name: "Seat N01, Regular, Available" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Student name").fill("New Branch Reader");
  await page
    .getByRole("button", { name: "Confirm walk-in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View bookings", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("New Branch Reader");
  await expect(page.locator("main")).not.toContainText("Rahul Sharma");
  await page.getByRole("link", { name: "Payments", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "Front desk", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "New Branch Reader" })
    .click();
  await page
    .locator("dialog")
    .getByRole("button", { name: "Check in", exact: true })
    .click();
  await expect(
    page.locator("dialog").getByText("Active", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await demo(page, "student");
  await page
    .getByRole("textbox", { name: "Search libraries" })
    .fill("Chapter Two");
  await expect(page.locator(".library-card")).toHaveCount(1);
  await expect(page.locator(".library-card")).toContainText(
    "Distance unavailable",
  );
});
