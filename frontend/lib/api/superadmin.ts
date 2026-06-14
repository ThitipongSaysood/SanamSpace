import type {
  AdminAnnouncement,
  AdminAuditLog,
  AdminInvoice,
  Backup,
  AdminOrganization,
  AdminOrganizationDetail,
  AdminPayment,
  AdminRole,
  AdminSubscription,
  AdminSupportTicket,
  AdminTransaction,
  AdminUser,
  PlatformDashboard,
  PlatformFeature,
  PlatformSettings,
  Plan,
  User,
} from "@/lib/types";

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

  getPayments: () => req<AdminPayment[]>("/admin/payments"),

  getUsers: () => req<AdminUser[]>("/admin/users"),

  getRoles: () => req<AdminRole[]>("/admin/roles"),

  getInvoices: () => req<AdminInvoice[]>("/admin/invoices"),

  markInvoicePaid: (id: string) =>
    req<AdminInvoice>(`/admin/invoices/${id}/pay`, { method: "POST" }),

  sendInvoice: (id: string) =>
    req<{ sent: boolean; email?: string; isReceipt?: boolean }>(`/admin/invoices/${id}/send`, {
      method: "POST",
      raw: true,
    }),

  getTransactions: () => req<AdminTransaction[]>("/admin/transactions"),

  getSupportTickets: () => req<AdminSupportTicket[]>("/admin/support-tickets"),

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

  getAuditLogs: () => req<AdminAuditLog[]>("/admin/audit-logs"),

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
