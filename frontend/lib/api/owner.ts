import type {
  AdminInvoice,
  BillingDocument,
  BillingInstructions,
  OwnerBilling,
  OwnerBooking,
  OwnerBranch,
  OwnerAudiencePreview,
  OwnerBroadcast,
  OwnerBroadcastAudience,
  OwnerBroadcastChannel,
  OwnerCourt,
  OwnerCrmOverview,
  OwnerCustomer,
  OwnerDashboard,
  OwnerMembershipRow,
  OwnerPayment,
  OwnerPromotion,
  OwnerRefund,
  OwnerRole,
  OwnerSegment,
  OwnerSegmentMember,
  OwnerRfm,
  SegmentCriteria,
  CheckinBooking,
  CheckinResult,
  OwnerCustomerDetail,
  OwnerProduct,
  OwnerRentalOut,
  OutstandingRental,
  RentalItem,
  RentalItemInput,
  OwnerSale,
  OwnerSalesSummary,
  ProductInput,
  SalePromptPay,
  OwnerSettings,
  OwnerWelcomeBanner,
  WelcomeBannerInput,
  OwnerStaffMember,
  OwnerSubscription,
  OwnerTimelineEntry,
  OwnerAnnouncement,
  OwnerCourtBlock,
  OwnerPackagePurchase,
  OwnerWalletRow,
  OwnerWalletTopup,
  Sport,
  User,
} from "@/lib/types";
import { toPage } from "./paged";

// Payloads for branch/court management forms.
export type BranchInput = {
  name: string;
  address?: string | null;
  phone?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  sports?: string[];
  facilities?: string[];
  imageUrl?: string | null;
  photos?: string[];
  planImageUrl?: string | null;
  description?: string | null;
  travelHint?: string | null;
  peakNote?: string | null;
  weekHours?: { day: string; open: string; close: string }[];
  status?: "active" | "inactive";
};

export type BookingInput = {
  courtId: string;
  date: string;
  start: string;
  end: string;
  customerId?: string | null;
  customerName?: string | null;
  status?: string;
  /** Create only: equipment to rent alongside the court. */
  rentals?: { itemId: string; quantity: number }[];
};

export type CourtInput = {
  branchId: string;
  name: string;
  sport: Sport;
  pricePerHour: number;
  imageUrl?: string | null;
  floor?: string | null;
  aircon?: string | null;
  height?: string | null;
  lighting?: string | null;
  standard?: string | null;
  players?: string | null;
  status?: "active" | "inactive";
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

// Owner sessions use their OWN localStorage keys so they never clobber the
// customer session (which lives under "sanamspace.token" / "sanamspace.profile").
const TOKEN_KEY = "sanamspace.owner_token";
const USER_KEY = "sanamspace.owner_user";

export class OwnerApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "OwnerApiError";
  }
}

export function getOwnerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setOwnerToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearOwnerToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function setStoredUser(user: User): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

type ReqOpts = { method?: string; body?: unknown; raw?: boolean };

/** Download a PDF as a blob URL the browser can open in a new tab. */
export async function fetchPdf(path: string, token: string | null): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("เปิดไฟล์ PDF ไม่สำเร็จ");
  return URL.createObjectURL(await res.blob());
}

async function req<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = "GET", body, raw = false } = opts;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getOwnerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    // File uploads (transfer slips): let the browser set the multipart
    // boundary. JSON-stringifying this would post an empty object.
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new OwnerApiError(res.status, (json as { message?: string })?.message ?? res.statusText);
  }
  // Laravel API Resources wrap list/item responses in { data: ... }; dashboard/login are plain.
  if (raw) return json as T;
  return (json && typeof json === "object" && "data" in json ? json.data : json) as T;
}

