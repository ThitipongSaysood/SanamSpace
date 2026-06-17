export type Sport = "badminton" | "football" | "futsal" | "tennis";

export type DayHours = { day: string; open: string; close: string };

export type CourtSpec = { sport: string; floor: string; aircon: string; height: string; lighting: string; standard: string; players: string };

export type Venue = {
  id: string;
  name: string;
  sports: Sport[];
  rating: number;        // 0..5
  reviewCount: number;
  openTime: string;      // "10:00"
  closeTime: string;     // "22:00"
  address: string;
  imageUrl: string;
  photos?: string[];     // gallery images (owner-managed)
  planImageUrl?: string; // floor-plan image for the venue map page
  facilities: string[];  // e.g. ["parking","shower","cafe"]
  pricePerHour: number;  // THB, "from" price shown on cards
  distanceKm: number;    // distance from user, for list display
  phone?: string;
  travelHint?: string;   // e.g. "15 นาทีจาก MRT ..."
  peakNote?: string;     // peak-hours advisory
  description?: string;
  weekHours?: DayHours[];
};

export type Court = {
  id: string;
  venueId: string;
  name: string;          // "Court 1"
  sport: Sport;
  pricePerHour: number;  // THB
  imageUrl?: string | null;
  spec?: CourtSpec;
};

export type Slot = {
  start: string;         // "18:00"
  end: string;           // "19:00"
  status: "available" | "booked" | "closed";
};

export type CourtSchedule = { courtId: string; date: string; slots: Slot[] };

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled" | "completed";

export type Booking = {
  id: string;
  code: string;          // "BK240S250012"
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  date: string;          // "2026-06-20"
  start: string;
  end: string;
  amount: number;        // THB total
  status: BookingStatus;
  createdAt: string;
};

// Public per-venue LINE config for the customer frontend (GET /line-config).
export type LineConfig = { liffId: string | null };

// Public per-venue branding for the multi-tenant login page (GET /orgs/{slug}/public).
export type OrgPublic = {
  slug: string;
  name: string;
  logoText: string;
  logoUrl: string | null;
  liffId: string | null;
  theme: { primary: string; warning: string; danger: string };
  lineOaUrl: string | null;
  phone: string | null;
};

// --- Refunds (customer requests → owner/admin approve; credit to wallet or manual) ---
export type RefundStatus = "requested" | "approved" | "rejected";

export type Refund = {
  id: string;
  bookingId: string;
  bookingCode?: string | null;
  amount: number;
  reason?: string | null;
  status: RefundStatus;
  method?: string | null;      // "wallet" | "manual" — set at approval
  requestedBy: string;         // "customer" | "owner" | "admin"
  note?: string | null;        // staff note on approve/reject
  createdAt: string;
  processedAt?: string | null;
};

export type OwnerRefund = Refund & { customerName?: string | null };
export type AdminRefund = Refund & { organizationName?: string | null; customerName?: string | null };

export type PaymentMethod = "promptpay" | "transfer" | "wallet" | "card";
export type PaymentStatus = "awaiting_slip" | "pending_review" | "approved" | "rejected";

export type Payment = {
  id: string;
  bookingId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  slipUrl?: string;
};

// How to pay a specific payment, for the venue that receives the money.
export type PaymentInstructions = {
  amount: number;
  method: string;
  payTo: string | null;
  promptpay: { payload: string } | null; // EMVCo PromptPay string → render as QR
  bank: { bankName: string | null; accountName: string | null; accountNumber: string | null } | null;
};

export type User = { id: string; displayName: string; lineId: string; avatarUrl?: string; email?: string; phone?: string };

export type Review = { id: string; author: string; rating: number; date: string; text: string };

export type ReviewSummary = {
  average: number;
  total: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  reviews: Review[];
};

export type VenuePackage = { id: string; name: string; hours: number; price: number; validDays: number; savePercent: number };

// A package the customer has bought (after the venue approves it, status=active).
export type CustomerPackage = {
  id: string;
  name: string;
  totalHours: number;
  remainingHours: number;
  price: number;
  validDays: number;
  status: string; // pending | pending_review | active | rejected | expired
  expiresAt: string | null;
};

export type PackagePurchaseInstructions = {
  purchaseId: string;
  amount: number;
  promptpay: { payload: string } | null;
  bank: { bankName: string | null; accountName: string | null; accountNumber: string | null } | null;
};

export type Membership = {
  tier: "Silver" | "Gold" | "Platinum";
  memberId: string;
  points: number;
  expiresAt: string;
  benefits: string[];
};

export type WalletTxn = { id: string; date: string; label: string; amount: number; status?: string };

export type Wallet = { balance: number; transactions: WalletTxn[] };

export type WalletTopupInstructions = {
  transactionId: string;
  amount: number;
  promptpay: { payload: string } | null;
  bank: { bankName: string | null; accountName: string | null; accountNumber: string | null } | null;
};

