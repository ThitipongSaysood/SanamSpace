import type {
  AppNotification, Booking, MarketingConsent, RentalItem, Court, CourtSchedule, CustomerPackage, LineConfig, Membership, Payment, PaymentInstructions,
  OrgPublic, PackagePurchaseInstructions, Promotion, Refund, ReviewSummary, User, Venue, VenuePackage, Wallet, WalletTopupInstructions,
  CouponPreview,
} from "@/lib/types";
import { clearToken, getToken, setToken } from "./token";
import { getActiveVenueSlug } from "@/lib/tenant/active-venue";
import type { Api, LinePayload } from "./mock";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type ReqOpts = { method?: string; body?: unknown; raw?: boolean };

/**
 * Who is asking, and for which venue.
 *
 * Extracted so a request that does not go through `req()` — the data export,
 * which must stay a file — still carries the venue scope. Building those
 * headers by hand at the call site is how one of them ends up missing it.
 */
function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // The backend scopes every customer-facing read to this, so it goes on every
  // request rather than being threaded through each call site — a call that
  // forgot it would silently widen the query.
  const venue = getActiveVenueSlug();
  if (venue) headers["X-Venue-Slug"] = venue;

  return headers;
}

async function req<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = "GET", body, raw = false } = opts;
  const headers = baseHeaders();

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // browser sets multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });

  // A dead session ends at the venue's login screen, not on a "ลองอีกครั้ง"
  // button that can never work. Scoped to the venue in the URL, because a
  // customer belongs to one venue and the platform root is not one.
  if (res.status === 401 && !path.includes("/auth/")) {
    clearToken();
    if (typeof window !== "undefined") {
      const slug = getActiveVenueSlug();
      const home = slug ? `/v/${slug}` : "/";
      if (window.location.pathname !== home) window.location.replace(home);
    }
  }

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
  getLineConfig: (slug?: string) =>
    req<LineConfig>(slug ? `/line-config?organizationSlug=${encodeURIComponent(slug)}` : "/line-config", { raw: true }),
  getOrgPublic: (slug: string) => req<OrgPublic>(`/orgs/${encodeURIComponent(slug)}/public`, { raw: true }),

  getVenues: () => req<Venue[]>("/branches"),
  getVenue: (id) => getOrUndefined<Venue>(`/branches/${id}`),
  getCourts: (venueId) => req<Court[]>(`/courts?venueId=${encodeURIComponent(venueId)}`),
  getCourtSchedule: (courtId, date) =>
    req<CourtSchedule>(`/courts/${courtId}/schedules?date=${encodeURIComponent(date)}`),

  createBooking: (input) => req<Booking>("/bookings", { method: "POST", body: input }),
  getBooking: (id) => getOrUndefined<Booking>(`/bookings/${id}`),
  listBookings: () => req<Booking[]>("/bookings"),
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
  // No approvePayment here. Approving a slip is a staff decision made in the
  // owner portal (ownerApi.verifyPayment) — the customer client having a method
  // for it is how the unscoped /payments/{id}/verify route stayed alive.
  getPayment: (id) => getOrUndefined<Payment>(`/payments/${id}`),
  getPaymentInstructions: (id) => req<PaymentInstructions>(`/payments/${id}/instructions`),

  getReviews: (venueId) => req<ReviewSummary>(`/reviews?venueId=${encodeURIComponent(venueId)}`),
  submitReview: (venueId, rating, text) =>
    req<ReviewSummary>("/reviews", { method: "POST", body: { venueId, rating, text } }),
  walletTopup: (amount) =>
    req<WalletTopupInstructions>("/credit/topup", { method: "POST", body: { amount } }),
  walletTopupSlip: (id, file) => {
    const fd = new FormData();
    if (file) fd.append("slip", file);
    return req<Wallet>(`/credit/topup/${id}/slip`, { method: "POST", body: fd });
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
  /** Spend credit. Settled on the spot — no slip to send. */
  payWithCredit: (bookingId: string, amount?: number) =>
    req<Booking>(`/bookings/${bookingId}/pay-with-credit`, {
      method: "POST",
      body: amount === undefined ? {} : { amount },
    }),
  getPackages: () => req<VenuePackage[]>("/packages"),
  getMembership: () => req<Membership>("/membership"),
  getCredit: () => req<Wallet>("/credit"),
  getPromotions: () => req<Promotion[]>("/promotions"),
  /** What can be rented for this exact slot — availability needs a window. */
  getRentals: (date: string, start: string, end: string) =>
    req<RentalItem[]>(`/rentals?date=${date}&start=${start}&end=${end}`),

  getNotifications: () => req<AppNotification[]>("/notifications"),

  /** What a code is worth here, before committing. Throws with the reason. */
  previewCoupon: (courtId: string, code: string, amount: number) =>
    req<CouponPreview>("/coupons/preview", { method: "POST", body: { courtId, code, amount }, raw: true }),

  // --- Marketing consent / opt-out. Always the signed-in customer. ---
  getConsent: () => req<MarketingConsent>("/me/consent"),
  setConsent: (granted: boolean) =>
    req<MarketingConsent>("/me/consent", { method: "POST", body: { granted } }),

  // --- PDPA data-subject rights. Neither takes an id: only ever yourself. ---
  /**
   * The copy is a file, so this bypasses `req()` — that helper parses JSON into
   * an object, and an object is exactly what a portable copy must not be
   * reduced to. Returns the raw text to save.
   */
  exportMyData: async (): Promise<string> => {
    const res = await fetch(`${BASE}/me/data`, { headers: baseHeaders() });
    if (!res.ok) throw new ApiError(res.status, "ดาวน์โหลดข้อมูลไม่สำเร็จ");
    return res.text();
  },
  deleteMyAccount: (confirmName: string) =>
    req<{ message: string }>("/me", { method: "DELETE", body: { confirmName } }),
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