export const ownerApi = {
  async adminLogin(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await req<{ token: string; user: User }>("/auth/admin/login", {
      method: "POST",
      body: { email, password },
      raw: true,
    });
    setOwnerToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  logout(): void {
    clearOwnerToken();
    clearStoredUser();
  },

  getStoredUser(): User | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },

  getDashboard: () => req<OwnerDashboard>("/owner/dashboard", { raw: true }),

  getSubscription: () => req<OwnerSubscription | null>("/owner/subscription"),

  // --- Billing / ต่ออายุ. Reachable even when the plan has lapsed. ---
  getBilling: () => req<OwnerBilling>("/owner/billing"),
  getBillingInvoices: () => req<AdminInvoice[]>("/owner/billing/invoices"),
  renewSubscription: (periodMonths: number) =>
    req<AdminInvoice>("/owner/billing/renew", { method: "POST", body: { periodMonths } }),
  /** The printable ใบแจ้งหนี้ / ใบเสร็จรับเงิน for one of this venue's invoices. */
  getBillingDocument: (invoiceId: string) =>
    req<BillingDocument>(`/owner/billing/invoices/${invoiceId}/document`),
  /**
   * The document as a PDF, fetched as a blob because the endpoint needs the
   * bearer token — a plain link would hit it unauthenticated.
   */
  getBillingDocumentPdf: (invoiceId: string) =>
    fetchPdf(`/owner/billing/invoices/${invoiceId}/document.pdf`, getOwnerToken()),
  getBillingInstructions: (invoiceId: string) =>
    req<BillingInstructions>(`/owner/billing/invoices/${invoiceId}/instructions`, { raw: true }),
  uploadBillingSlip: (invoiceId: string, file: File) => {
    const fd = new FormData();
    fd.append("slip", file);
    return req<AdminInvoice>(`/owner/billing/invoices/${invoiceId}/slip`, { method: "POST", body: fd });
  },

  /**
   * One page of bookings. The unpaged getBookings() still returns the newest
   * page; this is what a screen uses to reach older rows.
   */
  getBookingsPage: async (page: number, params?: { status?: string; date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.date) qs.set("date", params.date);
    qs.set("page", String(page));
    return toPage<OwnerBooking>(await req(`/owner/bookings?${qs}`, { raw: true }));
  },

  getCustomersPage: async (page: number) =>
    toPage<OwnerCustomer>(await req(`/owner/customers?page=${page}`, { raw: true })),

  getPaymentsPage: async (page: number, status?: string) =>
    toPage<OwnerPayment>(
      await req(`/owner/payments?page=${page}${status ? `&status=${status}` : ""}`, { raw: true }),
    ),

  getBookings: (params?: { status?: string; date?: string; from?: string; to?: string; perPage?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.date) qs.set("date", params.date);
    // A date window keeps the calendar's request proportional to what it shows.
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.perPage) qs.set("perPage", String(params.perPage));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return req<OwnerBooking[]>(`/owner/bookings${suffix}`);
  },

  getBooking: (id: string) => req<OwnerBooking>(`/owner/bookings/${id}`),

  createBooking: (body: BookingInput) =>
    req<OwnerBooking>("/owner/bookings", { method: "POST", body }),

  /** Removes the row. Refused by the API once an approved payment exists. */
  deleteBooking: (id: string) => req<void>(`/owner/bookings/${id}`, { method: "DELETE" }),

  updateBooking: (id: string, body: Partial<BookingInput>) =>
    req<OwnerBooking>(`/owner/bookings/${id}`, { method: "PUT", body }),

  cancelBooking: (id: string) =>
    req<OwnerBooking>(`/owner/bookings/${id}/cancel`, { method: "POST" }),

  getPayments: (status = "pending_review") =>
    req<OwnerPayment[]>(`/owner/payments?status=${encodeURIComponent(status)}`),

  verifyPayment: (id: string) => req<OwnerPayment>(`/owner/payments/${id}/verify`, { method: "POST" }),

  rejectPayment: (id: string) => req<OwnerPayment>(`/owner/payments/${id}/reject`, { method: "POST" }),

  // --- Refunds (review customer requests; approve credits the wallet or records a manual refund) ---
  getRefunds: () => req<OwnerRefund[]>("/owner/refunds"),

  approveRefund: (id: string, method: "wallet" | "manual", note?: string) =>
    req<OwnerRefund>(`/owner/refunds/${id}/approve`, { method: "POST", body: { method, note } }),

  rejectRefund: (id: string, note?: string) =>
    req<OwnerRefund>(`/owner/refunds/${id}/reject`, { method: "POST", body: { note } }),

  // --- Courts (คอร์ท) management ---
  getCourts: () => req<OwnerCourt[]>("/owner/courts"),

  createCourt: (body: CourtInput) =>
    req<OwnerCourt>("/owner/courts", { method: "POST", body }),

  updateCourt: (id: string, body: Partial<CourtInput>) =>
    req<OwnerCourt>(`/owner/courts/${id}`, { method: "PUT", body }),

  toggleCourt: (id: string) =>
    req<OwnerCourt>(`/owner/courts/${id}/toggle`, { method: "POST" }),

  deleteCourt: (id: string) =>
    req<void>(`/owner/courts/${id}`, { method: "DELETE" }),

  // --- Branches (สนาม/สาขา) management ---
  getBranches: () => req<OwnerBranch[]>("/owner/branches"),

  createBranch: (body: BranchInput) =>
    req<OwnerBranch>("/owner/branches", { method: "POST", body }),

  updateBranch: (id: string, body: Partial<BranchInput>) =>
    req<OwnerBranch>(`/owner/branches/${id}`, { method: "PUT", body }),

  toggleBranch: (id: string) =>
    req<OwnerBranch>(`/owner/branches/${id}/toggle`, { method: "POST" }),

  deleteBranch: (id: string) =>
    req<void>(`/owner/branches/${id}`, { method: "DELETE" }),

  // Upload an image (cover / gallery / floor-plan) -> returns the absolute URL.
  async uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const token = getOwnerToken();
    const res = await fetch(`${BASE}/owner/uploads`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd, // browser sets multipart boundary; do NOT set Content-Type
    });
    const json = (await res.json().catch(() => null)) as { url?: string; message?: string } | null;
    if (!res.ok || !json?.url) {
      throw new OwnerApiError(res.status, json?.message ?? res.statusText);
    }
    return json.url;
  },

  // --- QR check-in (the counter scans; the customer shows) ---
  /** Accepts the QR token or a typed booking code; the answer is the same shape. */
  checkin: (token: string) => req<CheckinResult>("/owner/checkin", { method: "POST", body: { token }, raw: true }),

  getRecentCheckins: () => req<CheckinBooking[]>("/owner/checkin/recent"),

  // --- Rental equipment ---
  getRentalItems: () => req<RentalItem[]>("/owner/rental-items"),

  createRentalItem: (body: RentalItemInput) =>
    req<RentalItem>("/owner/rental-items", { method: "POST", body }),

  updateRentalItem: (id: string, body: RentalItemInput) =>
    req<RentalItem>(`/owner/rental-items/${id}`, { method: "PUT", body }),

  deleteRentalItem: (id: string) => req<void>(`/owner/rental-items/${id}`, { method: "DELETE" }),

  /** What is out on a given day, and with whom. */
  getRentalsOut: (date?: string) =>
    req<{ date: string; data: OwnerRentalOut[] }>(
      `/owner/rental-items/out${date ? `?date=${date}` : ""}`,
      { raw: true },
    ),

  /**
   * Gear whose booking is over and which is still not back — the chase list.
   * Separate from `getRentalsOut`, which answers "what is in use today".
   */
  getOutstandingRentals: () => req<OutstandingRental[]>("/owner/rentals/outstanding"),

  /**
   * What the counter can rent for a slot, priced for it. Same service as the
   * customer app's GET /rentals — that one is authenticated as a customer, so
   * staff cannot call it.
   */
  getRentalOffer: (date: string, start: string, end: string) =>
    req<Array<RentalItem & { availableQty: number; priceForBooking: number }>>(
      `/owner/rental-items/offer?date=${date}&start=${start}&end=${end}`,
    ),

  /** Omitting quantity takes back everything still outstanding on the line. */
  returnRental: (bookingId: string, rentalId: string, quantity?: number) =>
    req<OwnerBooking>(`/owner/bookings/${bookingId}/rentals/${rentalId}/return`, {
      method: "POST",
      body: quantity === undefined ? {} : { quantity },
    }),

  // --- POS: the counter's till ---
  /** `sellable` narrows to what the till may show (active, in the venue's order). */
  getProducts: (sellable = false) =>
    req<OwnerProduct[]>(`/owner/products${sellable ? "?sellable=1" : ""}`),

  createProduct: (body: ProductInput) => req<OwnerProduct>("/owner/products", { method: "POST", body }),

  updateProduct: (id: string, body: ProductInput) =>
    req<OwnerProduct>(`/owner/products/${id}`, { method: "PUT", body }),

  /** `delta` to add or remove on a delivery, `set` to correct after a stock-take. */
  adjustStock: (id: string, body: { delta: number } | { set: number }) =>
    req<OwnerProduct>(`/owner/products/${id}/stock`, { method: "POST", body }),

  deleteProduct: (id: string) => req<void>(`/owner/products/${id}`, { method: "DELETE" }),

  createSale: (items: { productId: string; quantity: number }[], paymentMethod: "cash" | "transfer") =>
    req<OwnerSale>("/owner/sales", { method: "POST", body: { items, paymentMethod } }),

  getSales: (params?: { date?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set("date", params.date);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return req<OwnerSale[]>(`/owner/sales${q ? `?${q}` : ""}`);
  },

  getSalesSummary: (date?: string) =>
    req<OwnerSalesSummary>(`/owner/sales/summary${date ? `?date=${date}` : ""}`, { raw: true }),

  getSalePromptPay: (id: string) => req<SalePromptPay>(`/owner/sales/${id}/promptpay`, { raw: true }),

  voidSale: (id: string, reason?: string) =>
    req<OwnerSale>(`/owner/sales/${id}/void`, { method: "POST", body: { reason } }),

  getCustomers: () => req<OwnerCustomer[]>("/owner/customers"),

  /** One customer in full: standing, wallet, and their recent bookings. */
  getCustomer: (id: string) => req<OwnerCustomerDetail>(`/owner/customers/${id}`),

  getSettings: () => req<OwnerSettings>("/owner/settings"),

  // The two LINE secrets are WRITE-ONLY: they are accepted here on update but
  // never returned (the response only carries the `*Set` booleans on
  // OwnerSettings). Send them only when changing a secret; omit to keep the
  // stored value (a blank submit must not wipe it).
  updateSettings: (
    patch: Partial<OwnerSettings> & {
      lineChannelSecret?: string;
      lineMessagingToken?: string;
    },
  ) => req<OwnerSettings>("/owner/settings", { method: "PUT", body: patch }),

  getOwnerPromotions: () => req<OwnerPromotion[]>("/owner/promotions"),

  createPromotion: (body: { title: string; subtitle: string; tag: string }) =>
    req<OwnerPromotion>("/owner/promotions", { method: "POST", body }),

  updatePromotion: (
    id: string,
    body: Partial<{ title: string; subtitle: string; tag: string }>,
  ) => req<OwnerPromotion>(`/owner/promotions/${id}`, { method: "PUT", body }),

  deletePromotion: (id: string) =>
    req<void>(`/owner/promotions/${id}`, { method: "DELETE" }),

  // --- Welcome banners (ข้อความต้อนรับ) on the customer home ---
  // Unlike the public endpoint, this lists the switched-off ones too.
  getWelcomeBanners: () => req<OwnerWelcomeBanner[]>("/owner/welcome-banners"),

  createWelcomeBanner: (body: WelcomeBannerInput) =>
    req<OwnerWelcomeBanner>("/owner/welcome-banners", { method: "POST", body }),

  updateWelcomeBanner: (id: string, body: WelcomeBannerInput) =>
    req<OwnerWelcomeBanner>(`/owner/welcome-banners/${id}`, { method: "PUT", body }),

  /** Show or hide without deleting — the reason a banner list exists. */
  toggleWelcomeBanner: (id: string) =>
    req<OwnerWelcomeBanner>(`/owner/welcome-banners/${id}/toggle`, { method: "POST" }),

  /** Full order, top to bottom. */
  reorderWelcomeBanners: (ids: string[]) =>
    req<OwnerWelcomeBanner[]>("/owner/welcome-banners/reorder", { method: "POST", body: { ids } }),

  deleteWelcomeBanner: (id: string) =>
    req<void>(`/owner/welcome-banners/${id}`, { method: "DELETE" }),

  getStaff: () => req<OwnerStaffMember[]>("/owner/staff"),

  updateStaff: (userId: string, body: Partial<{ displayName: string; roleId: string; status: string }>) =>
    req<OwnerStaffMember>(`/owner/staff/${userId}`, { method: "PUT", body }),

  /** Removes the membership only — the person may be staff at another venue. */
  removeStaff: (userId: string) =>
    req<{ deleted: boolean }>(`/owner/staff/${userId}`, { method: "DELETE", raw: true }),

  getRoles: () => req<OwnerRole[]>("/owner/roles"),

  getMemberships: () => req<OwnerMembershipRow[]>("/owner/memberships"),

  getWallets: () => req<OwnerWalletRow[]>("/owner/wallets"),

  getWalletTopups: () => req<OwnerWalletTopup[]>("/owner/wallet-topups"),

  approveWalletTopup: (id: string) =>
    req<{ id: string; status: string }>(`/owner/wallet-topups/${id}/approve`, { method: "POST", raw: true }),

  rejectWalletTopup: (id: string) =>
    req<{ id: string; status: string }>(`/owner/wallet-topups/${id}/reject`, { method: "POST", raw: true }),

  getAnnouncements: () => req<OwnerAnnouncement[]>("/owner/announcements"),

  // Download the bookings CSV with the owner token, then save it via the browser.
  async exportBookingsCsv(): Promise<void> {
    const headers: Record<string, string> = { Accept: "text/csv" };
    const token = getOwnerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}/owner/reports/bookings.csv`, { headers });
    if (!res.ok) throw new Error("ดาวน์โหลดไม่สำเร็จ");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getCourtBlocks: (courtId?: string) =>
    req<OwnerCourtBlock[]>(`/owner/court-blocks${courtId ? `?courtId=${encodeURIComponent(courtId)}` : ""}`),

  createCourtBlock: (body: { courtId: string; date: string; start?: string; end?: string; reason?: string }) =>
    req<{ id: string }>("/owner/court-blocks", { method: "POST", body, raw: true }),

  deleteCourtBlock: (id: string) =>
    req<void>(`/owner/court-blocks/${id}`, { method: "DELETE" }),

  getPackagePurchases: () => req<OwnerPackagePurchase[]>("/owner/package-purchases"),

  approvePackagePurchase: (id: string) =>
    req<{ id: string; status: string }>(`/owner/package-purchases/${id}/approve`, { method: "POST", raw: true }),

  rejectPackagePurchase: (id: string) =>
    req<{ id: string; status: string }>(`/owner/package-purchases/${id}/reject`, { method: "POST", raw: true }),

  // --- CRM ---
  getCrmOverview: () => req<OwnerCrmOverview>("/owner/crm/overview"),

  getSegments: () => req<OwnerSegment[]>("/owner/segments"),

  createSegment: (body: { name: string; description: string; criteria?: SegmentCriteria }) =>
    req<OwnerSegment>("/owner/segments", { method: "POST", body }),

  /** Who is in it right now — the answer moves for a dynamic segment. */
  getSegmentMembers: (id: string) =>
    req<{ data: OwnerSegmentMember[]; dynamic: boolean }>(`/owner/segments/${id}/members`, { raw: true }),

  getRfm: () => req<OwnerRfm>("/owner/crm/rfm", { raw: true }),

  deleteSegment: (id: string) =>
    req<void>(`/owner/segments/${id}`, { method: "DELETE" }),

  getTimeline: (customerId: string) =>
    req<OwnerTimelineEntry[]>(`/owner/timeline/${customerId}`),

  getBroadcasts: () => req<OwnerBroadcast[]>("/owner/broadcasts"),

  previewAudience: (params: {
    audience: OwnerBroadcastAudience;
    inactiveDays?: number;
    segmentId?: string;
  }) => {
    const qs = new URLSearchParams({ audience: params.audience });
    if (params.inactiveDays != null) qs.set("inactiveDays", String(params.inactiveDays));
    if (params.segmentId) qs.set("segmentId", params.segmentId);
    return req<OwnerAudiencePreview>(`/owner/broadcasts/audience-preview?${qs.toString()}`);
  },

  createBroadcast: (body: {
    title: string;
    message: string;
    imageUrl?: string;
    channel: OwnerBroadcastChannel;
    audience?: OwnerBroadcastAudience;
    inactiveDays?: number;
    segmentId?: string;
  }) => req<OwnerBroadcast>("/owner/broadcasts", { method: "POST", body }),

  updateBroadcast: (
    id: string,
    body: {
      title: string;
      message: string;
      imageUrl?: string;
      channel: OwnerBroadcastChannel;
      audience?: OwnerBroadcastAudience;
      inactiveDays?: number;
      segmentId?: string;
    },
  ) => req<OwnerBroadcast>(`/owner/broadcasts/${id}`, { method: "PUT", body }),

  deleteBroadcast: (id: string) =>
    req<{ id: string; deleted: boolean }>(`/owner/broadcasts/${id}`, { method: "DELETE", raw: true }),

  sendBroadcast: (id: string) =>
    req<OwnerBroadcast>(`/owner/broadcasts/${id}/send`, { method: "POST" }),

  // --- Staff / Membership / Wallet mutations ---
  inviteStaff: (body: { email: string; displayName: string; roleId: string }) =>
    req<OwnerStaffMember>("/owner/staff", { method: "POST", body }),

  adjustPoints: (membershipId: string, body: { delta: number; note?: string }) =>
    req<OwnerMembershipRow>(`/owner/memberships/${membershipId}/points`, {
      method: "POST",
      body,
    }),

  topupWallet: (walletId: string, body: { amount: number; label?: string }) =>
    req<OwnerWalletRow>(`/owner/wallets/${walletId}/topup`, {
      method: "POST",
      body,
    }),
};
