/**
 * A sport key, e.g. "badminton", "pickleball".
 *
 * Deliberately not a union any more. It was `"badminton" | "football" |
 * "futsal" | "tennis"` — a claim the platform only ever had four sports, which
 * was never true (the app could draw ten) and is now decided by a table the
 * admin edits. A union here cannot know what is in that table, and pretending
 * otherwise only pushed casts into every call site.
 *
 * What a key means is `SportMeta`; which keys exist is the catalogue.
 */
export type Sport = string;

export type DayHours = { day: string; open: string; close: string };

export type CourtSpec = { sport: string; floor: string; aircon: string; height: string; lighting: string; standard: string; players: string };

export type Venue = {
  /** The venue (organization) slug — shared by every branch it runs. */
  id: string;
  /** This branch's own id. Use it whenever one branch is meant, not the venue. */
  branchId: string;
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
  /**
   * The branch this court stands in.
   *
   * A venue can have several, and they are different places to drive to — the
   * payload used to say only which venue a court belonged to, which is no help
   * to someone choosing between them.
   */
  branchId: string;
  branchName?: string | null;
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

/** One equipment line on a booking — name and price as quoted. */
export type BookingRental = {
  id: string;
  name: string;
  unitPrice: number;
  priceUnit: "per_session" | "per_hour";
  quantity: number;
  lineTotal: number;
  /** How many came back. Partial by design — two out, one back is real. */
  returnedQty?: number;
  returnedAt?: string | null;
};

/** A rental line whose booking is over and whose gear is still not back. */
export type OutstandingRental = {
  id: string;
  bookingId: string;
  bookingCode: string;
  customerId?: string | null;
  customerName: string;
  courtName: string;
  date: string;
  start: string;
  end: string;
  name: string;
  quantity: number;
  returnedQty: number;
  outstandingQty: number;
};

/** Something the venue lends out. availableQty/priceForBooking are per time window. */
export type RentalItem = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  priceUnit: "per_session" | "per_hour";
  stockQty: number;
  imageUrl: string | null;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
  availableQty?: number;
  priceForBooking?: number;
};

export type RentalItemInput = {
  name?: string;
  category?: string | null;
  price?: number;
  priceUnit?: "per_session" | "per_hour";
  stockQty?: number;
  imageUrl?: string | null;
  note?: string | null;
  isActive?: boolean;
};

export type Booking = {
  id: string;
  code: string;          // "BK240S250012"
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  /**
   * What the booked court is, and what it looks like.
   *
   * The detail screen drew a hard-coded shuttlecock before these existed, so a
   * tennis court's confirmation showed badminton. Both nullable: a booking
   * outlives the court it was made on.
   */
  courtSport?: string | null;
  courtImageUrl?: string | null;
  date: string;          // "2026-06-20"
  start: string;
  end: string;
  amount: number;        // THB grand total (court + rentals)
  /** The parts of `amount`, so the customer sees why it is what it is. */
  courtAmount?: number;
  rentalTotal?: number;
  rentals?: BookingRental[];
  status: BookingStatus;
  createdAt: string;
  /**
   * Pay-by deadline for an unpaid hold (created_at + hold window). The app
   * counts down to it and clears the "waiting to pay" prompt once it passes.
   * Null when it is no longer a live hold (slip sent / confirmed / cancelled).
   */
  expiresAt?: string | null;
  /** What the check-in QR encodes. Not the code — that is guessable. */
  checkinToken?: string | null;
  /** When the counter scanned them in. Null = has not arrived. */
  checkedInAt?: string | null;
  /**
   * The latest payment's status. Booking status alone cannot tell "not paid
   * yet" from "slip sent, waiting for the venue" — both sit at
   * `pending_payment`.
   */
  paymentStatus?: PaymentStatus | null;
  paymentId?: string | null;
  /** The transfer slip, so it can be read next to the booking it belongs to. */
  paymentSlipUrl?: string | null;
  paymentMethod?: PaymentMethod | null;
  /**
   * Deposits. With one, `confirmed` no longer means "paid in full" — the slot
   * is held once the deposit lands and a balance can still be owed.
   */
  depositAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  /** Why it cost less than the court price. Snapshotted at booking time. */
  discountAmount?: number;
  discountLabel?: string | null;
  /**
   * Credit spent on this booking, in hours — that is the unit the venue sells
   * packages in. Absent when no package paid for it.
   */
  credit?: {
    packageName: string | null;
    hoursUsed: number;
    redeemedAt: string | null;
    remainingHours: number | null;
  } | null;
};

