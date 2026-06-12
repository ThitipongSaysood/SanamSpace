import type { Booking, Court, CourtSchedule, Payment, Slot, Venue } from "@/lib/types";
import { courts as courtsFx, venues as venuesFx } from "./fixtures";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const db = { bookings: new Map<string, Booking>(), payments: new Map<string, Payment>() };
let seq = 1;

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

export const api = {
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
    const booking: Booking = {
      id, code, venueId: venue.id, venueName: venue.name, courtId: court.id, courtName: court.name,
      date: input.date, start: input.start, end: input.end, amount: court.pricePerHour,
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
  async uploadSlip(paymentId: string): Promise<Payment> {
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
  async checkinBooking(id: string): Promise<Booking> {
    await delay(); const b = db.bookings.get(id)!; b.status = "completed"; return { ...b };
  },
};
export type Api = typeof api;
