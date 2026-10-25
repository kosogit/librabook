# LibraBook

A library management and seat-booking app built with React, Vite and Node.js. Library admins create their spaces and seats, share a QR code, and manage customer reservations. Customers can book from a phone without creating an account.

## Features

- Library admin signup and login, with each admin restricted to their own libraries.
- Library information, opening hours, pricing, facilities, photos and seat management.
- Downloadable QR codes that open a library's seat-selection page directly.
- Razorpay Checkout with server-created orders, signature verification, captured-payment checks and signed webhooks.
- Offline payment requests that become bookings **only after the library admin confirms payment**.
- Live booking updates, guest booking history, seat-conflict prevention and persistent server storage.

## Run locally

**Requirements:** Node.js 22.12 or later, npm, Git and a modern browser. No database installation is needed for this single-process version.

```sh
git clone https://github.com/kosogit/librabook.git
cd librabook
npm ci
```

Copy the example environment file:

```sh
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Leave the Razorpay values blank to run with offline payments only. Then start the app:

```sh
npm run dev
```

Open **http://localhost:3000**. In PowerShell, use `npm.cmd` / `npx.cmd` if execution policy blocks the corresponding `.ps1` command. Do not change your execution policy just to run this project.

The server loads `.env` automatically. Restart it after changing configuration. New installations start with no sample accounts or libraries.

### Create a library and test a booking

1. Open **Create an account**, choose **Library admin**, and register.
2. Select **Add library**, enter its information and seat count, and save. Seats are created automatically and the library is published immediately.
3. Download the QR image or copy **Open mobile booking page**.
4. Open that link in an incognito window or on another device. Choose a date/time and seat, enter the customer name, and select a payment method.
5. For offline payment, submit the request. In the admin window open **Bookings**, open the request, choose **Confirm offline payment**, and confirm receipt only after collecting the payment.
6. The customer receives a confirmed booking and booking QR only after successful payment confirmation.

Use **Pending payment** to find requests waiting for admin approval. Admins can reject an unpaid offline request. The server checks availability again at approval: an unpaid request does not guarantee the seat.

## Payment flows

| Method   | Initial state                                            | When the seat becomes booked                                               |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Offline  | Pending payment / Unpaid                                 | Owning admin confirms receipt and the server rechecks availability         |
| Razorpay | Pending payment / Unpaid, with a temporary checkout hold | Server verifies the signature, payment capture, order, amount and currency |

Offline requests do not reserve seats after submission. Several customers may request the same slot; only one conflicting request can be approved. Check availability before accepting offline payment. Confirmation records the admin ID and timestamp.

Online checkout holds the seat for up to 10 minutes. Closing checkout does not mean a payment failed: use **My bookings → View booking → Check payment status** before paying again. Pending online requests also offer **Pay with Razorpay** to resume checkout.

Duplicate callbacks/webhooks do not create duplicate bookings. If a payment arrives after a hold expires and the seat is no longer available, the request becomes **Payment review / Refund required** instead of double-booking the seat. A paid booking cancellation also requires a refund. Refunds must be processed by the library through Razorpay's dashboard or offline; this app does not automatically issue or reconcile refunds. Additional study time requires a new paid booking.

### Enable Razorpay

1. Create/sign in to your Razorpay merchant account and generate **Test mode** API keys.
2. Add these server-only values to `.env`:

   ```dotenv
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_test_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_random_webhook_secret
   ```

3. Configure **automatic payment capture** in the Razorpay dashboard. An authorized-but-uncaptured payment is not treated as a confirmed booking.
4. Restart the app. The Razorpay option is enabled only when the key ID and secret are configured.
5. Make a test payment using Razorpay's documented test payment methods. Test mode does not move real money.
6. For webhook recovery, register a public HTTPS endpoint in Razorpay:

   ```text
   https://YOUR_PUBLIC_HOST/api/payments/webhook
   ```

   Subscribe to `payment.captured` and `order.paid`, using exactly the webhook secret from `.env`. Localhost is not publicly reachable; use a supported HTTPS tunnel or staging host for webhook tests. Browser verification and manual payment-status checks work locally with valid test keys.

All online payments settle to the **single Razorpay merchant account configured on the server**. This version does not split settlements among different library admins or implement Razorpay Route. Use live keys only after completing your own end-to-end test and merchant setup.

Never put API secrets in `VITE_` variables, source files or GitHub. `.env`, server data and local artifacts are ignored by git. Do not share real keys in issues or screenshots.

Official references: [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook verification and testing](https://razorpay.com/docs/webhooks/validate-test/), [fetch payment status](https://razorpay.com/docs/api/payments/fetch-with-id/).

## Scan QR codes from a phone

On the same Wi-Fi, open the admin app using the computer's reachable network address printed by Vite, for example `http://192.168.1.20:3000`, **before generating/downloading the QR**. Allow the app's port through your firewall if needed.

