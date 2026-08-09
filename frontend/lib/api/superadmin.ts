import { fetchPdf } from "./owner";
import type {
  AdminAnnouncement,
  AdminAuditLog,
  AdminInvoice,
  Backup,
  AdminOrganization,
  AdminOrganizationDetail,
  AdminPayment,
  AdminRefund,
  AdminPermission,
  AdminRole,
  AdminSubscription,
  AdminSupportTicket,
  AdminTransaction,
  AdminUser,
  AdminUserInput,
  BillingDocument,
  PlatformDashboard,
  PlatformFeature,
  PlatformSettings,
  Plan,
  User,
} from "@/lib/types";
import { toPage } from "./paged";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

// The platform-admin session uses its OWN localStorage keys so it never clobbers
// the owner session ("sanamspace.owner_token" / "sanamspace.owner_user") or the
// customer session ("sanamspace.token" / "sanamspace.profile"). All three coexist.
const TOKEN_KEY = "sanamspace.admin_token";
const USER_KEY = "sanamspace.admin_user";

export class SuperAdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "SuperAdminApiError";
  }
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
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
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });

  // Same reason as the owner client: a token that exists but no longer works
  // passes the layout's guard and then fails everything, leaving every screen
  // telling the user to retry something that cannot succeed.
  if (res.status === 401 && !path.includes("/auth/")) {
    clearAdminToken();
    if (typeof window !== "undefined" && !window.location.pathname.endsWith("/login")) {
      window.location.replace("/admin/login");
    }
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new SuperAdminApiError(res.status, (json as { message?: string })?.message ?? res.statusText);
  }
  // Laravel API Resources wrap list/item responses in { data: ... }; dashboard/login are plain.
  if (raw) return json as T;
  return (json && typeof json === "object" && "data" in json ? json.data : json) as T;
}

