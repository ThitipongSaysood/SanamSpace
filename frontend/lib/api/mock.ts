import type {
  AppNotification, Booking, Court, CourtSchedule, Membership, Payment, PaymentInstructions,
  Promotion, ReviewSummary, Slot, User, Venue, VenuePackage, Wallet, WalletTopupInstructions,
} from "@/lib/types";
import {
  courts as courtsFx, venues as venuesFx,
  reviewSummary as reviewSummaryFx, packages as packagesFx, membership as membershipFx,
  wallet as walletFx, promotions as promotionsFx, notifications as notificationsFx,
} from "./fixtures";

export type LinePayload = {
  lineUserId?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  code?: string;
};

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const db = { bookings: new Map<string, Booking>(), payments: new Map<string, Payment>() };
let seq = 1;

const MOCK_USER: User = {
  id: "u1", displayName: "คุณสมชาย", lineId: "Uxxxx", email: "example@email.com", phone: "081-234-5678",
};

function genSlots(date: string): Slot[] {
  // 10:00–22:00 hourly; deterministically mark a couple booked.
  const slots: Slot[] = [];
  for (let h = 10; h < 22; h++) {
    const start = `${String(h).padStart(2, "0")}:00`;
    const end = `${String(h + 1).padStart(2, "0")}:00`;
    const status: Slot["status"] = h === 12 || h === 19 ? "booked" : "available";
    slots.push({ start, end, status });
  }
  return slots;
}

export const mockApi = {
  async lineLogin(_payload?: LinePayload): Promise<{ token: string; user: User }> {
    await delay();
    return { token: "mock-token", user: { ...MOCK_USER } };
  },
  async getVenues(): Promise<Venue[]> { await delay(); return venuesFx; },
  async getVenue(id: string): Promise<Venue | undefined> { await delay(); return venuesFx.find((v) => v.id === id); },
  async getCourts(venueId: string): Promise<Court[]> { await delay(); return courtsFx.filter((c) => c.venueId === venueId); },
  async getCourtSchedule(courtId: string, date: string): Promise<CourtSchedule> {
    await delay(); return { courtId, date, slots: genSlots(date) };
  },
  async createBooking(input: { venueId: string; courtId: string; date: string; start: string; end: string }): Promise<Booking> {
    await delay();
    const venue = venuesFx.find((v) => v.id === input.venueId)!;
    const court = courtsFx.find((c) => c.id === input.courtId)!;
    const id = `bk-${seq}`;
    const code = `BK${240}S${String(250000 + seq)}`;
    const hours = (toMin(input.end) - toMin(input.start)) / 60;
    const booking: Booking = {
      id, code, venueId: venue.id, venueName: venue.name, courtId: court.id, courtName: court.name,
      date: input.date, start: input.start, end: input.end, amount: hours * court.pricePerHour,
      status: "pending_payment", createdAt: new Date(2026, 5, 13).toISOString(),
    };
    seq++; db.bookings.set(id, booking); return booking;
  },
  async getBooking(id: string): Promise<Booking | undefined> { await delay(); return db.bookings.get(id); },
  async listBookings(): Promise<Booking[]> { await delay(); return [...db.bookings.values()]; },
  async createPayment(bookingId: string, method: Payment["method"]): Promise<Payment> {
    await delay();
    const booking = db.bookings.get(bookingId)!;
    const p: Payment = { id: `pay-${bookingId}`, bookingId, method, amount: booking.amount, status: "awaiting_slip" };
    db.payments.set(p.id, p); return p;
  },
  async uploadSlip(paymentId: string, _file?: File): Promise<Payment> {
    await delay();
    const p = db.payments.get(paymentId)!;
    p.status = "pending_review"; p.slipUrl = "/slips/mock.jpg"; return { ...p };
  },
  // demo helper: simulate staff approval
  async approvePayment(paymentId: string): Promise<Payment> {
    await delay();
    const p = db.payments.get(paymentId)!; p.status = "approved";
    const b = db.bookings.get(p.bookingId); if (b) b.status = "confirmed";
    return { ...p };
  },
  async getPayment(paymentId: string): Promise<Payment | undefined> { await delay(); return db.payments.get(paymentId); },
  async getPaymentInstructions(paymentId: string): Promise<PaymentInstructions> {
    await delay();
    const p = db.payments.get(paymentId);
    const amount = p?.amount ?? 0;
    return {
      amount,
      method: p?.method ?? "promptpay",
      payTo: "ร้านตัวอย่าง",
      promptpay: { payload: "00020101021129370016A000000677010111011300668888888885802TH53037646304ABCD" },
      bank: { bankName: "กสิกรไทย", accountName: "ร้านตัวอย่าง", accountNumber: "123-4-56789-0" },
    };
  },
  async checkinBooking(id: string): Promise<Booking> {
    await delay(); const b = db.bookings.get(id)!; b.status = "completed"; return { ...b };
  },
  async cancelBooking(id: string): Promise<Booking> {
    await delay(); const b = db.bookings.get(id)!; b.status = "cancelled"; return { ...b };
  },
  async getReviews(_venueId: string): Promise<ReviewSummary> { await delay(); return reviewSummaryFx; },
  async submitReview(_venueId: string, rating: number, text: string): Promise<ReviewSummary> {
    await delay();
    return {
      ...reviewSummaryFx,
      total: reviewSummaryFx.total + 1,
      reviews: [{ id: `rev-${reviewSummaryFx.reviews.length + 1}`, author: "คุณสมชาย", rating, date: "วันนี้", text }, ...reviewSummaryFx.reviews],
    };
  },
  async walletTopup(amount: number): Promise<WalletTopupInstructions> {
    await delay();
    return {
      transactionId: "txn-mock",
      amount,
      promptpay: { payload: "00020101021129370016A000000677010111011300668888888885802TH53037646304ABCD" },
      bank: { bankName: "กสิกรไทย", accountName: "ร้านตัวอย่าง", accountNumber: "123-4-56789-0" },
    };
  },
  async walletTopupSlip(_id: string, _file?: File): Promise<Wallet> {
    await delay();
    return { balance: 0, transactions: [{ id: "txn-mock", date: "วันนี้", label: "เติมเงิน", amount: 0, status: "pending_review" }] };
  },
  async getPackages(): Promise<VenuePackage[]> { await delay(); return packagesFx; },
  async getMembership(): Promise<Membership> { await delay(); return membershipFx; },
  async getWallet(): Promise<Wallet> { await delay(); return walletFx; },
  async getPromotions(): Promise<Promotion[]> { await delay(); return promotionsFx; },
  async getNotifications(): Promise<AppNotification[]> { await delay(); return notificationsFx; },
  async updateProfile(patch: Partial<User>): Promise<User> { await delay(); return { ...MOCK_USER, ...patch }; },
};

export type Api = typeof mockApi;