/** One customer's holdings, for the credit screen. */
export type OwnerCustomerCredit = {
  id: string;
  displayName: string;
  phone: string | null;
  /** Credit in baht. Pays for anything. */
  balance: number;
  /** Court time from packages. Pays for the court only. */
  creditHours: number;
  packages: { id: string; name: string; totalHours: number; remainingHours: number; expiresAt: string | null }[];
};

/** One reward handed over at the counter, or waiting to be. */
export type OwnerRedemption = {
  id: string;
  name: string;
  pointsSpent: number;
  customerId?: string | null;
  customerName: string | null;
  byName: string | null;
  status: "pending" | "collected" | "expired";
  /** Only carried while pending — after that there is nothing to collect. */
  code: string | null;
  createdAt: string;
};

/**
 * What the counter's scanner made of a code.
 *
 * `kind` is the whole point: the desk needs to know whether it just let someone
 * onto a court or handed over a bottle of water, not merely that "it worked".
 */
export type ScanResult = {
  kind: "checkin" | "reward" | "unknown";
  ok: boolean;
  code: string;
  message: string;
  booking?: CheckinResult["booking"];
  reward?: { id: string; name: string; pointsSpent: number; customerId?: string | null; customerName: string | null } | null;
};

/** A reward the customer redeemed. `code` is what the counter asks for. */
export type MyRedemption = {
  id: string;
  name: string;
  pointsSpent: number;
  type: string;
  status: "pending" | "collected" | "expired";
  code: string | null;
  expiresAt: string | null;
  createdAt: string;
};

/** A customer's own points movement. */
export type PointMovement = {
  id: string;
  points: number;
  source: string;
  label: string | null;
  createdAt: string;
};

/**
 * One person who is in the customer list more than once.
 *
 * Grouped by phone because that is the only identifying thing on the record —
 * two customers with the same name are two people.
 */
export type DuplicateGroup = {
  phone: string;
  customers: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    hasLine: boolean;
    bookingsCount: number;
    points: number;
    credit: number;
    createdAt: string;
  }[];
};

/**
 * The venue floor as it stands this minute.
 *
 * `now` is the VENUE's clock, sent so the screen can show which clock it is
 * reading — the server runs on UTC and bookings hold wall-clock times.
 */
export type CourtBoard = {
  now: string;
  timezone: string;
  branches: {
    id: string;
    name: string | null;
    courts: {
      id: string;
      name: string;
      sport: string | null;
      status: "playing" | "free";
      current: {
        bookingId: string;
        code: string;
        customerId?: string | null;
        customerName: string | null;
        start: string;
        end: string;
        minutesLeft: number;
        checkedIn: boolean;
      } | null;
      next: {
        bookingId: string;
        customerId?: string | null;
        customerName: string | null;
        start: string;
        end: string;
        minutesUntil: number;
      } | null;
    }[];
  }[];
};

/**
 * Today at the venue: what is happening, and what needs somebody.
 *
 * Deliberately not the dashboard aggregate — this screen is read at the counter
 * and refreshes; seven days of revenue series is not what it is for.
 */
export type OwnerOperations = {
  now: string;
  today: string;
  tiles: {
    todayBookings: number;
    pendingSlips: number;
    noShow: number;
    cancelledToday: number;
    /** Money still to collect at the counter today. */
    outstanding: number;
  };
  attention: {
    noShow: {
      id: string;
      code: string;
      courtName: string | null;
      customerName: string | null;
      phone: string | null;
      start: string;
      lateMinutes: number;
    }[];
    unpaid: {
      id: string;
      code: string;
      courtName: string | null;
      customerName: string | null;
      start: string;
      end: string;
      amount: number;
      paidAmount: number;
      outstanding: number;
    }[];
    equipmentOut: {
      id: string;
      code: string;
      courtName: string | null;
      customerName: string | null;
      end: string;
      items: { name: string; qty: number }[];
    }[];
  };
  timeline: {
    id: string;
    code: string;
    courtName: string | null;
    customerId?: string | null;
    customerName: string | null;
    start: string;
    end: string;
    status: string;
    amount: number;
    outstanding: number;
    checkedIn: boolean;
    phase: "done" | "now" | "upcoming" | "cancelled";
  }[];
};