export const superAdminApi = {
  async adminLogin(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await req<{ token: string; user: User }>("/auth/admin/login", {
      method: "POST",
      body: { email, password },
      raw: true,
    });
    setAdminToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  logout(): void {
    clearAdminToken();
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

  getDashboard: () => req<PlatformDashboard>("/admin/dashboard", { raw: true }),

  getOrganizations: () => req<AdminOrganization[]>("/admin/organizations"),

  getOrganization: (id: string) => req<AdminOrganizationDetail>(`/admin/organizations/${id}`),

  suspendOrg: (id: string) =>
    req<AdminOrganizationDetail>(`/admin/organizations/${id}/suspend`, { method: "POST" }),

  activateOrg: (id: string) =>
    req<AdminOrganizationDetail>(`/admin/organizations/${id}/activate`, { method: "POST" }),

  changeOrgPlan: (id: string, planId: string) =>
    req<AdminOrganizationDetail>(`/admin/organizations/${id}/plan`, { method: "PUT", body: { planId } }),

  /**
   * Renew from the screen that shows the expiry date.
   *
   * `markPaid` is for money that arrived before the paperwork. It still issues
   * the invoice and the receipt — the alternative an admin reaches for is
   * editing the expiry date, and then the payment exists nowhere.
   *
   * `reusedOutstanding` says the venue already owed this invoice, so the UI can
   * avoid implying it just billed them a second time.
   */
  renewOrg: (id: string, body: { months: number; markPaid?: boolean; planId?: string }) =>
    req<{ data: AdminOrganizationDetail; invoice: AdminInvoice; reusedOutstanding: boolean }>(
      `/admin/organizations/${id}/renew`,
      { method: "POST", body, raw: true },
    ),

  /** The escape hatch: no money moves, so the reason is required and recorded. */
  setOrgExpiry: (id: string, endsAt: string, reason: string) =>
    req<AdminOrganizationDetail>(`/admin/organizations/${id}/expiry`, {
      method: "PUT",
      body: { endsAt, reason },
    }),

  startOrgTrial: (id: string, planId: string, days: number) =>
    req<AdminOrganizationDetail>(`/admin/organizations/${id}/trial`, {
      method: "POST",
      body: { planId, days },
    }),

  // Per-venue LINE override. Secrets are write-only: send a value to set it, omit
  // or send "" to keep the existing one. The response never echoes raw secrets.
  updateOrganizationSettings: (
    id: string,
    patch: Partial<{
      lineChannelId: string;
      lineLiffId: string;
      lineChannelSecret: string;
      lineMessagingToken: string;
    }>,
  ) => req<AdminOrganizationDetail>(`/admin/organizations/${id}/settings`, { method: "PUT", body: patch }),

  deleteOrg: (id: string) => req<void>(`/admin/organizations/${id}`, { method: "DELETE" }),

  impersonateOrg: (id: string) =>
    req<{ token: string; user: User }>(`/admin/organizations/${id}/impersonate`, {
      method: "POST",
      raw: true,
    }),

  getSubscriptions: () => req<AdminSubscription[]>("/admin/subscriptions"),

  getPlans: () => req<Plan[]>("/admin/plans"),

  createOrg: (body: { name: string; ownerName: string; email: string; phone?: string; planId?: string }) =>
    req<AdminOrganizationDetail>("/admin/organizations", { method: "POST", body }),

  createPlan: (body: { name: string; code: string; price: number; interval: string; isActive?: boolean }) =>
    req<Plan>("/admin/plans", { method: "POST", body }),

  updatePlan: (
    id: string,
    body: Partial<{ name: string; price: number; interval: string; isActive: boolean }>,
  ) => req<Plan>(`/admin/plans/${id}`, { method: "PUT", body }),

  updatePlanFeatures: (id: string, featureIds: string[]) =>
    req<Plan>(`/admin/plans/${id}/features`, { method: "PUT", body: { featureIds } }),

  getFeatures: () => req<PlatformFeature[]>("/admin/features"),

  /**
   * Switch one cell of the plan × feature grid.
   *
   * A cell rather than the whole matrix: two operators editing different plans
   * would otherwise overwrite each other's work.
   */
  setFeaturePlan: (featureId: string, planId: string, enabled: boolean) =>
    req<{ featureId: string; planId: string; enabled: boolean }>(
      `/admin/features/${featureId}/plans/${planId}`,
      { method: "PUT", body: { enabled } },
    ),

  getPayments: () => req<AdminPayment[]>("/admin/payments"),

  // --- Refunds (platform oversight across all orgs; approve/reject override) ---
  getRefunds: () => req<AdminRefund[]>("/admin/refunds"),

  approveRefund: (id: string, method: "wallet" | "manual", note?: string) =>
    req<AdminRefund>(`/admin/refunds/${id}/approve`, { method: "POST", body: { method, note } }),

  rejectRefund: (id: string, note?: string) =>
    req<AdminRefund>(`/admin/refunds/${id}/reject`, { method: "POST", body: { note } }),

  getUsers: () => req<AdminUser[]>("/admin/users"),

  createUser: (body: AdminUserInput) => req<AdminUser>("/admin/users", { method: "POST", body }),

  updateUser: (id: string, body: Partial<AdminUserInput>) =>
    req<AdminUser>(`/admin/users/${id}`, { method: "PUT", body }),

  /** Blocks sign-in and drops their tokens; the record stays. */
  suspendUser: (id: string) => req<AdminUser>(`/admin/users/${id}/suspend`, { method: "POST" }),

  activateUser: (id: string) => req<AdminUser>(`/admin/users/${id}/activate`, { method: "POST" }),

  getRoles: () => req<AdminRole[]>("/admin/roles"),

  getPermissions: () => req<AdminPermission[]>("/admin/permissions"),

  /** Replaces the role's whole set — unchecking matters as much as checking. */
  updateRolePermissions: (id: string, permissionIds: string[]) =>
    req<AdminRole>(`/admin/roles/${id}/permissions`, { method: "PUT", body: { permissionIds } }),

  /** Stops the renewal; the venue keeps working until the period ends. */
  cancelSubscription: (id: string) =>
    req<AdminSubscription>(`/admin/subscriptions/${id}/cancel`, { method: "POST" }),

  /** Ends the plan now — the owner portal locks immediately. */
  suspendSubscription: (id: string) =>
    req<AdminSubscription>(`/admin/subscriptions/${id}/suspend`, { method: "POST" }),

  resumeSubscription: (id: string, endsAt?: string) =>
    req<AdminSubscription>(`/admin/subscriptions/${id}/resume`, { method: "POST", body: { endsAt } }),

  getInvoicesPage: async (page: number, status?: string) =>
    toPage<AdminInvoice>(
      await req(`/admin/invoices?page=${page}${status ? `&status=${encodeURIComponent(status)}` : ""}`, { raw: true }),
    ),

  getTransactionsPage: async (page: number) =>
    toPage<AdminTransaction>(await req(`/admin/transactions?page=${page}`, { raw: true })),

  /** `status` narrows the list — "pending_review" is the queue awaiting a decision. */
  getInvoices: (status?: string) =>
    req<AdminInvoice[]>(`/admin/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`),

  /** The document as a PDF (blob URL — the endpoint needs the bearer token). */
  getInvoiceDocumentPdf: (id: string) => fetchPdf(`/admin/invoices/${id}/document.pdf`, getAdminToken()),

  /** The printable document for an invoice — same payload the venue sees. */
  getInvoiceDocument: (id: string) => req<BillingDocument>(`/admin/invoices/${id}/document`),

  /**
   * Confirms the money arrived — this is what actually extends the venue's
   * subscription, so it is both "approve this slip" and "mark as paid".
   */
  markInvoicePaid: (id: string) =>
    req<AdminInvoice>(`/admin/invoices/${id}/pay`, { method: "POST" }),

  /** Turn down a submitted slip; the venue can transfer again. */
  rejectInvoice: (id: string, reason?: string) =>
    req<AdminInvoice>(`/admin/invoices/${id}/reject`, { method: "POST", body: { reason } }),

  /** Bill a venue directly, for venues that would rather be invoiced. */
  createInvoice: (organizationId: string, periodMonths: number) =>
    req<AdminInvoice>("/admin/invoices", { method: "POST", body: { organizationId, periodMonths } }),

  sendInvoice: (id: string) =>
    req<{ sent: boolean; email?: string; isReceipt?: boolean }>(`/admin/invoices/${id}/send`, {
      method: "POST",
      raw: true,
    }),

  getTransactions: () => req<AdminTransaction[]>("/admin/transactions"),

  getSupportTickets: () => req<AdminSupportTicket[]>("/admin/support-tickets"),

  getSupportTicket: (id: string) => req<AdminSupportTicket>(`/admin/support-tickets/${id}`),

  /** Answer the venue. The reply is recorded and emailed to their contact address. */
  replySupportTicket: (id: string, body: string) =>
    req<AdminSupportTicket>(`/admin/support-tickets/${id}/replies`, { method: "POST", body: { body } }),

  updateSupportTicketStatus: (id: string, status: string, assignedTo?: string) =>
    req<AdminSupportTicket>(`/admin/support-tickets/${id}/status`, {
      method: "PUT",
      body: { status, ...(assignedTo !== undefined ? { assignedTo } : {}) },
    }),

  getAnnouncements: () => req<AdminAnnouncement[]>("/admin/announcements"),

  createAnnouncement: (body: { title: string; body?: string; audience: string; status: string }) =>
    req<AdminAnnouncement>("/admin/announcements", { method: "POST", body }),

  updateAnnouncement: (
    id: string,
    body: Partial<{ title: string; body: string; audience: string; status: string }>,
  ) => req<AdminAnnouncement>(`/admin/announcements/${id}`, { method: "PUT", body }),

  toggleAnnouncement: (id: string) =>
    req<AdminAnnouncement>(`/admin/announcements/${id}/toggle`, { method: "POST" }),

  deleteAnnouncement: (id: string) =>
    req<void>(`/admin/announcements/${id}`, { method: "DELETE" }),

  /** `organizationId` accepts a slug — every admin screen addresses venues that way. */
  getAuditLogs: (organizationId?: string) =>
    req<AdminAuditLog[]>(
      organizationId ? `/admin/audit-logs?organizationId=${encodeURIComponent(organizationId)}` : "/admin/audit-logs",
    ),

  getSettings: () => req<PlatformSettings>("/admin/settings"),

  updateSettings: (patch: Partial<PlatformSettings>) =>
    req<PlatformSettings>("/admin/settings", { method: "PUT", body: patch }),

  getBackups: () => req<Backup[]>("/admin/backups"),

  runBackup: () => req<Backup>("/admin/backups", { method: "POST" }),

  // Download a backup file with the admin token, then save it via the browser.
  async downloadBackup(name: string): Promise<void> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}/admin/backups/${encodeURIComponent(name)}/download`, { headers });
    if (!res.ok) throw new SuperAdminApiError(res.status, "ดาวน์โหลดไม่สำเร็จ");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