export type Promotion = { id: string; title: string; subtitle: string; tag: "ส่วนลด" | "แพ็กเกจ" };

export type AppNotification = {
  id: string;
  kind: "booking" | "reminder" | "promo" | "points";
  title: string;
  body: string;
  timeAgo: string;
};

// --- Owner Admin Portal ---
export type OwnerRevenuePoint = { date: string; revenue: number };

export type OwnerStatusBreakdown = {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  completed: number;
};

export type OwnerSportSales = { sport: string; revenue: number; count: number };

export type OwnerBookingChannel = { channel: string; count: number };

export type OwnerActionItems = {
  pendingSlips: number;
  nearTime: number;
  todayBookings: number;
  cancelledToday: number;
};

export type OwnerRecentBooking = {
  id: string;
  code: string;
  customerName: string;
  courtName: string;
  date: string;
  start: string;
  end: string;
  amount: number;
  status: string;
};

export type OwnerDashboard = {
  todayBookings: number;
  todayRevenue: number;
  pendingSlips: number;
  confirmedToday: number;
  totalCustomers: number;
  courtCount: number;
  newCustomersToday: number;
  utilizationRate: number;
  walletBalance: number;
  revenueSeries: OwnerRevenuePoint[];
  statusBreakdown: OwnerStatusBreakdown;
  sportSales: OwnerSportSales[];
  bookingChannels: OwnerBookingChannel[];
  actionItems: OwnerActionItems;
  recentBookings: OwnerRecentBooking[];
  deltas?: { todayRevenue: number; todayBookings: number; newCustomersToday: number };
};

export type OwnerCourtBlock = {
  id: string;
  courtId: string;
  courtName: string | null;
  date: string;
  start: string | null;
  end: string | null;
  reason: string | null;
};

export type OwnerAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  publishedAt: string | null;
};

export type OwnerBooking = Booking & { customerName?: string };

export type OwnerPayment = {
  id: string;
  bookingId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  slipUrl?: string;
  customerName?: string;
  booking?: { code: string; courtName: string; date: string; start: string; end: string };
};

export type OwnerCustomer = {
  id: string;
  displayName: string;
  phone?: string;
  email?: string;
  totalSpending: number;
  visits: number;
  bookingsCount: number;
};

// Owner-side org settings (GET/PUT /owner/settings).
export type OwnerSettings = {
  orgName: string;
  logoText: string;
  logoUrl?: string | null;
  phone: string;
  email: string;
  address: string;
  googleMapUrl: string;
  lineOaUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  timezone: string;
  // Payment — where this venue receives booking money
  promptpayId?: string | null;
  promptpayName?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  // LINE (per-venue). Secrets are write-only: never returned, only a *Set flag.
  lineChannelId?: string | null;
  lineLiffId?: string | null;
  lineChannelSecretSet?: boolean;
  lineMessagingTokenSet?: boolean;
};

export type OwnerPromotion = {
  id: string;
  title: string;
  subtitle: string;
  tag: "ส่วนลด" | "แพ็กเกจ";
  sortOrder: number;
};

// active = เปิด, inactive = ปิด
export type OwnerStatus = "active" | "inactive";

export type OwnerCourt = {
  id: string;
  branchId: string;
  branchName?: string | null;
  name: string;
  sport: Sport;
  pricePerHour: number;
  imageUrl?: string | null;
  status: OwnerStatus;
  sortOrder: number;
  spec?: Partial<Omit<CourtSpec, "sport">>;
};

export type OwnerBranch = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  openTime?: string | null; // "HH:MM"
  closeTime?: string | null;
  status: OwnerStatus;
  sports: string[];
  facilities: string[];
  imageUrl?: string | null;
  photos: string[];
  planImageUrl?: string | null;
  description?: string | null;
  travelHint?: string | null;
  peakNote?: string | null;
  weekHours?: DayHours[];
  rating?: number;
  reviewCount?: number;
  courtCount: number;
};

export type OwnerStaffMember = {
  id: string;
  displayName: string;
  email: string;
  roleName: string;
  status: string;
  joinedAt: string;
};

export type OwnerRole = {
  id: string;
  name: string;
  isSystemRole: boolean;
};

export type OwnerMembershipRow = {
  id: string;
  customerName: string;
  tier: string;
  memberId: string;
  points: number;
  expiresAt: string;
};

export type OwnerWalletRow = {
  id: string;
  customerName: string;
  balance: number;
  transactionCount: number;
};

export type OwnerWalletTopup = {
  id: string;
  customerName: string | null;
  amount: number;
  slipUrl: string | null;
  date: string;
};

export type OwnerPackagePurchase = {
  id: string;
  customerName: string | null;
  packageName: string;
  hours: number;
  price: number;
  slipUrl: string | null;
};

