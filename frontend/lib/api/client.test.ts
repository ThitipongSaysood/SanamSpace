import { describe, it, expect } from "vitest";
import { api } from "./client";

describe("mock api client", () => {
  it("lists venues", async () => {
    const venues = await api.getVenues();
    expect(venues.length).toBeGreaterThan(0);
    expect(venues[0]).toHaveProperty("name");
  });

  it("returns a schedule with slots for a court", async () => {
    const courts = await api.getCourts("everyday-badminton");
    const sched = await api.getCourtSchedule(courts[0].id, "2026-06-20");
    expect(sched.slots.length).toBeGreaterThan(0);
    expect(["available", "booked", "closed"]).toContain(sched.slots[0].status);
  });

  it("returns courts for the tsr-arena venue (no dead-end)", async () => {
    const courts = await api.getCourts("tsr-arena");
    expect(courts.length).toBeGreaterThan(0);
    for (const c of courts) {
      expect(c.venueId).toBe("tsr-arena");
      expect(["badminton", "futsal"]).toContain(c.sport);
    }
  });

  it("creates a booking in pending_payment", async () => {
    const courts = await api.getCourts("everyday-badminton");
    const b = await api.createBooking({
      venueId: "everyday-badminton", courtId: courts[0].id,
      date: "2026-06-20", start: "18:00", end: "19:00",
    });
    expect(b.status).toBe("pending_payment");
    expect(b.code).toMatch(/^BK/);
  });

  it("stores amount from duration for a multi-hour booking", async () => {
    const courts = await api.getCourts("everyday-badminton");
    const b = await api.createBooking({
      venueId: "everyday-badminton", courtId: courts[0].id,
      date: "2026-06-20", start: "18:00", end: "21:00", // 3 hours
    });
    expect(courts[0].pricePerHour).toBe(200);
    expect(b.amount).toBe(600); // 3h × 200
  });
});
