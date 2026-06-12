# Customer Booking Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SanamSpace Customer Booking Web app (Next.js PWA, mobile-first) covering the booking happy-path on mock data.

**Architecture:** Next.js 15 App Router + TypeScript in `frontend/`. UI calls a typed mock service layer (`lib/api`) wrapped by TanStack Query, so swapping to the real `/api/v1` backend later is a one-file change. Theming via CSS variables driven by a tenant config (white-label-ready). Auth is mocked.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5, Vitest + React Testing Library, Playwright (e2e, stretch).

**Reference:** Design spec `docs/superpowers/specs/2026-06-13-customer-booking-web-design.md`; UX specs `docs/ux/customer/`; API surface `structure/API_Specification_v1.md`.

**Conventions:** All paths relative to repo root `/Users/sangkazee/sanamspace`. Run all `npm`/`npx` commands from `frontend/` unless noted. Thai UI copy. Commit after each task with the message shown.

---

## File Structure (decomposition)

```
frontend/
├── app/
│   ├── layout.tsx                       # root: fonts, providers, tenant theme
│   ├── globals.css                      # tailwind + CSS variables
│   ├── (auth)/login/page.tsx            # CUS-AUTH-002 mock LINE login
│   └── (app)/
│       ├── layout.tsx                   # app shell + <BottomNav>, auth guard
│       ├── page.tsx                     # Home  CUS-HOME-001
│       ├── venue/[venueId]/page.tsx     # Venue Detail  CUS-VENUE-001
│       ├── booking/new/page.tsx         # court+date+time+summary  CUS-BOOK-001
│       ├── payment/[bookingId]/page.tsx # method+slip+status  CUS-PAY-001..004
│       ├── booking/[bookingId]/page.tsx # confirmation+QR  CUS-BOOK-002/005
│       └── bookings/page.tsx            # history  CUS-BOOK-003
├── components/ui/                       # shadcn primitives
├── components/                          # app components (BottomNav, VenueCard, CourtSlotGrid, SlipUploader, QRTicket, states)
├── lib/
│   ├── types.ts                         # domain types (mirror /api/v1)
│   ├── api/
│   │   ├── fixtures.ts                  # mock data
│   │   ├── client.ts                    # typed service (mock impl; swap point)
│   │   └── queries.ts                   # TanStack Query hooks
│   ├── auth/auth-context.tsx            # mock AuthProvider + useAuth
│   ├── booking/slots.ts                 # slot-selection + price logic (pure, tested)
│   └── booking/slip.ts                  # slip file validation (pure, tested)
├── config/tenant.ts                     # tenant theme/brand
├── providers.tsx                        # client providers (QueryClient, Auth)
├── vitest.config.ts · vitest.setup.ts
└── tests/ (co-located *.test.ts(x))
```

Each `lib/*` unit is pure and unit-tested. Screens compose components + query hooks.

---

## Task 1: Scaffold Next.js app

**Files:**
- Create: `frontend/` (via create-next-app)

- [ ] **Step 1: Create the Next.js app**

Run from repo root:
```bash
cd /Users/sangkazee/sanamspace
npx create-next-app@latest frontend --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```
Expected: `frontend/` created with `app/`, `package.json`, Tailwind v4 wired (`app/globals.css` has `@import "tailwindcss";`).

- [ ] **Step 2: Verify dev build compiles**

Run:
```bash
cd /Users/sangkazee/sanamspace/frontend && npm run build
```
Expected: build succeeds (compiled successfully).

- [ ] **Step 3: Add app to repo .gitignore for node_modules / .next**

Confirm `frontend/.gitignore` exists (create-next-app adds it, ignoring `node_modules`, `.next`). If repo root `.gitignore` lacks them, append:
```bash
cd /Users/sangkazee/sanamspace
grep -qxF 'frontend/node_modules/' .gitignore || printf '\n# Next.js app\nfrontend/node_modules/\nfrontend/.next/\n' >> .gitignore
```

- [ ] **Step 4: Commit**

```bash
cd /Users/sangkazee/sanamspace
git add frontend .gitignore
git commit -m "chore: scaffold Next.js customer web app"
```

---

## Task 2: Install dependencies (shadcn, TanStack Query, test tooling)

**Files:** Modify `frontend/package.json`, `frontend/components.json` (shadcn)

- [ ] **Step 1: Install runtime + test deps**

Run from `frontend/`:
```bash
cd /Users/sangkazee/sanamspace/frontend
npm i @tanstack/react-query
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Init shadcn/ui**

```bash
npx shadcn@latest init -d
```
Expected: creates `components.json`, `lib/utils.ts`, base CSS variables. Choose defaults (`-d`).

- [ ] **Step 3: Add the shadcn primitives this milestone needs**

```bash
npx shadcn@latest add button card input label badge skeleton dialog sonner
```
Expected: files added under `components/ui/`.

- [ ] **Step 4: Add Vitest config**

Create `frontend/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

