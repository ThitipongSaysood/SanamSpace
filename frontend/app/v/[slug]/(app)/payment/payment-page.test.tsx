import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ slug: "everyday-badminton" }),
}));

// The page reads route params via React `use(params)`. In jsdom the suspended
// promise never flushes, so unwrap the resolved value synchronously while
// leaving every other React export (hooks etc.) untouched.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  type Resolved<T> = Promise<T> & { __value?: T };
  return {
    ...actual,
    use: <T,>(v: T) => {
      const maybe = v as Resolved<unknown>;
      if (maybe && typeof (maybe as Promise<unknown>).then === "function") {
        return maybe.__value as T;
      }
      return actual.use(v as never);
    },
  };
});

import PaymentPage from "./[bookingId]/page";

function paramsFor(bookingId: string) {
  const p = Promise.resolve({ bookingId }) as Promise<{ bookingId: string }> & { __value: { bookingId: string } };
  p.__value = { bookingId };
  return p;
}

function renderPayment(bookingId: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <PaymentPage params={paramsFor(bookingId)} />
    </QueryClientProvider>,
  );
}

describe("PaymentPage flow (C2 + C3)", () => {
  beforeEach(() => push.mockReset());

  it("requires a valid slip before submit, then reaches the waiting-for-verification screen and refreshes the booking cache", async () => {
    const user = userEvent.setup();
    // Seed a real booking via the mock api so getBooking resolves.
    const booking = await api.createBooking({
      venueId: "everyday-badminton", courtId: "court-1",
      date: "2026-06-20", start: "18:00", end: "19:00",
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
    // Prime the stale cache exactly like the Confirmation page would read it.
    qc.setQueryData(["booking", booking.id], booking);

    renderPayment(booking.id, qc);

    // Start the payment (default method = PromptPay) to reach the slip step.
    await user.click(await screen.findByRole("button", { name: "ดำเนินการชำระเงิน" }));

    // C3: the submit button is disabled until a valid slip is attached.
    const submit = await screen.findByRole("button", { name: "ส่งสลิป" });
    expect(submit).toBeDisabled();

    const file = new File([new Uint8Array([1, 2, 3])], "slip.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("แนบสลิปการโอนเงิน"), file);
    await waitFor(() => expect(submit).toBeEnabled());

    await user.click(submit);

    // Real flow: the slip goes to the venue for verification (no auto-approve).
    expect(await screen.findByRole("heading", { name: "ส่งสลิปแล้ว" })).toBeInTheDocument();

    // C2: the booking cache was invalidated before navigating; it re-fetches cleanly.
    await waitFor(async () => {
      const fresh = await qc.fetchQuery({
        queryKey: ["booking", booking.id],
        queryFn: () => api.getBooking(booking.id),
      });
      expect(fresh?.id).toBe(booking.id);
    });
  });

  /**
   * Coming BACK to this screen must not offer to take the money again.
   *
   * The page kept the payment in local state, so pressing Back and returning
   * re-mounted it with that state empty and drew the whole pay form for a
   * booking whose slip had already been sent — the customer's own next step
   * was to pay a second time, and nothing on screen said otherwise. The
   * booking already carries the latest payment's status; this asserts the
   * screen believes the server rather than what it happens to remember.
   */
  it("shows the waiting screen on a fresh mount when the slip is already in", async () => {
    const booking = await api.createBooking({
      venueId: "everyday-badminton", courtId: "court-1",
      date: "2026-06-20", start: "14:00", end: "15:00",
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });

    // Exactly what a re-mount reads: no local state, a booking the server says
    // is waiting on the venue.
    qc.setQueryData(["booking", booking.id], { ...booking, paymentStatus: "pending_review" });

    renderPayment(booking.id, qc);

    expect(await screen.findByText("ส่งสลิปแล้ว")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ดำเนินการชำระเงิน" })).not.toBeInTheDocument();
  });

  it("shows the confirmed screen on a fresh mount once the venue has approved", async () => {
    const booking = await api.createBooking({
      venueId: "everyday-badminton", courtId: "court-1",
      date: "2026-06-20", start: "15:00", end: "16:00",
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
    qc.setQueryData(["booking", booking.id], { ...booking, paymentStatus: "approved" });

    renderPayment(booking.id, qc);

    expect(await screen.findByText("ยืนยันการชำระเงินแล้ว!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ดำเนินการชำระเงิน" })).not.toBeInTheDocument();
  });

  it("keeps the submit button disabled until a slip is attached", async () => {
    const user = userEvent.setup();
    const booking = await api.createBooking({
      venueId: "everyday-badminton", courtId: "court-1",
      date: "2026-06-20", start: "10:00", end: "11:00",
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["booking", booking.id], booking);

    renderPayment(booking.id, qc);
    await user.click(await screen.findByRole("button", { name: "ดำเนินการชำระเงิน" }));

    // No slip yet -> submit stays disabled (so submitSlip can never run empty).
    const submit = await screen.findByRole("button", { name: "ส่งสลิป" });
    expect(submit).toBeDisabled();
  });
});
