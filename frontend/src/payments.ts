import * as WebBrowser from "expo-web-browser";
import { api, apiBaseUrl } from "@/src/api";
/** Open only the backend's own checkout path; payment success comes from verification. */
export async function openCheckout(result: any) {
  if (!result.checkout_url || !result.payment?.id) return;
  if (!String(result.checkout_url).startsWith("/api/payments/checkout/"))
    throw new Error("The payment link is unavailable. Please try again.");
  await WebBrowser.openBrowserAsync(`${apiBaseUrl}${result.checkout_url}`);
}
export async function verifiedPayment(paymentId: string) {
  const status = await api.paymentStatus(paymentId);
  if (
    status.payment?.requires_review ||
    status.resource?.status === "cancelled"
  )
    throw new Error(
      "This payment needs support review. Open Help & Privacy with your booking reference.",
    );
  if (
    status.payment?.status === "succeeded" &&
    status.resource?.status === "confirmed"
  )
    return status.resource;
  if (status.payment?.status === "expired")
    throw new Error("This checkout expired. You can create a new booking.");
  if (status.payment?.status === "failed")
    throw new Error(
      "Payment was not completed. Check your activity before trying again.",
    );
  throw new Error(
    "Payment is still being verified. Return here and check its status in a moment.",
  );
}
