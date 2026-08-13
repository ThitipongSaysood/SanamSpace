"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarCheck, Wallet, Users, Megaphone, BarChart3, Palette,
  ScanLine, BellRing, QrCode, LineChart, CheckCircle2, ChevronDown, Menu, X,
  CalendarX2, FileWarning, UserX, FolderX, Receipt,
} from "lucide-react";
import { useMessages } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Where "start using it" actually leads.
 *
 * The free trial is real — the admin screens start one for a venue, and the
 * portal locks itself when it runs out. What was not real was STARTING it
 * yourself: there is no self-serve signup, and the old call to action sent a
 * brand-new customer to a login form they had no account for. So the offer
 * stays and the link goes to the channel that can actually open a venue.
 * `LOGIN` remains for venues that already have an account.
 */
const LOGIN = "/owner/login";
const LINE = "#line"; // TODO: ใส่ลิงก์ LINE OA จริง (ปุ่ม "คุยกับทีมงาน" เท่านั้น)
const SIGNUP = "/owner/signup"; // self-serve: สมัคร → สร้างร้าน + ทดลอง 30 วัน

function CTAButtons({ className = "" }: { className?: string }) {
  const m = useMessages("landing");
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Link
        href={SIGNUP}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-base font-semibold text-white shadow-sm transition hover:bg-brand/90"
      >
        {m.hero.ctaTry}
      </Link>
      <a
        href="#pricing"
        className="inline-flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-6 text-base font-semibold text-foreground transition hover:bg-app"
      >
        {m.hero.ctaPricing}
      </a>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const m = useMessages("landing");
  const c = useMessages("common");
  const NAV: [string, string][] = [
    [c.nav.features, "#features"],
    [c.nav.sports, "#sports"],
    [c.nav.pricing, "#pricing"],
    [c.nav.faq, "#faq"],
  ];

  return (
    <div className="min-h-dvh bg-white text-foreground">
      {/* 01 Navbar */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/landing" className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">S</span>
            SanamSpace
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="hover:text-foreground">{label}</a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <LanguageSwitcher className="mr-1" />
            <Link href={LOGIN} className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-app">
              {c.login}
            </Link>
            <Link href={SIGNUP} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
              {c.tryFree}
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <button
              type="button"
              aria-label={c.menu}
              onClick={() => setMenuOpen((o) => !o)}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-app"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-black/5 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1 text-sm font-medium">
              {NAV.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-app">
                  {label}
                </a>
              ))}
              <Link href={SIGNUP} className="mt-1 rounded-lg bg-brand px-3 py-2.5 text-center font-semibold text-white">
                {c.tryFree}
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* 02 Hero */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
              <CheckCircle2 className="size-4" /> {m.badge}
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">
              {m.hero.title1}<br />{m.hero.title2}<span className="text-brand">{m.hero.titleHighlight}</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              {m.hero.subtitle}
            </p>
            <CTAButtons className="mt-6" />
            <p className="mt-4 text-sm text-muted-foreground">
              {m.hero.trust}
            </p>
          </div>
          {/*
            * The real screen, not a drawing of one.
            *
            * This was a grid of coloured divs pretending to be a calendar —
            * which tells a venue nothing about what they would actually get,
            * and looks exactly like every other placeholder. These are captured
            * from the running product (see public/screenshots).
            */}
          <div className="relative">
            <div className="rounded-3xl bg-gradient-to-br from-brand/15 to-brand/5 p-4 ring-1 ring-black/5 sm:p-6">
              <Image
                src="/screenshots/owner-operations.png"
                alt={m.hero.altOperations}
                width={1440}
                height={900}
                priority
                className="rounded-2xl shadow-lg ring-1 ring-black/5"
              />
              <Image
                src="/screenshots/app-home.png"
                alt={m.hero.altApp}
                width={585}
                height={1266}
                priority
                className="absolute -bottom-6 -right-2 w-28 rounded-2xl shadow-xl ring-1 ring-black/10 sm:w-36"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 03 Social proof — waitlist style (no fake numbers) */}
      <section className="border-y border-black/5 bg-app">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">{m.social.heading}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {m.social.stats.map((s) => (
              <div key={s.l} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-2xl font-bold text-brand">{s.n}</div>
                <div className="text-xs text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 Problem */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold md:text-3xl">{m.problem.heading}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.problem.cards.map((card, i) => {
            const I = [CalendarX2, FileWarning, UserX, FolderX, Receipt][i];
            return (
              <div key={card.title} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                <I className="size-7 text-brand-danger" />
                <div className="mt-3 font-semibold">{card.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{card.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 05 How it works */}
      <section className="bg-app">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold md:text-3xl">{m.how.heading}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {m.how.steps.map((step, i) => {
              const I = [LineChart, ScanLine, BellRing, QrCode][i];
              return (
                <div key={step.title} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                  <div className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
                    <I className="size-6" />
                  </div>
                  <div className="mt-3 font-semibold">{step.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 06 Sports supported */}
      <SportsSection />

      {/* 06b What it actually looks like */}
      <ScreensSection />

      {/* 07 Core features */}
      <section id="features" className="bg-app">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold md:text-3xl">{m.features.heading}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {m.features.items.map((item, i) => {
              const I = [CalendarCheck, ScanLine, Wallet, QrCode, Users, Megaphone, BarChart3, Palette][i];
              return (
                <div key={item.title} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                  <I className="size-7 text-brand" />
                  <div className="mt-3 font-semibold">{item.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 08 Pricing */}
      <PricingSection />

      {/* 09 Why white label */}
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">สนามของคุณ แบรนด์ของคุณ ลูกค้าของคุณ</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/90">
            SanamSpace ไม่ใช่แพลตฟอร์มตัวกลางที่ดึงลูกค้าไปจากสนาม — ลูกค้าจองภายใต้แบรนด์ของสนามเอง
            ข้อมูลลูกค้าทั้งหมดเป็นกรรมสิทธิ์ของสนาม พร้อมโลโก้ สี และ LINE OA ของสนาม ครบทุกแพ็กเกจ
          </p>
        </div>
      </section>

      {/* 11 FAQ */}
      <FaqSection />

      {/* 12 Final CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold md:text-3xl">{m.finalCta.heading}</h2>
        <p className="mt-3 text-muted-foreground">{m.finalCta.subtitle}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={SIGNUP} className="inline-flex h-12 items-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand/90">
            {m.finalCta.ctaTry}
          </Link>
          <a href={LINE} className="inline-flex h-12 items-center rounded-xl border border-black/10 px-6 font-semibold hover:bg-app">
            {m.finalCta.ctaLine}
          </a>
        </div>
      </section>

      {/* 13 Footer */}
      <footer className="border-t border-black/5 bg-app">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold">
                <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">S</span>
                SanamSpace
              </div>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {m.footer.tagline}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div>
                <div className="font-semibold">{m.footer.menuTitle}</div>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground">{c.nav.features}</a></li>
                  <li><a href="#pricing" className="hover:text-foreground">{c.nav.pricing}</a></li>
                  <li><a href="#faq" className="hover:text-foreground">{c.nav.faq}</a></li>
                  <li><Link href={LOGIN} className="hover:text-foreground">{c.login}</Link></li>
                </ul>
              </div>
              <div>
                <div className="font-semibold">{m.footer.contactTitle}</div>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li><a href={LINE} className="hover:text-foreground">{m.footer.lineOa}</a></li>
                  <li><a href="mailto:hello@sanamspace.com" className="hover:text-foreground">{m.footer.email}</a></li>
                  <li><a href="tel:020000000" className="hover:text-foreground">{m.footer.phone}</a></li>
                </ul>
              </div>
              <div>
                <div className="font-semibold">{m.footer.legalTitle}</div>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground">{m.footer.privacy}</a></li>
                  <li><a href="#" className="hover:text-foreground">{m.footer.terms}</a></li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">© {2026} SanamSpace</p>
        </div>
      </footer>

      {/* Sticky mobile CTA bar (spec §4) */}
      <div className="sticky bottom-0 z-40 border-t border-black/5 bg-white/95 p-3 backdrop-blur md:hidden">
        <Link href={SIGNUP} className="flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-white">
          {m.sticky}
        </Link>
      </div>
    </div>
  );
}

// Order only; the label + selling points come from the message catalog
// (landing.sports.items[key]) so both languages stay in one place.
const SPORT_KEYS = ["badminton", "football", "tennis", "pickleball", "basketball"] as const;

/**
 * The product, photographed rather than described.
 *
 * A venue deciding whether to rent software wants to see the screen its staff
 * will look at all day and the screen its customers will book on. Everything
 * here is captured from the running system with the demo venue's data — no
 * mockups, and no numbers invented to look busier than the truth.
 *
 * The frames are the only decoration: a screenshot floating on a page reads as
 * a diagram, while the same image inside a browser or a handset reads as
 * something already running. Deliberately no URL in the browser bar — inventing
 * a domain would be a small lie on a page whose whole job here is being real.
 */
function BrowserFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
      <div className="flex items-center gap-2 border-b border-black/5 bg-app px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate text-xs text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * A handset around a screenshot.
 *
 * Both numbers here were wrong the first time and it showed: an 8px bezel on a
 * 176px-wide phone is a hairline that disappears at page scale, and a notch
 * half the width of the screen does not read as a notch — it reads as a broken
 * image with a black bar across the top. A real one is roughly a third.
 */
function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[2.2rem] bg-slate-900 p-[10px] shadow-2xl ring-1 ring-black/30 ${className}`}>
      <div className="relative overflow-hidden rounded-[1.7rem] bg-white ring-1 ring-white/10">
        <div className="absolute left-1/2 top-0 z-10 h-[18px] w-[34%] -translate-x-1/2 rounded-b-2xl bg-slate-900" />
        {children}
      </div>
    </div>
  );
}

/**
 * The handset widths, measured rather than guessed.
 *
 * Width is really a way of setting height here: the screenshot inside is a
 * fixed 585×1266, so a frame is always ~2.16× as tall as it is wide. Below
 * `lg` the panel is a column of its own and simply grows to whatever the
 * phones need, so the limit is how much width there is. From `lg` the panel
 * sits beside the dashboard card and inherits ITS height, so the limit flips to
 * height — which is why `lg` is a step DOWN from `sm` rather than up. Sized by
 * eye instead, the phones were shaved off at 320px and floated in a hundred
 * pixels of dead air at 1280px.
 */
const PHONE_W = "w-32 min-[360px]:w-36 min-[400px]:w-40 sm:w-44 lg:w-[10.5rem] xl:w-48";

// Image sources only, aligned by index with landing.screens.shots for text.
const OWNER_SHOT_SRCS = [
  "/screenshots/owner-operations.png",
  "/screenshots/owner-bookings.png",
  "/screenshots/owner-scan.png",
];

function ScreensSection() {
  const m = useMessages("landing");
  return (
    <section id="screens" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-bold md:text-3xl">{m.screens.heading}</h2>
      <p className="mt-3 text-center text-muted-foreground">
        {m.screens.subtitle}
      </p>

      {/* The hero pairing: what staff see, next to what the customer sees. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <figure className="group flex flex-col lg:col-span-3">
          <BrowserFrame label={m.screens.dashboard.label}>
            <Image
              src="/screenshots/owner-dashboard.png"
              alt={m.screens.dashboard.alt}
              width={1440}
              height={900}
              className="w-full transition duration-500 group-hover:scale-[1.02]"
            />
          </BrowserFrame>
          <figcaption className="mt-4">
            <div className="font-semibold">{m.screens.dashboard.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.screens.dashboard.body}
            </p>
          </figcaption>
        </figure>

        <figure className="flex flex-col lg:col-span-2">
          {/*
            * Two handsets standing upright, both whole.
            *
            * `flex-1` so this fills whatever height the dashboard card sets —
            * the two sat at different heights, which read as a layout accident
            * rather than a pairing. Centred rather than pushed down: a first
            * pass sank the phones past the bottom edge for the look of it and
            * took the app's bottom navigation with them, which is a menu a
            * venue's customers are being sold, not spare margin.
            *
            * Deliberately no `overflow-hidden`. With nothing overflowing it
            * would do nothing except hide it the day something does — and a
            * silently shaved bezel is the bug that kept coming back here.
            */}
          <div className="relative flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 px-3 py-6 ring-1 ring-black/5">
            <PhoneFrame className={`${PHONE_W} shrink-0 translate-y-1.5`}>
              <Image
                src="/screenshots/app-home.png"
                alt={m.screens.app.altHome}
                width={585}
                height={1266}
                className="w-full"
              />
            </PhoneFrame>
            {/* Overlapped, and sitting a little higher, so the pair reads as
                one object photographed together rather than two cutouts. The
                overlap is kept small on purpose: the home screen behind it is
                carrying the wallet, the shortcuts and the live promotion, and a
                deeper stack ate the half of it worth showing. */}
            <PhoneFrame className={`-ml-7 ${PHONE_W} shrink-0 -translate-y-1.5 sm:-ml-8`}>
              <Image
                src="/screenshots/app-booking.png"
                alt={m.screens.app.altBooking}
                width={585}
                height={1266}
                className="w-full"
              />
            </PhoneFrame>
          </div>
          <figcaption className="mt-4">
            <div className="font-semibold">{m.screens.app.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.screens.app.body}
            </p>
          </figcaption>
        </figure>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {m.screens.shots.map((s, i) => (
          <figure key={OWNER_SHOT_SRCS[i]} className="group">
            <BrowserFrame label={`${m.screens.ownerLabel} · ${s.title}`}>
              <Image
                src={OWNER_SHOT_SRCS[i]}
                alt={`${s.title} — ${s.body}`}
                width={1440}
                height={900}
                className="w-full transition duration-500 group-hover:scale-[1.02]"
              />
            </BrowserFrame>
            <figcaption className="mt-4">
              <div className="font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function SportsSection() {
  const m = useMessages("landing");
  const [active, setActive] = useState<(typeof SPORT_KEYS)[number]>(SPORT_KEYS[0]);
  const sport = m.sports.items[active];
  return (
    <section id="sports" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-bold md:text-3xl">{m.sports.heading}</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SPORT_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active === key ? "bg-brand text-white" : "bg-app text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.sports.items[key].label}
          </button>
        ))}
      </div>
      <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-black/5">
        <div className="text-lg font-semibold">{sport.label}</div>
        <ul className="mt-3 space-y-2">
          {sport.points.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-brand" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The packages, as the system actually sells them.
 *
 * Every number here has a counterpart the software enforces: the prices are the
 * ones `plans.price` puts on an invoice, and the limits are the ones the
 * `limit:` middleware refuses past. This page previously advertised ฿2,290 and
 * ฿4,490 against a database charging ฿1,990 and ฿3,990, offered an Enterprise
 * plan that was retired, and promised "คอร์ท/การจอง ไม่จำกัด" on packages
 * capped at 10 courts.
 *
 * **If a plan changes in the admin screens, change it here too.** A price on a
 * marketing page that a customer's first invoice contradicts is worse than no
 * page at all.
 */
// Prices/highlight only; plan display name is the (untranslated) brand name,
// and limits/feature come from landing.pricing.plans[code].
const PLAN_META: { code: "starter" | "business" | "pro"; name: string; monthly: number; highlight?: boolean }[] = [
  { code: "starter", name: "Starter", monthly: 990 },
  { code: "business", name: "Business", monthly: 1990, highlight: true },
  { code: "pro", name: "Pro", monthly: 3990 },
];

function PricingSection() {
  const m = useMessages("landing");
  const [yearly, setYearly] = useState(false);
  const fmt = new Intl.NumberFormat("th-TH");

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-bold md:text-3xl">{m.pricing.heading}</h2>

      <div className="mt-6 flex items-center justify-center gap-3 text-sm">
        <span className={yearly ? "text-muted-foreground" : "font-semibold"}>{m.pricing.monthly}</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly((y) => !y)}
          className={`relative h-6 w-11 rounded-full transition ${yearly ? "bg-brand" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${yearly ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span className={yearly ? "font-semibold" : "text-muted-foreground"}>{m.pricing.yearly}</span>
      </div>

      {/* Three columns, not four. The grid was built for four packages and
          kept its shape when Enterprise was retired, so three cards filled
          three of four columns and the whole block sat left of a heading that
          is centred. `max-w-4xl mx-auto` keeps them a readable width rather
          than stretching each card across a third of a desk monitor. */}
      <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLAN_META.map((p) => {
          // Paying yearly costs ten months and covers twelve, so the saving is
          // two months. Shown as the actual yearly figure rather than a
          // discounted monthly one: a venue signing a year wants to know what
          // leaves its account, not a rate it has to multiply out itself.
          const yearlyPrice = p.monthly * 10;
          const saving = p.monthly * 2;
          const plan = m.pricing.plans[p.code];
          return (
            <div
              key={p.code}
              className={`flex flex-col rounded-2xl bg-white p-5 ring-1 ${p.highlight ? "ring-2 ring-brand" : "ring-black/5"}`}
            >
              {p.highlight && (
                <span className="mb-2 inline-block w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  {m.pricing.recommend}
                </span>
              )}
              <div className="font-bold">{p.name}</div>
              <div className="mt-2">
                {yearly ? (
                  <div>
                    <span className="text-3xl font-bold">฿{fmt.format(yearlyPrice)}</span>
                    <span className="text-sm text-muted-foreground"> {m.pricing.perYear}</span>
                    <div className="mt-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                      {m.pricing.save} ฿{fmt.format(saving)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {m.pricing.vsMonthly} ฿{fmt.format(p.monthly * 12)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold">฿{fmt.format(p.monthly)}</span>
                    <span className="text-sm text-muted-foreground"> {m.pricing.perMonth}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {plan.limits.map((l) => (
                  <div key={l} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> {l}
                  </div>
                ))}
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> {plan.feature}</div>
              </div>
              <Link
                href={`${SIGNUP}?plan=${p.code}`}
                className={`mt-5 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition ${
                  p.highlight ? "bg-brand text-white hover:bg-brand/90" : "border border-black/10 hover:bg-app"
                }`}
              >
                {m.pricing.ctaTry}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {m.pricing.note}
      </p>
    </section>
  );
}

function FaqSection() {
  const m = useMessages("landing");
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-app">
      <div className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold md:text-3xl">{m.faq.heading}</h2>
        <div className="mt-8 space-y-3">
          {m.faq.items.map(({ q, a }, i) => (
            <div key={q} className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-medium"
              >
                {q}
                <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="px-5 pb-4 text-sm text-muted-foreground">{a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
