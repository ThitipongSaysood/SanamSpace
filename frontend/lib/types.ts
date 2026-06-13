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
export type OwnerDashboard = {
  todayBookings: number;
  todayRevenue: number;
  pendingSlips: number;
  confirmedToday: number;
  totalCustomers: number;
  courtCount: number;
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