A QR generated from `localhost` points to the scanning phone itself. For customers outside your network, host the frontend and backend together at a stable public HTTPS address and generate QR codes there. A static-only deployment cannot run this backend.

## Build and run the server

```sh
npm run build
npm start
```

The Node HTTP server serves `dist/` and `/api` together on port 3000. It does not use the Vite development server in this mode. Set `PORT` to change the port.

For public deployment, use HTTPS through a reverse proxy that preserves the Host header, set `NODE_ENV=production` to enable Secure session cookies, and provide persistent storage. Do not set production Secure cookies while testing over plain HTTP.

| Setting                                  | Default / purpose                                  |
| ---------------------------------------- | -------------------------------------------------- |
| `PORT`                                   | 3000 for the built Node server                     |
| `LIBRA_DATA_FILE`                        | `data/workspace.json`; persistent storage file     |
| `NODE_ENV`                               | Set to `production` only behind HTTPS              |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Blank disables online checkout                     |
| `RAZORPAY_WEBHOOK_SECRET`                | Secret for signed Razorpay events                  |
| `VITE_BROWSER_DEMO`                      | Optional `true` for the original browser-only demo |
| `VITE_API_BASE_URL`                      | Optional compatible external API; default `/api`   |

## Data and deployment boundaries

The JSON store contains private account, session and booking information. Back up the storage file and keep it outside public static hosting. The Vite dev server denies access to the configured data file; the built server serves only `dist/`.

Run **one Node process** against this file. Availability checks and final state transitions are synchronous within that process, with file replacement before responding. Multiple processes/replicas require transactional database storage and distributed locking. Horizontal scaling is not supported by this JSON store.

Passwords use salted scrypt hashes. Sessions use random HTTP-only SameSite cookies. Authentication rotates the session token. The backend derives ownership, customer identity, prices and payment status; it does not trust those values from the browser. Guest booking access depends on the device's cookie. Clearing cookies removes that access; signing in on the same device associates guest bookings with that account.

Existing reservations from the earlier pay-at-library version with `Upcoming / Unpaid` are migrated to pending offline requests. Already paid bookings are preserved.

Email verification, password recovery, automatic refunds, staff invitations and multi-merchant settlements are not implemented. Some older demo-only moderation/member tools remain in the interface and return an explicit unsupported-action error in shared mode.

## Project structure

```text
server.js                    # Entry point: dev or built frontend + API
server/
  app.js                     # Authentication, scoped workspace, library/seat API
  payments.js                # Offline approval and online payment lifecycle
  razorpay.js                # Razorpay HTTP client and HMAC verification
  config.js                  # Server-only .env loading
  vite-plugin.js             # /api integration for local Vite development
src/
  Auth.jsx                   # Customer and library admin accounts
  Staff.jsx                  # Library, seat, booking and payment management
  Student.jsx                # QR entry, checkout and customer bookings
  payments.js                # Razorpay browser checkout adapter
  components.jsx             # Shared UI and admin payment confirmation dialog
  store.jsx / api.js         # State, API calls and live updates
  domain.js / workspace.js   # Booking and library rules
public/                      # Images, fonts and static assets
tests/                       # Domain, API, payment and browser tests
docs/API-CONTRACT.md          # API routes and payment state transitions
legacy/                      # Archived static prototype; not part of the build
.github/workflows/ci.yml      # Automated tests and build
```

## Tests

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests automatically start an isolated server on **port 3100** and use a separate test database. Close anything else listening on that port first. On Windows the tests use installed Microsoft Edge by default; to use the downloaded Chromium instead, set `PLAYWRIGHT_CHANNEL=chromium`. CI uses Chromium on Linux.

The suite covers ownership and privacy, offline approval/rejection, conflicting confirmations, captured-payment requirements, forged signatures, idempotent callbacks, webhook recovery and refund-review conflicts. Browser checks cover the admin/customer offline flow and Razorpay checkout UI with a mocked provider. A real Razorpay test-mode transaction still needs your own test keys and merchant dashboard configuration.

To explore the archived demo behavior, set `VITE_BROWSER_DEMO=true` and restart Vite. Set the same variable for Playwright to select its legacy browser suite. Demo mode uses browser storage and simulated payments; it does not sync phones or use the shared payment server.

Photos were bundled from Unsplash; fonts are DM Sans and Manrope. The original static prototype remains under `legacy/`.
