# Shared API and payments

The bundled backend runs at `/api`. All browser writes use JSON and same-origin cookies. `VITE_BROWSER_DEMO=true` explicitly selects the older local-storage demo.

## Accounts and workspace

| Route                 | Behavior                                                                          |
| --------------------- | --------------------------------------------------------------------------------- |
| GET /api/auth/session | Current account or null; establishes a guest cookie if needed                     |
| POST /api/auth/signup | {name,email,password,role}; student or owner self-registration; returns {session} |
| POST /api/auth/login  | {email,password}; rotates session token                                           |
| POST /api/auth/logout | {}; invalidates current session                                                   |
| GET /api/workspace    | Authorized snapshot, viewerId and paymentOptions                                  |
| GET /api/events       | SSE change signals; clients reload authorized snapshots                           |

Library admins use the owner role. Public signup cannot create a platform admin. Passwords use salted scrypt. Cookies are HTTP-only, SameSite=Lax, with 30-day expiry; Secure is enabled with NODE_ENV=production. Login/signup attempts are limited per connection IP. Email verification and password recovery are not implemented.

Workspace arrays: libraries, seats, bookings, holds, members, notifications, reviews and complaints. Other customers' bookings expose occupancy fields only, not names/payment/customer IDs. paymentOptions reports whether offline and Razorpay are enabled. Guest checkout uses the server-assigned viewerId, never a client-supplied identity.

## Commands

POST /api/commands accepts {type,payload} and returns an updated authorized snapshot.

| Type                                       | Payload and authorization                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| library.create                             | {library,seatCount}; owner/admin; 1-500 seats; session-derived ownership; immediately Approved                                |
| libraries.save                             | Own library details; owners cannot change status or ownership                                                                 |
| seats.save / seats.delete                  | Own seat details or {id}; deletion rejects active reservations                                                                |
| hold.create                                | {seatId,date,start,duration}; 5-minute pre-checkout hold                                                                      |
| hold.release                               | {}; releases caller's ordinary holds; does not release active Razorpay payment holds                                          |
| booking.create                             | {libraryId,seatId,date,start,duration,name,coupon,method:"Offline"}; creates Pending payment / Unpaid, releases ordinary hold |
| payment.confirmOffline                     | {id}; owning admin only; rechecks seat availability, then sets Upcoming / Paid with confirmedBy and paidAt                    |
| payment.rejectOffline                      | {id}; owning admin; pending offline only; records rejection                                                                   |
| booking.cancel                             | {id}; customer or owning manager; paid cancellations become Refund required                                                   |
| booking.checkin / booking.checkout         | {id}; owning manager only; requires Paid and valid booking state                                                              |
| notifications.read / notifications.readAll | {id} or {}; caller's notifications                                                                                            |
| members.save                               | {id,name}; caller's name only                                                                                                 |

Unsupported commands fail explicitly. Shared-mode extensions require a new booking/payment. Client-supplied user IDs, amounts, ownership and payment flags are ignored. Offline confirmation and availability checking occur in the same synchronous state transition. Repeated confirmation is idempotent.

## Razorpay endpoints

| Route                        | Request / response                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| POST /api/payments/order     | Booking fields + requestId, or {bookingId} to resume; returns {bookingId,key,orderId,amount,currency,name} |
| POST /api/payments/verify    | {bookingId,razorpay_order_id,razorpay_payment_id,razorpay_signature}; returns updated snapshot             |
| POST /api/payments/reconcile | {id}; customer or owning manager checks captured payment using provider order history; returns snapshot    |
| POST /api/payments/webhook   | Raw Razorpay JSON body plus X-Razorpay-Signature; server-to-server endpoint                                |

Order amounts are computed in INR paise on the server. The secret is never returned to the browser. An online request remains Pending payment with a 10-minute hold until verified. Reusing requestId for the same customer/details reuses the pending order. Different details require a different requestId.

Checkout verification uses HMAC-SHA256(orderId + "|" + paymentId, keySecret), with the stored server order ID. The server also fetches the payment and checks order, payment ID, captured status, currency, amount and absence of refunds. A checkout success callback alone does not book a seat.

Webhooks validate the HMAC over the exact raw body using RAZORPAY_WEBHOOK_SECRET, independently of browser cookies. Supported events: payment.captured and order.paid. Both fetch the payment from Razorpay and use the same idempotent finalization path as browser verification. Unknown merchant orders are ignored. Invalid signatures are rejected before session creation.

Only Upcoming and Active bookings reserve capacity. Pending offline requests do not reserve capacity. Online holds expire automatically by timestamp. If a captured payment arrives after cancellation or a conflicting booking, the request becomes Payment review / Refund required, with no confirmed seat. Admins must process refunds through the provider dashboard or offline. Automatic refunds and refund-event reconciliation are not implemented.

## Storage and deployment

Storage is LIBRA_DATA_FILE or data/workspace.json. Commands validate and commit synchronously, replacing the file before returning. Provider calls are awaited outside the final transition, and current state is reread before finalization to prevent callback races.

Run exactly one Node process against the JSON file. Multiple replicas require transactional database storage. Back up the private file and provision persistent storage. Sessions and order associations survive restarts. Use HTTPS and preserve Host at the reverse proxy. The bundled API is same-origin; external API hosting needs its own CORS/CSRF configuration.

All Razorpay orders use the server's one merchant account. This is not a multi-merchant settlement implementation. Set server keys in .env; never in VITE_ variables. See the root README for test-mode setup and webhook configuration.
