import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Booking } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Unwrap the `use(params)` promise synchronously (jsdom never flushes it).
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  type Resolved<T> = Promise<T> & { __value?: T };
  return {
    ...actual,
    use: <T,>(v: T) => {
      const maybe = v as Resolved<unknown>;
      if (maybe && typeof (maybe as Promise<unknown>).then === "function") return maybe.__value as T;
      return actual.use(v as never);
    },
  };
});

import BookingDetailPage from "./[bookingId]/page";

function makeBooking(status: Booking["status"]): Booking {
  return {
    id: "bk-x", code: "BK240S250001", venueId: "everyday-badminton", venueName: "Everyday Badminton",
    courtId: "court-1", courtName: "Court 1", date: "2026-06-20", start: "18:00", end: "19:00",
    amount: 200, status, createdAt: new Date(2026, 5, 13).toISOString(),
  };
}

function renderDetail(booking: Booking) {
  const params = Promise.resolve({ bookingId: booking.id }) as Promise<{ bookingId: string }> & { __value: { bookingId: string } };
  params.__value = { bookingId: booking.id };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["booking", booking.id], booking);
  return render(
    <QueryClientProvider client={qc}>
      <BookingDetailPage params={params} />
    </QueryClientProvider>,
  );
}

describe("BookingDetailPage status-aware UI (I2)", () => {
  it("pending_payment: shows รอชำระเงิน, a pay link, no QR ticket, no check-in", async () => {
    renderDetail(makeBooking("pending_payment"));
    expect(await screen.findByRole("heading", { name: "รอชำระเงิน" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ไปชำระเงิน" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /เช็คอิน/ })).not.toBeInTheDocument();
  });

  it("confirmed: shows จองสำเร็จ, the QR ticket, and the check-in button", async () => {
    renderDetail(makeBooking("confirmed"));
    expect(await screen.findByRole("heading", { name: "จองสำเร็จ!" })).toBeInTheDocument();
    expect(screen.getByText("ยืนยันแล้ว")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /เช็คอิน/ })).toBeInTheDocument();
  });

  it("cancelled: shows การจองถูกยกเลิก and renders no QR ticket", async () => {
    renderDetail(makeBooking("cancelled"));
    expect(await screen.findByRole("heading", { name: "การจองถูกยกเลิก" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR/ })).not.toBeInTheDocument();
  });
});
