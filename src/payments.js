import { api } from "./api";
let loading;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () =>
      window.Razorpay ? resolve() : reject(new Error("Razorpay did not load."));
    script.onerror = () => {
      script.remove();
      reject(
        new Error(
          "Could not load Razorpay. Check your connection or choose Offline.",
        ),
      );
    };
    document.head.appendChild(script);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export async function payWithRazorpay(
  input,
  { onOpen = () => {}, onClose = () => {} } = {},
) {
  await loadCheckout();
  const order = await api.request("/payments/order", {
    method: "POST",
    body: input,
  });
  const response = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      onClose();
      fn(value);
    };
    const checkout = new window.Razorpay({
      key: order.key,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "LibraBook",
      description: "Library seat booking",
      prefill: { name: order.name },
      handler: (data) => finish(resolve, data),
      modal: {
        ondismiss: () =>
          finish(
            reject,
            new Error(
              "Checkout closed. If money was deducted, use Check payment status in My bookings before paying again.",
            ),
          ),
      },
      theme: { color: "#153d36" },
    });
    try {
      onOpen();
      checkout.open();
    } catch (e) {
      finish(reject, e);
    }
  });
  const snapshot = await api.request("/payments/verify", {
    method: "POST",
    body: { ...response, bookingId: order.bookingId },
  });
  return { snapshot, bookingId: order.bookingId };
}
