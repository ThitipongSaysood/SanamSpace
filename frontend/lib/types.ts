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

export type User = { id: string; displayName: string; lineId: string; avatarUrl?: string; email?: string; phone?: string };

export type Review = { id: string; author: string; rating: number; date: string; text: string };

export type ReviewSummary = {
  average: number;
  total: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  reviews: Review[];
};

export type VenuePackage = { id: string; name: string; hours: number; price: number; validDays: number; savePercent: number };

export type Membership = {
  tier: "Silver" | "Gold" | "Platinum";
  memberId: string;
  points: number;
  expiresAt: string;
  benefits: string[];
};

export type WalletTxn = { id: string; date: string; label: string; amount: number };

export type Wallet = { balance: number; transactions: WalletTxn[] };

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
  description?: string | null;
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
  activeSubscriptions: number;
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  mrr: number;
};

export type AdminOrganization = {
  id: string;
  name: string;
  status: string;
  planName: string | null;
  subscriptionStatus: string | null;
  branchCount: number;
  courtCount: number;
  customerCount: number;
  createdAt: string;
  // Detail-only fields (GET /admin/organizations/{id})
  settings?: Record<string, unknown> | null;
  featureCodes?: string[];
};

export type AdminSubscription = {
  id: string;
  organizationName: string;
  planName: string | null;
  price: number;
  status: string;
  startedAt: string | null;
  endsAt: string | null;
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