/** Something points can be spent on. */
export type OwnerReward = {
  id: string;
  name: string;
  pointsCost: number;
  type: "product" | "credit" | "hours";
  productId: string | null;
  productName: string | null;
  productStock: number | null;
  creditAmount: number | null;
  hours: number | null;
  isActive: boolean;
};

/** What a customer's points buy here, and whether they can afford it. */
export type CustomerReward = {
  id: string;
  name: string;
  pointsCost: number;
  type: string;
  affordable: boolean;
  outOfStock: boolean;
};

/** One movement of a customer's points. No name = the system awarded it. */
export type OwnerPointMovement = {
  id: string;
  points: number;
  source: string;
  label: string | null;
  byName: string | null;
  createdAt: string;
};

/**
 * An hour package the venue sells to its customers.
 *
 * Not to be confused with the venue's own subscription to the platform (that is
 * `OwnerSubscription`, under "แพ็กเกจ/ต่ออายุ"). This one is court time sold
 * ahead at a discount, priced in HOURS — credit is the baht balance.
 */
export type OwnerVenuePackage = {
  id: string;
  name: string;
  hours: number;
  price: number;
  validDays: number;
  savePercent: number;
  activeHolders: number;
  pricePerHour: number;
};

/**
 * One movement of a customer's credit.
 *
 * `byName` is null when the customer did it themselves — a top-up they paid for
 * is not an action anyone has to answer for.
 */
export type OwnerCreditMovement = {
  id: string;
  label: string;
  amount: number;
  status: string;
  source: string | null;
  byName: string | null;
  createdAt: string;
};

/** What a code would do, asked before committing to the booking. */
export type CouponPreview = {
  code: string;
  description: string | null;
  /** "ทุกวัน 07:00–16:00" when the coupon only applies to certain hours. */
  condition?: string | null;
  discount: number;
  payable: number;
};

export type OwnerCoupon = {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  minAmount: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  /**
   * When the coupon may be used, on the venue's own clock. Null means no
   * restriction. The WHOLE booking must fit inside the window — a 15:00–17:00
   * slot does not qualify for a 07:00–16:00 coupon, because half of it is peak
   * time the venue never offered.
   */
  validFromTime: string | null;
  validToTime: string | null;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. Null or empty = every day. */
  validDays: number[] | null;
  /** The same rule in words, built server-side so it cannot drift. */
  conditionLabel: string | null;
  isActive: boolean;
};

// Public per-venue LINE config for the customer frontend (GET /line-config).
export type LineConfig = { liffId: string | null };

// Public per-venue branding for the multi-tenant login page (GET /orgs/{slug}/public).
export type OrgPublic = {
  slug: string;
  name: string;
  logoText: string;
  logoUrl: string | null;
  /** The venue's own photo behind its login screen. Null → draw its sport's court. */
  coverUrl?: string | null;
  /** The venue's own line under "เข้าสู่ระบบ". Null → built from its name. */
  tagline?: string | null;
  liffId: string | null;
  theme: { primary: string; secondary: string; accent: string; warning: string; danger: string };
  /** The venue's chosen font, applied to the customer app when set. */
  fontFamily?: string | null;
  /**
   * Announcements the venue is currently showing, topmost first. Only the ones
   * it switched on and actually filled in — the customer app renders whatever
   * arrives here without second-guessing it.
   */
  welcomeBanners?: PublicWelcomeBanner[];
  /** Whether this venue scans customers in at the counter. */
  checkinEnabled?: boolean;
  /** Whether this venue runs a points/loyalty programme. */
  pointsEnabled?: boolean;
  /** The venue's primary sport key (e.g. "badminton", "tennis"). */
  sport?: string | null;
  /** Every sport the venue rents — the loader cycles through these. */
  sports?: string[];
  /**
   * What each of those sports looks like, in the platform's order.
   *
   * The loader and the notification toast used to hold their own tables of
   * emoji and colours, which is how they came to know ten and twelve sports
   * while a venue could only pick four. Same order as `sports`.
   */
  sportMeta?: SportMeta[];
  lineOaUrl: string | null;
  phone: string | null;
};

