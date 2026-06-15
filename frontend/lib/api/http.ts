import type {
  AppNotification, Booking, Court, CourtSchedule, CustomerPackage, LineConfig, Membership, Payment, PaymentInstructions,
  PackagePurchaseInstructions, Promotion, Refund, ReviewSummary, User, Venue, VenuePackage, Wallet, WalletTopupInstructions,
} from "@/lib/types";
import { getToken, setToken } from "./token";
import type { Api, LinePayload } from "./mock";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type ReqOpts = { method?: string; body?: unknown; raw?: boolean };

async function req<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = "GET", body, raw = false } = opts;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // browser sets multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (json as { message?: string })?.message ?? res.statusText);
  }
  // Laravel API Resources wrap single/collection responses in { data: ... }.
  if (raw) return json as T;
  return (json && typeof json === "object" && "data" in json ? json.data : json) as T;
}

/** GET that resolves to undefined on 404 (mirrors the mock's find()-returns-undefined). */
async function getOrUndefined<T>(path: string): Promise<T | undefined> {
  try {
    return await req<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export const httpApi: Api = {
  async lineLogin(payload?: LinePayload): Promise<{ token: string; user: User }> {
    const res = await req<{ token: string; user: User }>("/auth/line/login", {
      method: "POST",
      body: payload ?? {},
      raw: true, // login returns { token, user } un-wrapped
    });
    setToken(res.token);
    return res;
  },
  // Public; returns { liffId } un-wrapped (plain JsonResponse, not a Resource).
  getLineConfig: () => req<LineConfig>("/line-config", { raw: true }),

  getVenues: () => req<Venue[]>("/branches"),
  getVenue: (id) => getOrUndefined<Venue>(`/branches/${id}`),
  getCourts: (venueId) => req<Court[]>(`/courts?venueId=${encodeURIComponent(venueId)}`),
  getCourtSchedule: (courtId, date) =>
    req<CourtSchedule>(`/courts/${courtId}/schedules?date=${encodeURIComponent(date)}`),

  createBooking: (input) => req<Booking>("/bookings", { method: "POST", body: input }),
  getBooking: (id) => getOrUndefined<Booking>(`/bookings/${id}`),
  listBookings: () => req<Booking[]>("/bookings"),
  checkinBooking: (id) => req<Booking>(`/bookings/${id}/checkin`, { method: "POST" }),
  cancelBooking: (id) => req<Booking>(`/bookings/${id}/cancel`, { method: "POST" }),
  requestRefund: (bookingId, reason) =>
    req<Refund>(`/bookings/${bookingId}/refund`, { method: "POST", body: { reason } }),
  getRefunds: () => req<Refund[]>("/refunds"),

  createPayment: (bookingId, method) =>
    req<Payment>("/payments", { method: "POST", body: { bookingId, method } }),
  uploadSlip: (paymentId, file) => {
    const fd = new FormData();
    if (file) fd.append("slip", file);
    return req<Payment>(`/payments/${paymentId}/upload-slip`, { method: "POST", body: fd });
  },
  approvePayment: (paymentId) => req<Payment>(`/payments/${paymentId}/verify`, { method: "POST" }),
  getPayment: (id) => getOrUndefined<Payment>(`/payments/${id}`),
  getPaymentInstructions: (id) => req<PaymentInstructions>(`/payments/${id}/instructions`),

  getReviews: (venueId) => req<ReviewSummary>(`/reviews?venueId=${encodeURIComponent(venueId)}`),
  submitReview: (venueId, rating, text) =>
    req<ReviewSummary>("/reviews", { method: "POST", body: { venueId, rating, text } }),
  walletTopup: (amount) =>
    req<WalletTopupInstructions>("/wallet/topup", { method: "POST", body: { amount } }),
  walletTopupSlip: (id, file) => {
    const fd = new FormData();
    if (file) fd.append("slip", file);
    return req<Wallet>(`/wallet/topup/${id}/slip`, { method: "POST", body: fd });
  },
  getMyPackages: () => req<CustomerPackage[]>("/my-packages"),
  purchasePackage: (id) => req<PackagePurchaseInstructions>(`/packages/${id}/purchase`, { method: "POST" }),
  purchasePackageSlip: (id, file) => {
    const fd = new FormData();
    if (file) fd.append("slip", file);
    return req<CustomerPackage>(`/packages/purchases/${id}/slip`, { method: "POST", body: fd });
  },
  payWithPackage: (bookingId, customerPackageId) =>
    req<Booking>(`/bookings/${bookingId}/pay-with-package`, { method: "POST", body: { customerPackageId } }),
  getPackages: () => req<VenuePackage[]>("/packages"),
  getMembership: () => req<Membership>("/membership"),
  getWallet: () => req<Wallet>("/wallet"),
  getPromotions: () => req<Promotion[]>("/promotions"),
  getNotifications: () => req<AppNotification[]>("/notifications"),
  updateProfile: (patch) => req<User>("/auth/me", { method: "PUT", body: patch }),
  async me(): Promise<User | null> {
    try {
      return await req<User>("/auth/me");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return null;
      throw e;
    }
  },
};
