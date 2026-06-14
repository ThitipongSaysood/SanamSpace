import type {
  OwnerBooking,
  OwnerBranch,
  OwnerBroadcast,
  OwnerBroadcastChannel,
  OwnerCourt,
  OwnerCrmOverview,
  OwnerCustomer,
  OwnerDashboard,
  OwnerMembershipRow,
  OwnerPayment,
  OwnerPromotion,
  OwnerRole,
  OwnerSegment,
  OwnerSettings,
  OwnerStaffMember,
  OwnerTimelineEntry,
  OwnerWalletRow,
  Sport,
  User,
} from "@/lib/types";

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
};

export type CourtInput = {
  branchId: string;
  name: string;
  sport: Sport;
  pricePerHour: number;
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

async function req<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = "GET", body, raw = false } = opts;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getOwnerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body !== undefined) {
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

  getBookings: (params?: { status?: string; date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.date) qs.set("date", params.date);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return req<OwnerBooking[]>(`/owner/bookings${suffix}`);
  },

  getBooking: (id: string) => req<OwnerBooking>(`/owner/bookings/${id}`),

  createBooking: (body: BookingInput) =>
    req<OwnerBooking>("/owner/bookings", { method: "POST", body }),

  updateBooking: (id: string, body: Partial<BookingInput>) =>
    req<OwnerBooking>(`/owner/bookings/${id}`, { method: "PUT", body }),

  cancelBooking: (id: string) =>
    req<OwnerBooking>(`/owner/bookings/${id}/cancel`, { method: "POST" }),

  getPayments: (status = "pending_review") =>
    req<OwnerPayment[]>(`/owner/payments?status=${encodeURIComponent(status)}`),

  verifyPayment: (id: string) => req<OwnerPayment>(`/owner/payments/${id}/verify`, { method: "POST" }),

  rejectPayment: (id: string) => req<OwnerPayment>(`/owner/payments/${id}/reject`, { method: "POST" }),

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

  getCustomers: () => req<OwnerCustomer[]>("/owner/customers"),

  getSettings: () => req<OwnerSettings>("/owner/settings"),

  updateSettings: (patch: Partial<OwnerSettings>) =>
    req<OwnerSettings>("/owner/settings", { method: "PUT", body: patch }),

  getOwnerPromotions: () => req<OwnerPromotion[]>("/owner/promotions"),

  createPromotion: (body: { title: string; subtitle: string; tag: string }) =>
    req<OwnerPromotion>("/owner/promotions", { method: "POST", body }),

  updatePromotion: (
    id: string,
    body: Partial<{ title: string; subtitle: string; tag: string }>,
  ) => req<OwnerPromotion>(`/owner/promotions/${id}`, { method: "PUT", body }),

  deletePromotion: (id: string) =>
    req<void>(`/owner/promotions/${id}`, { method: "DELETE" }),

  getStaff: () => req<OwnerStaffMember[]>("/owner/staff"),

  getRoles: () => req<OwnerRole[]>("/owner/roles"),

  getMemberships: () => req<OwnerMembershipRow[]>("/owner/memberships"),

  getWallets: () => req<OwnerWalletRow[]>("/owner/wallets"),

  // --- CRM ---
  getCrmOverview: () => req<OwnerCrmOverview>("/owner/crm/overview"),

  getSegments: () => req<OwnerSegment[]>("/owner/segments"),

  createSegment: (body: { name: string; description: string }) =>
    req<OwnerSegment>("/owner/segments", { method: "POST", body }),

  deleteSegment: (id: string) =>
    req<void>(`/owner/segments/${id}`, { method: "DELETE" }),

  getTimeline: (customerId: string) =>
    req<OwnerTimelineEntry[]>(`/owner/timeline/${customerId}`),

  getBroadcasts: () => req<OwnerBroadcast[]>("/owner/broadcasts"),

  createBroadcast: (body: {
    title: string;
    message: string;
    channel: OwnerBroadcastChannel;
    segmentId?: string;
  }) => req<OwnerBroadcast>("/owner/broadcasts", { method: "POST", body }),

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
