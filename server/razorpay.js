import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(message, signature, secret) {
  if (
    !secret ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function createRazorpay({
  keyId = process.env.RAZORPAY_KEY_ID,
  keySecret = process.env.RAZORPAY_KEY_SECRET,
  webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET,
  fetchImpl = fetch,
} = {}) {
  async function request(path, body) {
    if (!keyId || !keySecret)
      throw new Error("Razorpay is not configured. Choose offline payment.");
    const response = await fetchImpl(`https://api.razorpay.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        "Razorpay could not complete this request. Please retry or contact the library.",
      );
    return result;
  }
  return {
    enabled: Boolean(keyId && keySecret),
    keyId,
    createOrder: (amount, receipt) =>
      request("orders", { amount, currency: "INR", receipt }),
    fetchPayment: (id) => request(`payments/${encodeURIComponent(id)}`),
    orderPayments: (id) => request(`orders/${encodeURIComponent(id)}/payments`),
    verifyCheckout: (orderId, paymentId, signature) =>
      verifySignature(`${orderId}|${paymentId}`, signature, keySecret),
    verifyWebhook: (raw, signature) =>
      verifySignature(raw, signature, webhookSecret),
  };
}