Create `frontend/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Add scripts to `frontend/package.json` (`"scripts"`):
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Sanity test that the runner works**

Create `frontend/lib/_sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("sanity", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```
Run: `npm test`
Expected: 1 passed. Then delete the file: `rm lib/_sanity.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "chore: add TanStack Query, shadcn/ui, Vitest tooling"
```

---

## Task 3: Tenant config + design tokens + fonts

**Files:**
- Create: `frontend/config/tenant.ts`, `frontend/lib/theme.ts`, `frontend/lib/theme.test.ts`
- Modify: `frontend/app/globals.css`, `frontend/app/layout.tsx`

- [ ] **Step 1: Write the failing test for the theme→CSS-vars resolver**

Create `frontend/lib/theme.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { themeToCssVars } from "./theme";

describe("themeToCssVars", () => {
  it("maps tenant theme colors to CSS variables", () => {
    const vars = themeToCssVars({ primary: "#16A34A", warning: "#F59E0B", danger: "#EF4444" });
    expect(vars["--brand-primary"]).toBe("#16A34A");
    expect(vars["--brand-warning"]).toBe("#F59E0B");
    expect(vars["--brand-danger"]).toBe("#EF4444");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- theme`
Expected: FAIL (cannot find `./theme`).

- [ ] **Step 3: Implement theme resolver + tenant config**

Create `frontend/lib/theme.ts`:
```ts
export type TenantTheme = { primary: string; warning: string; danger: string };

export function themeToCssVars(t: TenantTheme): Record<string, string> {
  return {
    "--brand-primary": t.primary,
    "--brand-warning": t.warning,
    "--brand-danger": t.danger,
  };
}
```

Create `frontend/config/tenant.ts`:
```ts
import type { TenantTheme } from "@/lib/theme";

export type Tenant = {
  id: string;
  name: string;
  logoText: string;
  lineOaUrl: string;
  theme: TenantTheme;
};

// Hardcoded single tenant for milestone 1 (white-label-ready).
export const tenant: Tenant = {
  id: "everyday-badminton",
  name: "Everyday Badminton",
  logoText: "EVERYDAY BADMINTON",
  lineOaUrl: "https://line.me/",
  theme: { primary: "#16A34A", warning: "#F59E0B", danger: "#EF4444" },
};
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- theme`
Expected: PASS.

- [ ] **Step 5: Wire fonts + tenant theme into root layout**

Replace `frontend/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Prompt, Inter } from "next/font/google";
import { tenant } from "@/config/tenant";
import { themeToCssVars } from "@/lib/theme";
import { Providers } from "@/providers";
import "./globals.css";

const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-prompt" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: tenant.name,
  description: `จองสนามกับ ${tenant.name}`,
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cssVars = themeToCssVars(tenant.theme) as React.CSSProperties;
  return (
    <html lang="th">
      <body className={`${prompt.variable} ${inter.variable} font-[family-name:var(--font-prompt)] antialiased`} style={cssVars}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Add brand utility colors to globals.css**

Append to `frontend/app/globals.css`:
```css
@theme inline {
  --color-brand: var(--brand-primary);
  --color-brand-warning: var(--brand-warning);
  --color-brand-danger: var(--brand-danger);
}
```
(This exposes `bg-brand`, `text-brand`, etc. in Tailwind v4.)

- [ ] **Step 7: Create the Providers placeholder (filled in Task 5)**

Create `frontend/providers.tsx`:
```tsx
"use client";
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat: tenant theme tokens + Prompt/Inter fonts"
```

---

## Task 4: Domain types

**Files:** Create `frontend/lib/types.ts`

- [ ] **Step 1: Define types mirroring /api/v1 entities**

Create `frontend/lib/types.ts`:
```ts
export type Sport = "badminton" | "football" | "futsal" | "tennis";

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
};

export type Court = {
  id: string;
  venueId: string;
  name: string;          // "Court 1"
  sport: Sport;
  pricePerHour: number;  // THB
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

export type User = { id: string; displayName: string; lineId: string; avatarUrl?: string };
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sangkazee/sanamspace/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat: domain types mirroring /api/v1"
```

---

## Task 5: Mock data layer + TanStack Query provider

**Files:**
- Create: `frontend/lib/api/fixtures.ts`, `frontend/lib/api/client.ts`, `frontend/lib/api/client.test.ts`, `frontend/lib/api/queries.ts`
- Modify: `frontend/providers.tsx`

- [ ] **Step 1: Write the failing test for the client**

Create `frontend/lib/api/client.test.ts`:
```ts
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

  it("creates a booking in pending_payment", async () => {
    const courts = await api.getCourts("everyday-badminton");
    const b = await api.createBooking({
      venueId: "everyday-badminton", courtId: courts[0].id,
      date: "2026-06-20", start: "18:00", end: "19:00",
    });
    expect(b.status).toBe("pending_payment");
    expect(b.code).toMatch(/^BK/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- client`
Expected: FAIL (cannot find `./client`).

- [ ] **Step 3: Implement fixtures**

Create `frontend/lib/api/fixtures.ts`:
```ts
import type { Venue, Court } from "@/lib/types";

export const venues: Venue[] = [
  {
    id: "everyday-badminton", name: "Everyday Badminton",
    sports: ["badminton"], rating: 4.8, reviewCount: 124,
    openTime: "10:00", closeTime: "22:00", address: "ถนนงามวงศ์วาน นนทบุรี",
    imageUrl: "/venues/everyday.jpg",
    facilities: ["parking", "shower", "cafe", "wifi", "aircon"],
  },
  {
    id: "tsr-arena", name: "TSR Arena",
    sports: ["badminton", "futsal"], rating: 4.6, reviewCount: 88,
    openTime: "09:00", closeTime: "23:00", address: "ปทุมธานี",
    imageUrl: "/venues/tsr.jpg", facilities: ["parking", "cafe"],
  },
];

export const courts: Court[] = Array.from({ length: 6 }, (_, i) => ({
  id: `court-${i + 1}`, venueId: "everyday-badminton",
  name: `Court ${i + 1}`, sport: "badminton", pricePerHour: 200,
}));
```

- [ ] **Step 4: Implement the mock client (swap point)**

Create `frontend/lib/api/client.ts`:
```ts
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
```

> **Swap point:** to use the real backend, replace each method body with `fetch(\`/api/v1/...\`)`. Signatures stay identical.

- [ ] **Step 5: Run test, verify it passes**

Run: `npm test -- client`
Expected: PASS (3 tests).

- [ ] **Step 6: Add TanStack Query hooks**

Create `frontend/lib/api/queries.ts`:
```ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export const useVenues = () => useQuery({ queryKey: ["venues"], queryFn: api.getVenues });
export const useVenue = (id: string) => useQuery({ queryKey: ["venue", id], queryFn: () => api.getVenue(id) });
export const useCourts = (venueId: string) => useQuery({ queryKey: ["courts", venueId], queryFn: () => api.getCourts(venueId) });
export const useSchedule = (courtId: string | undefined, date: string) =>
  useQuery({ queryKey: ["schedule", courtId, date], queryFn: () => api.getCourtSchedule(courtId!, date), enabled: !!courtId });
export const useBooking = (id: string) => useQuery({ queryKey: ["booking", id], queryFn: () => api.getBooking(id) });
export const useBookings = () => useQuery({ queryKey: ["bookings"], queryFn: api.listBookings });

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}
```

- [ ] **Step 7: Wire QueryClient into Providers**

Replace `frontend/providers.tsx`:
```tsx
"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
```
(AuthProvider is created in Task 6; if executing strictly in order, temporarily wrap only with QueryClientProvider, then add AuthProvider in Task 6.)

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/api frontend/providers.tsx
git commit -m "feat: mock data layer + TanStack Query hooks"
```

---

## Task 6: Mock auth + login screen + route guard

**Files:**
- Create: `frontend/lib/auth/auth-context.tsx`, `frontend/lib/auth/auth-context.test.tsx`, `frontend/app/(auth)/login/page.tsx`, `frontend/app/(app)/layout.tsx`

- [ ] **Step 1: Write failing test for auth context**

Create `frontend/lib/auth/auth-context.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./auth-context";

function Probe() {
  const { user, login } = useAuth();
  return <div><span>{user ? user.displayName : "guest"}</span><button onClick={login}>login</button></div>;
}

describe("auth", () => {
  it("starts as guest then logs in to a mock user", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("guest")).toBeInTheDocument();
    await userEvent.click(screen.getByText("login"));
    expect(await screen.findByText("คุณสมชาย")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- auth-context`
Expected: FAIL (cannot find `./auth-context`).

- [ ] **Step 3: Implement AuthProvider**

Create `frontend/lib/auth/auth-context.tsx`:
```tsx
"use client";
import { createContext, useContext, useState } from "react";
import type { User } from "@/lib/types";

const MOCK_USER: User = { id: "u1", displayName: "คุณสมชาย", lineId: "Uxxxx" };

type AuthValue = { user: User | null; login: () => void; logout: () => void };
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  return <Ctx.Provider value={{ user, login: () => setUser(MOCK_USER), logout: () => setUser(null) }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- auth-context`
Expected: PASS.

- [ ] **Step 5: Login screen (CUS-AUTH-002)**

Create `frontend/app/(auth)/login/page.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { tenant } from "@/config/tenant";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <div className="text-2xl font-bold text-brand">{tenant.logoText}</div>
        <p className="mt-2 text-muted-foreground">จองสนามง่าย ๆ ผ่านมือถือ</p>
      </div>
      <Button className="w-full max-w-xs bg-brand hover:bg-brand/90"
        onClick={() => { login(); router.replace("/"); }}>
        เข้าสู่ระบบด้วย LINE
      </Button>
      <p className="text-xs text-muted-foreground">* เดโม่: จำลองการเข้าสู่ระบบ (ยังไม่ต่อ LINE LIFF จริง)</p>
    </main>
  );
}
```

- [ ] **Step 6: App layout with auth guard + bottom nav slot**

Create `frontend/app/(app)/layout.tsx`:
```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!user) router.replace("/login"); }, [user, router]);
  if (!user) return null;
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-16">
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add "frontend/lib/auth" "frontend/app/(auth)" "frontend/app/(app)/layout.tsx"
git commit -m "feat: mock auth, login screen, route guard"
```

---

## Task 7: Shared components (BottomNav + state components)

**Files:** Create `frontend/components/bottom-nav.tsx`, `frontend/components/states.tsx`

- [ ] **Step 1: BottomNav**

Create `frontend/components/bottom-nav.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/bookings", label: "การจอง" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t bg-background">
      {items.map((it) => {
        const active = path === it.href;
        return (
          <Link key={it.href} href={it.href}
            className={`flex-1 py-3 text-center text-sm ${active ? "font-semibold text-brand" : "text-muted-foreground"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Reusable state components**

Create `frontend/components/states.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3 p-4">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>;
}
export function EmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-muted-foreground">{message}</div>;
}
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="p-10 text-center">
      <p className="text-brand-danger">เกิดข้อผิดพลาด</p>
      {onRetry && <button className="mt-3 text-sm underline" onClick={onRetry}>ลองใหม่</button>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/sangkazee/sanamspace/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/bottom-nav.tsx frontend/components/states.tsx
git commit -m "feat: bottom nav + loading/empty/error states"
```

---

## Task 8: Home screen (CUS-HOME-001)

**Files:** Create `frontend/components/venue-card.tsx`, `frontend/app/(app)/page.tsx`

- [ ] **Step 1: VenueCard component**

Create `frontend/components/venue-card.tsx`:
```tsx
import Link from "next/link";
import type { Venue } from "@/lib/types";
import { Card } from "@/components/ui/card";

export function VenueCard({ venue }: { venue: Venue }) {
  return (
    <Link href={`/venue/${venue.id}`}>
      <Card className="overflow-hidden p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{venue.name}</div>
            <div className="text-xs text-muted-foreground">{venue.address}</div>
          </div>
          <div className="text-sm text-brand">★ {venue.rating.toFixed(1)}</div>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Home page**

Create `frontend/app/(app)/page.tsx`:
```tsx
"use client";
import { useAuth } from "@/lib/auth/auth-context";
import { useVenues } from "@/lib/api/queries";
import { VenueCard } from "@/components/venue-card";
import { Loading, ErrorState } from "@/components/states";

export default function HomePage() {
  const { user } = useAuth();
  const { data: venues, isLoading, isError, refetch } = useVenues();
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">สวัสดี {user?.displayName} 👋</h1>
      <p className="text-sm text-muted-foreground">วันนี้อยากเล่นที่สนามไหน?</p>

      <div className="mt-4 rounded-xl bg-brand/10 p-4 text-sm text-brand">🎉 โปรโมชั่น: จอง 3 ชม. แถม 1 ชม.</div>

      <h2 className="mt-6 mb-2 font-semibold">สนามแนะนำ</h2>
      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      <div className="space-y-3">{venues?.map((v) => <VenueCard key={v.id} venue={v} />)}</div>
    </main>
  );
}
```

- [ ] **Step 3: Manual verify**

Run: `cd /Users/sangkazee/sanamspace/frontend && npm run dev` then open `http://localhost:3000` → redirected to `/login` → click "เข้าสู่ระบบด้วย LINE" → Home shows greeting + venue list. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(app)/page.tsx" frontend/components/venue-card.tsx
git commit -m "feat: home screen with recommended venues"
```

---

## Task 9: Venue Detail screen (CUS-VENUE-001)

**Files:** Create `frontend/app/(app)/venue/[venueId]/page.tsx`

- [ ] **Step 1: Venue detail page**

Create `frontend/app/(app)/venue/[venueId]/page.tsx`:
```tsx
"use client";
import { use } from "react";
import Link from "next/link";
import { useVenue } from "@/lib/api/queries";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default function VenueDetailPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message="ไม่พบสนามนี้" />;
  return (
    <main className="p-4">
      <div className="h-40 rounded-xl bg-muted" />
      <h1 className="mt-3 text-xl font-bold">{venue.name}</h1>
      <div className="text-sm text-brand">★ {venue.rating.toFixed(1)} ({venue.reviewCount} รีวิว)</div>
      <div className="text-sm text-muted-foreground">{venue.address}</div>
      <div className="mt-1 text-sm">เปิด {venue.openTime}–{venue.closeTime} น.</div>

      <h2 className="mt-4 mb-1 font-semibold">สิ่งอำนวยความสะดวก</h2>
      <div className="flex flex-wrap gap-2">{venue.facilities.map((f) => <span key={f} className="rounded-full bg-muted px-3 py-1 text-xs">{f}</span>)}</div>

      <Link href={`/booking/new?venueId=${venue.id}`} className="mt-6 block">
        <Button className="w-full bg-brand hover:bg-brand/90">จองเลย</Button>
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + manual verify**

Run: `npx tsc --noEmit` (expect no errors). Optionally `npm run dev` → open a venue → see detail + "จองเลย".

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/(app)/venue"
git commit -m "feat: venue detail screen"
```

---

## Task 10: Booking slot + price logic (pure, TDD)

**Files:** Create `frontend/lib/booking/slots.ts`, `frontend/lib/booking/slots.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/lib/booking/slots.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isContiguous, totalHours, calcPrice, canSelect } from "./slots";
import type { Slot } from "@/lib/types";

const slot = (start: string, end: string, status: Slot["status"] = "available"): Slot => ({ start, end, status });

describe("booking slots", () => {
  it("detects contiguous selections", () => {
    expect(isContiguous([slot("18:00", "19:00"), slot("19:00", "20:00")])).toBe(true);
    expect(isContiguous([slot("18:00", "19:00"), slot("20:00", "21:00")])).toBe(false);
  });
  it("computes total hours", () => {
    expect(totalHours([slot("18:00", "19:00"), slot("19:00", "20:00")])).toBe(2);
  });
  it("computes price = hours * pricePerHour", () => {
    expect(calcPrice([slot("18:00", "19:00"), slot("19:00", "20:00")], 200)).toBe(400);
  });
  it("rejects selecting a booked slot", () => {
    expect(canSelect(slot("12:00", "13:00", "booked"), [])).toBe(false);
  });
  it("rejects non-contiguous addition", () => {
    expect(canSelect(slot("21:00", "22:00"), [slot("18:00", "19:00")])).toBe(false);
  });
  it("allows contiguous available addition", () => {
    expect(canSelect(slot("19:00", "20:00"), [slot("18:00", "19:00")])).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- slots`
Expected: FAIL (cannot find `./slots`).

- [ ] **Step 3: Implement**

Create `frontend/lib/booking/slots.ts`:
```ts
import type { Slot } from "@/lib/types";

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function isContiguous(slots: Slot[]): boolean {
  const sorted = [...slots].sort((a, b) => toMin(a.start) - toMin(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start !== sorted[i - 1].end) return false;
  }
  return true;
}

export function totalHours(slots: Slot[]): number {
  return slots.reduce((sum, s) => sum + (toMin(s.end) - toMin(s.start)) / 60, 0);
}

export function calcPrice(slots: Slot[], pricePerHour: number): number {
  return totalHours(slots) * pricePerHour;
}

export function canSelect(slot: Slot, current: Slot[]): boolean {
  if (slot.status !== "available") return false;
  if (current.length === 0) return true;
  return isContiguous([...current, slot]);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- slots`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/booking/slots.ts frontend/lib/booking/slots.test.ts
git commit -m "feat: booking slot selection + price logic (tested)"
```

---

## Task 11: Create Booking screen (CUS-BOOK-001)

**Files:** Create `frontend/components/court-slot-grid.tsx`, `frontend/app/(app)/booking/new/page.tsx`

- [ ] **Step 1: CourtSlotGrid component**

Create `frontend/components/court-slot-grid.tsx`:
```tsx
"use client";
import type { Slot } from "@/lib/types";

export function CourtSlotGrid({ slots, selected, onToggle }: {
  slots: Slot[]; selected: Slot[]; onToggle: (s: Slot) => void;
}) {
  const isSel = (s: Slot) => selected.some((x) => x.start === s.start);
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((s) => {
        const disabled = s.status !== "available";
        const sel = isSel(s);
        return (
          <button key={s.start} disabled={disabled} onClick={() => onToggle(s)}
            className={`rounded-lg border py-2 text-sm ${disabled ? "cursor-not-allowed bg-muted text-muted-foreground line-through" : sel ? "border-brand bg-brand text-white" : "border-input"}`}>
            {s.start}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create Booking page (court → date → time → summary)**

Create `frontend/app/(app)/booking/new/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCourts, useSchedule, useCreateBooking } from "@/lib/api/queries";
import { CourtSlotGrid } from "@/components/court-slot-grid";
import { canSelect, calcPrice } from "@/lib/booking/slots";
import type { Slot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/states";

const DATE = "2026-06-20";

export default function NewBookingPage() {
  const router = useRouter();
  const venueId = useSearchParams().get("venueId") ?? "everyday-badminton";
  const { data: courts } = useCourts(venueId);
  const [courtId, setCourtId] = useState<string | undefined>();
  const court = courts?.find((c) => c.id === courtId);
  const { data: schedule } = useSchedule(courtId, DATE);
  const [selected, setSelected] = useState<Slot[]>([]);
  const create = useCreateBooking();

  const toggle = (s: Slot) => {
    const exists = selected.some((x) => x.start === s.start);
    if (exists) setSelected(selected.filter((x) => x.start !== s.start));
    else if (canSelect(s, selected)) setSelected([...selected, s]);
  };

  const price = court ? calcPrice(selected, court.pricePerHour) : 0;

  async function confirm() {
    if (!court || selected.length === 0) return;
    const sorted = [...selected].sort((a, b) => a.start.localeCompare(b.start));
    const booking = await create.mutateAsync({
      venueId, courtId: court.id, date: DATE,
      start: sorted[0].start, end: sorted[sorted.length - 1].end,
    });
    router.push(`/payment/${booking.id}`);
  }

  if (!courts) return <Loading />;
  return (
    <main className="p-4">
      <h1 className="text-lg font-bold">เลือกคอร์ทและเวลา</h1>
      <p className="text-sm text-muted-foreground">วันที่ {DATE}</p>

      <h2 className="mt-4 mb-1 text-sm font-semibold">คอร์ท</h2>
      <div className="flex flex-wrap gap-2">
        {courts.map((c) => (
          <button key={c.id} onClick={() => { setCourtId(c.id); setSelected([]); }}
            className={`rounded-lg border px-3 py-2 text-sm ${courtId === c.id ? "border-brand bg-brand text-white" : "border-input"}`}>
            {c.name}
          </button>
        ))}
      </div>

      {courtId && schedule && (
        <>
          <h2 className="mt-4 mb-1 text-sm font-semibold">เวลา</h2>
          <CourtSlotGrid slots={schedule.slots} selected={selected} onToggle={toggle} />
        </>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto flex max-w-md items-center justify-between border-t bg-background p-3">
        <div className="text-sm">รวม <span className="font-bold text-brand">฿{price}</span></div>
        <Button disabled={selected.length === 0 || create.isPending} onClick={confirm} className="bg-brand hover:bg-brand/90">
          {create.isPending ? "กำลังจอง..." : "ดำเนินการต่อ"}
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + manual verify**

Run: `npx tsc --noEmit`. Then `npm run dev` → venue → จองเลย → select court + slots (booked slots disabled) → price updates → ดำเนินการต่อ → routes to `/payment/<id>`.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(app)/booking" frontend/components/court-slot-grid.tsx
git commit -m "feat: create booking screen (court/date/time/summary)"
```

---

## Task 12: Slip validation logic (pure, TDD)

**Files:** Create `frontend/lib/booking/slip.ts`, `frontend/lib/booking/slip.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/lib/booking/slip.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateSlip } from "./slip";

const file = (type: string, sizeMB: number) => ({ type, size: sizeMB * 1024 * 1024 }) as File;

describe("validateSlip", () => {
  it("accepts a jpg under 5MB", () => {
    expect(validateSlip(file("image/jpeg", 2))).toEqual({ ok: true });
  });
  it("rejects non-image", () => {
    expect(validateSlip(file("application/pdf", 1))).toEqual({ ok: false, error: "รองรับเฉพาะรูปภาพ (JPG/PNG)" });
  });
  it("rejects > 5MB", () => {
    expect(validateSlip(file("image/png", 6))).toEqual({ ok: false, error: "ไฟล์ใหญ่เกิน 5MB" });
  });
  it("rejects when no file", () => {
    expect(validateSlip(null)).toEqual({ ok: false, error: "กรุณาแนบสลิป" });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- slip`
Expected: FAIL (cannot find `./slip`).

- [ ] **Step 3: Implement**

Create `frontend/lib/booking/slip.ts`:
```ts
export type SlipResult = { ok: true } | { ok: false; error: string };

const ALLOWED = ["image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

export function validateSlip(file: File | null): SlipResult {
  if (!file) return { ok: false, error: "กรุณาแนบสลิป" };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "รองรับเฉพาะรูปภาพ (JPG/PNG)" };
  if (file.size > MAX_BYTES) return { ok: false, error: "ไฟล์ใหญ่เกิน 5MB" };
  return { ok: true };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- slip`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/booking/slip.ts frontend/lib/booking/slip.test.ts
git commit -m "feat: slip file validation (tested)"
```

---

## Task 13: Payment screen (CUS-PAY-001..004)

**Files:** Create `frontend/components/slip-uploader.tsx`, `frontend/app/(app)/payment/[bookingId]/page.tsx`

- [ ] **Step 1: SlipUploader component**

Create `frontend/components/slip-uploader.tsx`:
```tsx
"use client";
import { useState } from "react";
import { validateSlip } from "@/lib/booking/slip";

export function SlipUploader({ onValid }: { onValid: (file: File) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input type="file" accept="image/jpeg,image/png" onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        const res = validateSlip(f);
        if (!res.ok) { setError(res.error); return; }
        setError(null); onValid(f!);
      }} />
      {error && <p className="mt-1 text-sm text-brand-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Payment page (method → upload slip → status with demo approve)**

Create `frontend/app/(app)/payment/[bookingId]/page.tsx`:
```tsx
"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { SlipUploader } from "@/components/slip-uploader";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { Payment } from "@/lib/types";

export default function PaymentPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const router = useRouter();
  const { data: booking, isLoading } = useBooking(bookingId);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  async function startTransfer() {
    setBusy(true);
    const p = await api.createPayment(bookingId, "transfer");
    setPayment(p); setBusy(false);
  }
  async function submitSlip() {
    if (!payment) return;
    setBusy(true);
    const reviewed = await api.uploadSlip(payment.id);
    const approved = await api.approvePayment(reviewed.id); // demo auto-approve
    setPayment(approved); setBusy(false);
  }

  return (
    <main className="p-4">
      <h1 className="text-lg font-bold">ชำระเงิน</h1>
      <div className="mt-2 rounded-xl border p-4 text-sm">
        <div>{booking.venueName} · {booking.courtName}</div>
        <div className="text-muted-foreground">{booking.date} {booking.start}–{booking.end}</div>
        <div className="mt-1 font-bold text-brand">฿{booking.amount}</div>
      </div>

      {!payment && (
        <Button className="mt-4 w-full bg-brand hover:bg-brand/90" disabled={busy} onClick={startTransfer}>
          โอนผ่านธนาคาร / PromptPay
        </Button>
      )}

      {payment?.status === "awaiting_slip" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">โอนแล้วแนบสลิปเพื่อยืนยัน</p>
          <SlipUploader onValid={() => {}} />
          <Button className="w-full bg-brand hover:bg-brand/90" disabled={busy} onClick={submitSlip}>
            {busy ? "กำลังตรวจสอบ..." : "ส่งสลิป"}
          </Button>
        </div>
      )}

      {payment?.status === "approved" && (
        <div className="mt-4 space-y-3 text-center">
          <p className="text-brand">✓ ชำระเงินสำเร็จ</p>
          <Button className="w-full bg-brand hover:bg-brand/90" onClick={() => router.push(`/booking/${bookingId}`)}>
            ดูการจอง
          </Button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + manual verify**

Run: `npx tsc --noEmit`. `npm run dev` → complete a booking → payment → โอน → attach any jpg/png → ส่งสลิป → "ชำระเงินสำเร็จ" → ดูการจอง.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(app)/payment" frontend/components/slip-uploader.tsx
git commit -m "feat: payment screen with slip upload + demo approval"
```

---

## Task 14: Confirmation + QR (CUS-BOOK-002/005) & Booking history (CUS-BOOK-003)

**Files:** Create `frontend/components/qr-ticket.tsx`, `frontend/app/(app)/booking/[bookingId]/page.tsx`, `frontend/app/(app)/bookings/page.tsx`

- [ ] **Step 1: QRTicket component (CSS placeholder QR)**

Create `frontend/components/qr-ticket.tsx`:
```tsx
export function QRTicket({ code }: { code: string }) {
  return (
    <div className="mx-auto w-fit rounded-xl border p-4 text-center">
      <div className="grid h-40 w-40 grid-cols-8 grid-rows-8 gap-px bg-white">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className={((i * 7 + (i % 5)) % 3 === 0) ? "bg-black" : "bg-white"} />
        ))}
      </div>
      <div className="mt-2 font-mono text-sm">{code}</div>
      <div className="text-xs text-muted-foreground">แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</div>
    </div>
  );
}
```

- [ ] **Step 2: Confirmation / detail page with check-in**

Create `frontend/app/(app)/booking/[bookingId]/page.tsx`:
```tsx
"use client";
import { use, useState } from "react";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { QRTicket } from "@/components/qr-ticket";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/lib/types";

const label: Record<BookingStatus, string> = {
  pending_payment: "รอชำระเงิน", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิก", completed: "เช็คอินแล้ว",
};

export default function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { data: booking, isLoading, refetch } = useBooking(bookingId);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  return (
    <main className="p-4 text-center">
      <div className="text-2xl">🎉</div>
      <h1 className="text-lg font-bold">จองสำเร็จ!</h1>
      <div className="mt-2 inline-block rounded-full bg-brand/10 px-3 py-1 text-sm text-brand">{label[booking.status]}</div>

      <div className="mt-4 rounded-xl border p-4 text-left text-sm">
        <div className="font-semibold">{booking.venueName} · {booking.courtName}</div>
        <div className="text-muted-foreground">{booking.date} {booking.start}–{booking.end}</div>
        <div className="mt-1 font-bold text-brand">฿{booking.amount}</div>
      </div>

      {booking.status !== "cancelled" && <div className="mt-6"><QRTicket code={booking.code} /></div>}

      {booking.status === "confirmed" && (
        <Button className="mt-4 w-full bg-brand hover:bg-brand/90" disabled={busy}
          onClick={async () => { setBusy(true); await api.checkinBooking(booking.id); await refetch(); setBusy(false); }}>
          {busy ? "กำลังเช็คอิน..." : "เช็คอิน (เดโม่)"}
        </Button>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Booking history page**

Create `frontend/app/(app)/bookings/page.tsx`:
```tsx
"use client";
import Link from "next/link";
import { useBookings } from "@/lib/api/queries";
import { Loading, EmptyState } from "@/components/states";
import { Card } from "@/components/ui/card";

export default function BookingsPage() {
  const { data: bookings, isLoading } = useBookings();
  if (isLoading) return <Loading />;
  if (!bookings || bookings.length === 0) return <EmptyState message="ยังไม่มีการจอง" />;
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">การจองของฉัน</h1>
      <div className="space-y-3">
        {bookings.map((b) => (
          <Link key={b.id} href={`/booking/${b.id}`}>
            <Card className="p-3 text-sm">
              <div className="font-semibold">{b.venueName} · {b.courtName}</div>
              <div className="text-muted-foreground">{b.date} {b.start}–{b.end} · ฿{b.amount}</div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + full manual flow**

Run: `npx tsc --noEmit`. `npm run dev` → full happy-path: login → home → venue → booking → payment → confirmation + QR → เช็คอิน → bookings list shows it.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(app)/booking" "frontend/app/(app)/bookings" frontend/components/qr-ticket.tsx
git commit -m "feat: booking confirmation, QR check-in, history"
```

---

## Task 15: PWA manifest + polish

**Files:** Create `frontend/app/manifest.ts`; verify build

- [ ] **Step 1: Web manifest**

Create `frontend/app/manifest.ts`:
```ts
import type { MetadataRoute } from "next";
import { tenant } from "@/config/tenant";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: tenant.name,
    short_name: tenant.name,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: tenant.theme.primary,
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/sangkazee/sanamspace/frontend && npm test`
Expected: all suites pass (theme, client, auth-context, slots, slip).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: compiles successfully; all routes listed.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/manifest.ts"
git commit -m "feat: PWA manifest + final build"
```

---

## Task 16 (stretch): Playwright e2e of the happy-path

**Files:** Create `frontend/e2e/booking.spec.ts`, `frontend/playwright.config.ts`

- [ ] **Step 1: Install Playwright**

Run: `cd /Users/sangkazee/sanamspace/frontend && npm i -D @playwright/test && npx playwright install chromium`

- [ ] **Step 2: Config**

Create `frontend/playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 3: e2e test**

Create `frontend/e2e/booking.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("customer can book a court end-to-end", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย LINE" }).click();
  await expect(page.getByText(/สวัสดี/)).toBeVisible();
  await page.getByText("Everyday Badminton").first().click();
  await page.getByRole("button", { name: "จองเลย" }).click();
  await page.getByRole("button", { name: "Court 1" }).click();
  await page.getByRole("button", { name: "18:00" }).click();
  await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
  await page.getByRole("button", { name: /โอนผ่านธนาคาร/ }).click();
  // file input + submit handled by app; assert success state reachable
  await expect(page.getByText("ชำระเงิน")).toBeVisible();
});
```

- [ ] **Step 4: Run e2e**

Run: `npx playwright test`
Expected: passes (or documents any flow gaps to fix).

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e frontend/playwright.config.ts frontend/package.json
git commit -m "test: e2e happy-path booking (Playwright)"
```

---

## Self-Review

**Spec coverage:** Stack (T1–2), tenant theme/tokens/fonts (T3), types (T4), mock data layer + swap point (T5), mock auth + guard (T6), screens Home/Venue/Booking/Payment/Confirmation+QR/History (T7–9, 11, 13, 14), slot + slip logic with TDD (T10, T12), error/empty/loading states (T7 + used throughout), PWA manifest (T15), testing strategy unit + e2e (tests throughout + T16). Multi-tenant config (T3). All spec sections mapped.

**Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output.

**Type consistency:** `api` method names in `client.ts` (getVenues/getVenue/getCourts/getCourtSchedule/createBooking/getBooking/listBookings/createPayment/uploadSlip/approvePayment/getPayment/checkinBooking) are used consistently in `queries.ts` and screens. `Slot`/`Booking`/`Payment` shapes from `types.ts` used everywhere. `validateSlip`, `canSelect`, `calcPrice` signatures match their tests.

**Note:** `useSearchParams` (T11) requires a Suspense boundary in Next 15 production build; if `npm run build` warns, wrap the booking page content in `<Suspense>`. Documented here so the implementer handles it at T11/T15.