/** One announcement as the customer app receives it. */
export type PublicWelcomeBanner = {
  id: string;
  title: string | null;
  message: string | null;
  imageUrl: string | null;
  /** Where the card leads when tapped. Blank = not tappable. */
  link: string | null;
  /** Also greet arrivals with this one as a popup. */
  popup: boolean;
};

/** The owner's editable view — includes the ones switched off. */
export type OwnerWelcomeBanner = PublicWelcomeBanner & {
  isActive: boolean;
  sortOrder: number;
};

/** The editable fields when creating or updating a banner. */
export type WelcomeBannerInput = {
  title?: string | null;
  message?: string | null;
  imageUrl?: string | null;
  link?: string | null;
  isActive?: boolean;
  popup?: boolean;
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

export type OwnerRefund = Refund & { customerName?: string | null; customerId?: string | null };
export type AdminRefund = Refund & { organizationName?: string | null; customerName?: string | null };

export type PaymentMethod = "promptpay" | "transfer" | "wallet" | "card";
// `cancelled` closes a payment whose booking went away — it keeps dead slips
// out of the venue's review queue without pretending they were rejected.
export type PaymentStatus = "awaiting_slip" | "pending_review" | "approved" | "rejected" | "cancelled";

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
  /** Free text: the ladder is the venue's own, so the tiers are its names. */
  tier: string;
  memberId: string;
  points: number;
  /**
   * What the TIER is judged on. Separate from `points`, because spending must
   * not demote someone who already reached Gold.
   */
  lifetimePoints?: number;
  nextTier?: string | null;
  pointsToNextTier?: number | null;
  /** Formatted for display; `expiresOn` is the real date behind it. */
  expiresAt: string | null;
  expiresOn?: string | null;
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

export type Promotion = {
  id: string;
  title: string;
  subtitle: string;
  tag: "ส่วนลด" | "แพ็กเกจ";
  /** Code to pre-apply when the customer taps this promo (null = announcement). */
  couponCode?: string | null;
};

/** The customer's own marketing consent (PDPA). `consent: null` = never asked. */
export type MarketingConsent = {
  consent: boolean | null;
  consentAt: string | null;
  unsubscribedAt: string | null;
  /** The one the broadcast audience actually filters on. */
  marketingAllowed: boolean;
};

export type AppNotification = {
  id: string;
  kind: "booking" | "reminder" | "promo" | "points";
  title: string;
  body: string;
  imageUrl?: string | null;
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
  customerId?: string | null;
  customerName: string;
  courtName: string;
  date: string;
  start: string;
  end: string;
  amount: number;
  status: string;
};

export type OwnerDashboard = {
  /**
   * Which branch these numbers are for — null is ทุกสาขา.
   *
   * `totalCustomers`, `newCustomersToday` and `walletBalance` stay venue-wide
   * whatever is selected: a customer and their credit belong to the venue, not
   * to the branch they last played at. The screen labels those so a branch view
   * never implies they are the branch's own.
   */
  scope?: { branchId: string | null; branchName: string | null };
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

export type OwnerBooking = Booking & { customerName?: string; customerId?: string | null };

export type OwnerPayment = {
  id: string;
  bookingId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  slipUrl?: string;
  /** Phase 0 slip screening: "duplicate" = same file/ref already used elsewhere. */
  slipVerifyStatus?: string | null;
  slipDuplicate?: boolean;
  /** What the verifier read off the slip (auto mode) — pre-fills manual review. */
  slipAmount?: number | null;
  slipSender?: string | null;
  customerName?: string;
  customerId?: string | null;
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
  /** Credit in baht: tops up, refunds, adjustments. Pays for anything. */
  creditBalance?: number;
  /** Court time bought ahead as a package. Never summed with the baht. */
  creditHours?: number;
};

// Owner-side org settings (GET/PUT /owner/settings).
export type OwnerSettings = {
  orgName: string;
  /** Whether staff scan customers in at the counter. */
  checkinEnabled?: boolean;
  /** How transfer slips are checked: "manual" (staff) or "auto" (verifier). */
  slipVerifyMode?: "manual" | "auto";
  /**
   * Points. A flat number per booking (the venue chose that over per-baht), and
   * the ladder tiers are judged on — tier names must match `memberDiscounts`,
   * or a tier customers can reach earns them no discount.
   */
  pointsEnabled?: boolean;
  pointsPerBooking?: number;
  /** Off by default: expiring points removes value a customer earned. */
  pointsExpiryEnabled?: boolean;
  pointsValidMonths?: number;
  pointsExpiryWarnDays?: number;
  /** Off by default: a collection code nobody at the counter expects is worse
   *  than no button at all. */
  selfRedeemEnabled?: boolean;
  redeemCollectHours?: number;
  tierThresholds?: Record<string, number> | null;
  /** Percent off the court, per tier. Keyed by the SAME names as the ladder. */
  memberDiscounts?: Record<string, number> | null;
  /** Deposits: hold the slot for part of the money, take the rest at the desk. */
  depositEnabled?: boolean;
  depositType?: "percent" | "fixed";
  depositValue?: number;
  // Billing identity — the buyer block on invoices/receipts.
  taxId?: string | null;
  billingName?: string | null;
  billingAddress?: string | null;
  billingBranch?: string | null;
  /** Read-only. This venue's address: customers open /v/{orgSlug}. */
  orgSlug: string;
  logoText: string;
  logoUrl?: string | null;
  /**
   * The venue's own login screen (/v/{orgSlug}).
   *
   * Both optional, and both meaningfully empty: no cover means the app draws
   * the court of the sport this venue rents, and no tagline means it writes a
   * line from the venue's own name. Neither falls back to platform copy.
   */
  loginCoverUrl?: string | null;
  loginTagline?: string | null;
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
  /** Off → hidden from the customer app. */
  isActive: boolean;
  /** Optional coupon this promo applies when a customer taps it. */
  couponId?: string | null;
  couponCode?: string | null;
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
  /** The user id — memberships are addressed by it. */
  id: string;
  displayName: string;
  email: string;
  roleId: string | null;
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
  customerId?: string | null;
  customerName: string;
  tier: string;
  memberId: string;
  points: number;
  expiresAt: string;
};

export type OwnerWalletRow = {
  id: string;
  customerId?: string | null;
  customerName: string;
  balance: number;
  transactionCount: number;
};

// --- LINE reply templates (the builder) ---
export type LineTemplateEvent = "booking_confirmed" | "payment_received" | "booking_cancelled";

export type LineBlockType =
  | "image"
  | "logo"
  | "title"
  | "text"
  | "divider"
  | "infoRow"
  | "button"
  | "buttonRow";

export type LineButton = {
  label: string;
  url: string;
  style?: "primary" | "secondary" | "link";
  color?: string;
};

/**
 * One block in a LINE template. Deliberately flat with optional props (rather
 * than a discriminated union) so the property editor can read/write any field
 * generically; `type` decides which props the renderer actually uses.
 */
export type LineBlock = {
  type: LineBlockType;
  text?: string;
  url?: string;
  label?: string;
  value?: string;
  size?: string;
  color?: string;
  align?: "start" | "center" | "end";
  weight?: "bold";
  aspectRatio?: string;
  style?: "primary" | "secondary" | "link";
  buttons?: LineButton[];
};

export type LineTemplate = {
  event: LineTemplateEvent;
  enabled: boolean;
  blocks: LineBlock[];
  altText: string;
  isCustom: boolean;
};

export type OwnerWalletTopup = {
  id: string;
  customerId?: string | null;
  customerName: string | null;
  amount: number;
  slipUrl: string | null;
  date: string;
};

export type OwnerPackagePurchase = {
  id: string;
  customerId?: string | null;
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

/**
 * A saved question (dynamic) or a hand-picked list (static).
 *
 * `memberCount` for a dynamic segment is computed when asked, so it moves as
 * customers do — which is the point, and why the UI has to say which kind it is.
 */
export type SegmentCriteria = {
  minBookings?: number;
  maxBookings?: number;
  minSpend?: number;
  maxSpend?: number;
  lastBookingWithinDays?: number;
  notBookedForDays?: number;
  joinedWithinDays?: number;
  tier?: string;
  rfmLabel?: string[];
};

export type OwnerSegment = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  dynamic?: boolean;
  criteria?: SegmentCriteria | null;
};

export type OwnerSegmentMember = {
  id: string;
  displayName: string;
  phone?: string | null;
  totalSpending: number;
  visits: number;
};

/** Recency/Frequency/Monetary, grouped into names staff can act on. */
export type OwnerRfm = {
  total: number;
  groups: Record<string, number>;
  atRisk: { id: string; name: string | null; lastSeenDays: number | null; spend: number }[];
  champions: { id: string; name: string | null; lastSeenDays: number | null; spend: number }[];
};

export type OwnerTimelineEntry = {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
};

// "line" pushes over LINE; "app" shows the promo inside the customer app.
export type OwnerBroadcastChannel = "line" | "app" | "email" | "sms" | "push";

// Smart audience presets computed from booking history, plus a saved segment.
export type OwnerBroadcastAudience =
  | "all"
  | "lost"
  | "new"
  | "one_time"
  | "regulars"
  | "segment";

// What actually went out over LINE (present only on the send response).
export type OwnerBroadcastDelivery = {
  sent: number;
  failed: number;
  skipped: number;
  noToken: boolean;
};

export type OwnerBroadcast = {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  channel: OwnerBroadcastChannel;
  audience: OwnerBroadcastAudience;
  inactiveDays: number | null;
  status: "draft" | "sent";
  recipientCount: number;
  sentAt: string | null;
  segmentId: string | null;
  segmentName: string | null;
  delivery?: OwnerBroadcastDelivery | null;
};

export type OwnerAudiencePreview = {
  recipientCount: number;
  reachableCount: number;
  /** How many of this venue's customers have opted out of marketing (PDPA). */
  suppressedCount: number;
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
    id: string;
    planId: string | null;
    planName: string | null;
    status: string;
    interval: string | null;
    price: number | null;
    startedAt: string | null;
    endsAt: string | null;
    daysRemaining: number | null;
  } | null;
  subscriptionStatus: string | null;
  /**
   * A trial is an ordinary active subscription with an end date, so nothing
   * else on this record distinguishes a venue that has paid nothing from one
   * that pays every month.
   */
  trial: {
    onTrial: boolean;
    startedAt: string | null;
    endsAt: string | null;
  };
  counts: { branches: number; courts: number; customers: number };
  /**
   * What each branch rents.
   *
   * Per branch rather than one list for the venue, because that is where the
   * value lives and branches of one venue genuinely differ — collapsing them
   * would make saving one quietly rewrite the rest.
   */
  branches: { id: string; name: string; sports: string[] }[];
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
  /** On a free trial — otherwise indistinguishable from a paying venue here. */
  onTrial?: boolean;
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
  /** The venue this belongs to — the admin bills it from the subscription list. */
  organizationId?: string | null;
  organizationName: string;
  planName: string | null;
  planCode?: string | null;
  /**
   * Feature codes this plan includes. The owner portal hides what is not here —
   * a menu that always answers 402 is worse than no menu.
   *
   * Anything NOT in the platform catalogue is core and never listed: booking,
   * check-in, customers, refunds. So "absent from this array" only means
   * "withheld" for codes the catalogue actually gates.
   */
  features?: string[];
  /**
   * How much of each ceiling this venue has used.
   *
   * `enforced` is the honest half: branches, courts and staff are refused past
   * the limit, but a monthly booking cap is counted and shown and never blocks
   * a booking — that would take the venue's revenue to enforce the platform's
   * billing, against a customer who does not know a plan exists.
   */
  limits?: Record<
    string,
    { used: number; limit: number | null; label: string; enforced: boolean }
  >;
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
  /** Which permissions this role carries — the editor ticks these. */
  permissionIds: string[];
  /** owner/super_admin bypass every check, so their list is not editable. */
  editable: boolean;
};

/** One entry in the permission catalogue (GET /admin/permissions). */
export type AdminPermission = {
  id: string;
  code: string;
  name: string;
  module: string;
};

/** A platform user as created or edited by an admin. */
export type AdminUserInput = {
  name: string;
  email: string;
  password?: string | null;
  phone?: string | null;
};

/** One customer in full (GET /owner/customers/{id}). */
export type OwnerCustomerDetail = {
  id: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  pictureUrl: string | null;
  totalSpending: number;
  visits: number;
  bookingsCount: number;
  joinedAt: string | null;
  /** PDPA. `marketingConsent: null` = never asked, which is not the same as no. */
  marketingConsent: boolean | null;
  consentAt: string | null;
  unsubscribedAt: string | null;
  membership: { tier: string | null; points: number } | null;
  walletBalance: number;
  recentBookings: {
    id: string;
    code: string | null;
    courtName: string | null;
    date: string;
    start: string;
    end: string;
    amount: number;
    status: BookingStatus;
  }[];
  notes: OwnerCustomerNote[];
  tasks: OwnerCustomerTask[];
};

export type OwnerCustomerNote = {
  id: string;
  body: string;
  author: string | null;
  createdAt: string | null;
};

export type OwnerCustomerTask = {
  id: string;
  title: string;
  dueAt: string | null;
  assignee: string | null;
  status: "open" | "done";
  completedAt: string | null;
};

/**
 * A platform billing document — what a venue pays to keep using SanamSpace.
 * Shared by the Super Admin billing screen and the venue's own billing page.
 *
 * status: unpaid | pending_review | paid | overdue | rejected
 */
export type AdminInvoice = {
  id: string;
  number: string;
  organizationId?: string | null;
  organizationName: string;
  planName?: string | null;
  amount: number;
  periodMonths?: number;
  /** "owner" = the venue renewed itself · "admin" = the platform billed them. */
  source?: "owner" | "admin";
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string | null;
  /** Frozen at issue time — never recomputed from today's rate. */
  subtotal?: number;
  vatAmount?: number;
  vatRate?: number;
  /** Issued only once the money is confirmed. */
  receiptNumber?: string | null;
  receiptDate?: string | null;
  slipUrl?: string | null;
  slipUploadedAt?: string | null;
  rejectReason?: string | null;
};

/** The venue's own billing view: how long it has left, and what it owes. */
export type OwnerBilling = {
  subscription: {
    planName: string | null;
    price: number | null;
    interval: string | null;
    status: string;
    startedAt: string | null;
    endsAt: string | null;
    /** Negative once the plan has lapsed; null when there is no end date. */
    daysRemaining: number | null;
    isExpired: boolean;
    /** Ceilings and what is used against them — see AdminSubscription.limits. */
    limits?: AdminSubscription["limits"];
  } | null;
  outstandingInvoice: AdminInvoice | null;
  payTo: string | null;
};

/**
 * A printable billing document. The server decides which kind it is and what
 * it is numbered, so the venue and the platform never see different documents.
 */
export type BillingDocument = {
  kind: "invoice" | "receipt";
  title: string;
  titleEn: string;
  number: string;
  /** On a receipt: the invoice it settles. */
  reference: string | null;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  status: string;
  seller: { name: string; taxId?: string | null; address?: string | null; email?: string | null };
  buyer: {
    name: string;
    taxId?: string | null;
    address?: string | null;
    branch?: string | null;
    phone?: string | null;
  };
  lines: { description: string; amount: number }[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  /** Prices are quoted VAT-inclusive; the document says so. */
  vatInclusive: boolean;
};

/** Where to send the money for one invoice. */
export type BillingInstructions = {
  amount: number;
  payTo: string | null;
  promptpay: { payload: string } | null;
  bank: { bankName: string; accountName: string; accountNumber: string } | null;
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

/** One message in a support thread. */
export type AdminSupportReply = {
  id: string;
  authorName: string;
  /** "platform" = us, "organization" = the venue. */
  authorSide: "platform" | "organization";
  body: string;
  /** Whether the venue was actually emailed — a reply nobody received is not an answer. */
  emailed: boolean;
  createdAt: string | null;
};

/**
 * A support thread as the venue sees it.
 *
 * No `assignedTo`: which of the platform's people picked it up is the desk's
 * own note, not the venue's business.
 */
export type OwnerSupportTicket = {
  id: string;
  ticketNo: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  body: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  replies: {
    id: string;
    authorName: string;
    /** "organization" = the venue · "platform" = us. */
    authorSide: "organization" | "platform";
    body: string;
    createdAt: string | null;
  }[];
};

export type AdminSupportTicket = {
  id: string;
  ticketNo: string;
  organizationName: string;
  subject: string;
  body?: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  resolvedAt?: string | null;
  createdAt?: string | null;
  updatedAt: string | null;
  replies?: AdminSupportReply[];
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
  /** Which venue it was done to — null for platform-wide actions. */
  organizationId: string | null;
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
  // Slip verification — the platform's Slip2Go integration + global on/off.
  slipVerifyEnabled: boolean;
  slipVerifyDriver: "null" | "slip2go" | "slipok";
  slipVerifyEndpoint: string | null;
  slipVerifyKeySet: boolean;
  slipVerifyKey?: string; // write-only: blank = keep existing
  // Platform billing payment details — where venues send their renewal money.
  promptpayId: string | null;
  /** Payee name the venue sees on the pay dialog. */
  promptpayName: string | null;
  // Seller identity + tax, printed on every invoice/receipt.
  companyName: string | null;
  taxId: string | null;
  companyAddress: string | null;
  vatEnabled: boolean;
  vatRate: number;
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

/**
 * A sport type as the platform defines it.
 *
 * `emoji` and `color` live here rather than in the components that draw them:
 * adding a sport used to mean editing two frontend files and shipping a
 * release, which is why the list in each of them had drifted apart.
 */
export type SportMeta = {
  key: string;
  name: string;
  emoji: string;
  color: string;
};

/** A catalogue row as the admin screen edits it. */
export type PlatformSport = SportMeta & {
  id: string;
  sortOrder: number;
  isActive: boolean;
  /** How many venues would lose their icon if this were removed. */
  venueCount: number;
};

/** One arrival, as the counter sees it. */
export type CheckinBooking = {
  id: string;
  code: string | null;
  customerId?: string | null;
  customerName: string | null;
  courtName: string | null;
  date: string;
  start: string;
  end: string;
  status: BookingStatus;
  checkedInAt: string | null;
};

/** The counter's answer after a scan (POST /owner/checkin). */
export type CheckinResult = {
  ok: boolean;
  /** checked_in | already | unpaid | cancelled | too_early | expired | not_found */
  code: string;
  message: string;
  booking: CheckinBooking | null;
};

// --- POS (the counter's till) ---
export type OwnerProduct = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Computed server-side so the till and the stock screen agree on "ใกล้หมด". */
  stockState: "ok" | "low" | "out";
};

export type ProductInput = {
  name?: string;
  category?: string | null;
  price?: number;
  stockQty?: number;
  lowStockThreshold?: number;
  imageUrl?: string | null;
  isActive?: boolean;
};

export type OwnerSaleItem = {
  id: string;
  productId: string | null;
  /** The name as charged, not a join — a later rename must not rewrite it. */
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type OwnerSale = {
  id: string;
  code: string;
  total: number;
  paymentMethod: "cash" | "transfer";
  status: "completed" | "voided";
  soldAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  sellerName?: string | null;
  items: OwnerSaleItem[];
};

export type OwnerSalesSummary = {
  date: string;
  total: number;
  saleCount: number;
  cashTotal: number;
  transferTotal: number;
  voidedCount: number;
};

/** A PromptPay QR for one sale's total. */
export type SalePromptPay = { amount: number; payload: string; payTo: string | null };

/** One equipment line currently out, as the counter sees it. */
export type OwnerRentalOut = {
  id: string;
  name: string;
  quantity: number;
  bookingCode: string | null;
  customerId?: string | null;
  customerName: string | null;
  courtName: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
};