// --- Owner CRM ---
export type OwnerCrmSegmentSlice = { name: string; count: number };

export type OwnerCrmOverview = {
  totalCustomers: number;
  newCustomers30d: number;
  inactive30d: number;
  vipCount: number;
  segmentDistribution: OwnerCrmSegmentSlice[];
};

export type OwnerSegment = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
};

export type OwnerTimelineEntry = {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
};

export type OwnerBroadcastChannel = "line" | "email" | "sms" | "push";

export type OwnerBroadcast = {
  id: string;
  title: string;
  message: string;
  channel: OwnerBroadcastChannel;
  status: "draft" | "sent";
  recipientCount: number;
  sentAt: string | null;
  segmentName: string | null;
};

// --- Super Admin (Platform) Portal ---
export type PlatformDashboard = {
  totalOrganizations: number;
  activeOrganizations: number;
  activeSubscriptions: number;
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  mrr: number;
  revenueByPlan: { plan: string; amount: number }[];
  revenueSeries: { label: string; revenue: number }[];
  topOrganizations: { name: string; revenue: number }[];
};

export type AdminOrganizationDetail = {
  id: string;
  name: string;
  businessType: string | null;
  status: string;
  timezone: string | null;
  createdAt: string | null;
  owner: { name: string; email: string } | null;
  settings: {
    primaryColor?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    lineOaUrl?: string | null;
    timezone?: string | null;
    // LINE (per-venue), admin override. Secrets are write-only (*Set flags only).
    lineChannelId?: string | null;
    lineLiffId?: string | null;
    lineChannelSecretSet?: boolean;
    lineMessagingTokenSet?: boolean;
  } | null;
  subscription: {
    planName: string | null;
    status: string;
    interval: string | null;
    price: number | null;
    startedAt: string | null;
    endsAt: string | null;
    daysRemaining: number | null;
  } | null;
  subscriptionStatus: string | null;
  counts: { branches: number; courts: number; customers: number };
  plan?: Plan | null;
};

export type AdminOrganization = {
  id: string;
  name: string;
  email?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  status: string;
  planName: string | null;
  subscriptionStatus: string | null;
  branchCount: number;
  courtCount: number;
  customerCount: number;
  userCount: number;
  revenue: number;
  expiresAt?: string | null;
  daysRemaining?: number | null;
  createdAt: string;
};

export type AdminSubscription = {
  id: string;
  organizationName: string;
  planName: string | null;
  price: number;
  status: string;
  startedAt: string | null;
  endsAt: string | null;
  daysRemaining: number | null;
};

// Current org's subscription (owner portal). Same shape as AdminSubscription.
export type OwnerSubscription = AdminSubscription;

export type AdminPayment = {
  id: string;
  organizationName: string | null;
  customerName: string | null;
  bookingCode: string | null;
  method: string;
  amount: number;
  status: string;
  createdAt: string | null;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  status: string;
  createdAt: string | null;
};

export type AdminRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  scope: string;
  permissionCount: number;
};

export type AdminInvoice = {
  id: string;
  number: string;
  organizationName: string;
  amount: number;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string | null;
};

export type AdminTransaction = {
  id: string;
  organizationName: string;
  type: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string | null;
};

export type AdminSupportTicket = {
  id: string;
  ticketNo: string;
  organizationName: string;
  subject: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  updatedAt: string | null;
};

export type AdminAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  status: string;
  publishedAt: string | null;
};

export type AdminAuditLog = {
  id: string;
  userName: string;
  action: string;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string | null;
};

export type PlatformSettings = {
  platformName: string;
  supportEmail: string | null;
  timezone: string;
  currency: string;
  dateFormat: string;
  language: string;
  // Mail / SMTP (stored in DB, overrides .env at runtime)
  mailMailer: string;
  mailHost: string | null;
  mailPort: string | null;
  mailUsername: string | null;
  mailEncryption: string | null;
  mailFromAddress: string | null;
  mailFromName: string | null;
  mailPasswordSet: boolean;
  mailPassword?: string; // write-only: blank = keep existing
  // Platform billing payment details
  promptpayId: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  // Security
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  twoFactorRequired: boolean;
  // Notifications
  notifyNewOrg: boolean;
  notifyPayment: boolean;
  notifySubscriptionExpiring: boolean;
  notifySupportTicket: boolean;
  // Backup
  backupFrequency: string;
  backupRetentionDays: number;
};

export type Backup = {
  name: string;
  size: number;
  sizeLabel: string;
  createdAt: string;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  price: number;
  interval: string;
  branchLimit: number | null;
  courtLimit: number | null;
  staffLimit: number | null;
  monthlyBookingLimit: number | null;
  storageGb: number | null;
  isActive: boolean;
  featureCodes: string[];
};

export type PlatformFeature = {
  id: string;
  code: string;
  name: string;
  planCodes: string[];
};
