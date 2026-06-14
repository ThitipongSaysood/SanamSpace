"use client";
import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck, ShieldCheck, Wallet, Repeat, Users, Megaphone, BarChart3, Palette,
  ScanLine, BellRing, QrCode, LineChart, CheckCircle2, ChevronDown, Menu, X,
  CalendarX2, FileWarning, UserX, FolderX, Receipt,
} from "lucide-react";

const TRIAL = "/owner/login"; // ทดลองใช้ฟรี / เข้าสู่ระบบ
const LINE = "#line"; // TODO: ใส่ลิงก์ LINE OA จริง

function CTAButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Link
        href={TRIAL}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-base font-semibold text-white shadow-sm transition hover:bg-brand/90"
      >
        ทดลองใช้ฟรี 30 วัน
      </Link>
      <a
        href="#pricing"
        className="inline-flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-6 text-base font-semibold text-foreground transition hover:bg-app"
      >
        ดูแพ็กเกจ
      </a>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <a href="#features" className="hover:text-foreground">ฟีเจอร์</a>
            <a href="#sports" className="hover:text-foreground">กีฬาที่รองรับ</a>
            <a href="#pricing" className="hover:text-foreground">ราคา</a>
            <a href="#faq" className="hover:text-foreground">คำถามที่พบบ่อย</a>
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link href={TRIAL} className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-app">
              เข้าสู่ระบบ
            </Link>
            <Link href={TRIAL} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
              ทดลองใช้ฟรี
            </Link>
          </div>
          <button
            type="button"
            aria-label="เมนู"
            onClick={() => setMenuOpen((o) => !o)}
            className="ml-auto grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-app md:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-black/5 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1 text-sm font-medium">
              {[["ฟีเจอร์", "#features"], ["กีฬาที่รองรับ", "#sports"], ["ราคา", "#pricing"], ["คำถามที่พบบ่อย", "#faq"]].map(
                ([label, href]) => (
                  <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-app">
                    {label}
                  </a>
                ),
              )}
              <Link href={TRIAL} className="mt-1 rounded-lg bg-brand px-3 py-2.5 text-center font-semibold text-white">
                ทดลองใช้ฟรี
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
              <CheckCircle2 className="size-4" /> White-Label · ทุกกีฬา
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">
              ระบบจองสนามครบวงจร<br />สำหรับทุกกีฬา <span className="text-brand">ในแบรนด์ของคุณเอง</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              แบดมินตัน ฟุตบอล ฟุตซอล เทนนิส พิคเคิลบอล — เปิดให้ลูกค้าจองผ่าน LINE, ตรวจสลิปอัตโนมัติ,
              เก็บมัดจำ, จัดการสมาชิกและรายได้ ครบในระบบเดียว
            </p>
            <CTAButtons className="mt-6" />
            <p className="mt-4 text-sm text-muted-foreground">
              ไม่ต้องใช้บัตรเครดิต · ตั้งค่าเสร็จใน 1 วัน · ข้อมูลเป็นของสนามคุณ 100%
            </p>
          </div>
          {/* Visual mockup placeholder */}
          <div className="relative">
            <div className="rounded-3xl bg-gradient-to-br from-brand/15 to-brand/5 p-6 ring-1 ring-black/5">
              <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">ปฏิทินจอง · วันนี้</div>
                  <CalendarCheck className="size-5 text-brand" />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-8 rounded-md ${[2, 5, 6, 9, 13].includes(i) ? "bg-brand/80" : "bg-app"}`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand/10 p-3">
                  <QrCode className="size-8 text-brand" />
                  <div className="text-xs">
                    <div className="font-semibold">เช็คอินด้วย QR</div>
                    <div className="text-muted-foreground">BK260615ABCD</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 Social proof — waitlist style (no fake numbers) */}
      <section className="border-y border-black/5 bg-app">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">กำลังเปิดรับสนามรุ่นแรก 🎉</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[["7+", "กีฬาที่รองรับ"], ["ครบวงจร", "จอง→จ่าย→เช็คอิน"], ["100%", "ข้อมูลเป็นของสนาม"]].map(([n, l]) => (
              <div key={l} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-2xl font-bold text-brand">{n}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 Problem */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold md:text-3xl">ยังบริหารสนามด้วย LINE + สมุดจดอยู่ใช่ไหม?</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [CalendarX2, "รับจองซ้ำซ้อน", "ทะเลาะกับลูกค้าหน้างาน เสียลูกค้า เสียชื่อ"],
            [FileWarning, "ตรวจสลิปทีละใบ", "เสียเวลา เสี่ยงเจอสลิปปลอม/สลิปซ้ำ"],
            [UserX, "ลูกค้าจองแล้วไม่มา", "no-show เสียรายได้ทุกวัน"],
            [FolderX, "ข้อมูลลูกค้ากระจัดกระจาย", "ไม่รู้ว่าใครเป็นขาประจำ"],
            [Receipt, "ปิดยอดสิ้นเดือนยาก", "ไม่รู้รายได้จริง คอร์ทไหนคุ้ม"],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof CalendarX2;
            return (
              <div key={title as string} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                <I className="size-7 text-brand-danger" />
                <div className="mt-3 font-semibold">{title as string}</div>
                <p className="mt-1 text-sm text-muted-foreground">{body as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 05 How it works */}
      <section className="bg-app">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold md:text-3xl">ให้ลูกค้าจองเองครบทุกขั้น คุณแค่ดูแลสนาม</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [LineChart, "1. จองผ่าน LINE", "ลูกค้า Login ผ่าน LINE เลือกกีฬา สนาม วันเวลา"],
              [ScanLine, "2. โอน + อัปสลิป", "ระบบตรวจให้อัตโนมัติ กันสลิปซ้ำ"],
              [BellRing, "3. ยืนยัน + เตือน", "ยืนยันการจอง + เตือนก่อนถึงเวลาเล่น"],
              [QrCode, "4. เช็คอิน QR", "ลูกค้าเช็คอินด้วย QR หน้าสนาม"],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof LineChart;
              return (
                <div key={title as string} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                  <div className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
                    <I className="size-6" />
                  </div>
                  <div className="mt-3 font-semibold">{title as string}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{body as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 06 Sports supported */}
      <SportsSection />

      {/* 07 Core features */}
      <section id="features" className="bg-app">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold md:text-3xl">ทุกอย่างที่สนามต้องใช้ อยู่ในที่เดียว</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [CalendarCheck, "ปฏิทินจองอัจฉริยะ", "กันจองซ้ำ ดูทุกคอร์ท/สนามในจอเดียว"],
              [ScanLine, "ตรวจสลิปอัตโนมัติ", "อ่านยอด/ธนาคาร ตรวจสลิปซ้ำ อนุมัติในคลิกเดียว"],
              [Wallet, "ระบบมัดจำ", "ลด no-show ของสนามราคาสูง"],
              [Repeat, "จองประจำ", "ก๊วนประจำจองล่วงหน้าได้เลย"],
              [Users, "สมาชิก · Wallet · แพ็กเกจ", "มัดใจขาประจำ เพิ่มยอดซ้ำ"],
              [Megaphone, "CRM + Broadcast", "ยิงโปรผ่าน LINE หาลูกค้าที่หายไป"],
              [BarChart3, "รายงานรายได้ + Utilization", "รู้ว่าคอร์ทไหน เวลาไหนทำเงิน"],
              [Palette, "White Label", "แบรนด์ โลโก้ สี โดเมน เป็นของสนามคุณเอง"],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof CalendarCheck;
              return (
                <div key={title as string} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                  <I className="size-7 text-brand" />
                  <div className="mt-3 font-semibold">{title as string}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{body as string}</p>
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
            SanamSpace ไม่ใช่ marketplace ที่ดึงลูกค้าไปจากคุณ — ลูกค้าจองในแบรนด์สนามคุณเอง
            ข้อมูลลูกค้าทั้งหมดเป็นของคุณ พร้อมโลโก้ สี และโดเมนของสนามเอง (Pro ขึ้นไป)
          </p>
        </div>
      </section>

      {/* 11 FAQ */}
      <FaqSection />

      {/* 12 Final CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold md:text-3xl">เริ่มให้สนามคุณรับจองอัตโนมัติวันนี้</h2>
        <p className="mt-3 text-muted-foreground">ทดลองฟรี 30 วัน ตั้งค่าเสร็จใน 1 วัน</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={TRIAL} className="inline-flex h-12 items-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand/90">
            ทดลองใช้ฟรี
          </Link>
          <a href={LINE} className="inline-flex h-12 items-center rounded-xl border border-black/10 px-6 font-semibold hover:bg-app">
            คุยกับทีมงานผ่าน LINE
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
                ระบบจองสนามกีฬาครบวงจร ทุกกีฬา ในแบรนด์ของคุณเอง
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div>
                <div className="font-semibold">เมนู</div>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground">ฟีเจอร์</a></li>
                  <li><a href="#pricing" className="hover:text-foreground">ราคา</a></li>
                  <li><a href="#faq" className="hover:text-foreground">คำถามที่พบบ่อย</a></li>
                  <li><Link href={TRIAL} className="hover:text-foreground">เข้าสู่ระบบ</Link></li>
                </ul>
              </div>
              <div>
                <div className="font-semibold">ติดต่อ</div>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li><a href={LINE} className="hover:text-foreground">LINE OA</a></li>
                  <li><a href="mailto:hello@sanamspace.com" className="hover:text-foreground">อีเมล</a></li>
                  <li><a href="tel:020000000" className="hover:text-foreground">โทรศัพท์</a></li>
                </ul>
              </div>
              <div>
                <div className="font-semibold">กฎหมาย</div>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground">นโยบายความเป็นส่วนตัว (PDPA)</a></li>
                  <li><a href="#" className="hover:text-foreground">เงื่อนไขการใช้งาน</a></li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">© {2026} SanamSpace</p>
        </div>
      </footer>

      {/* Sticky mobile CTA bar (spec §4) */}
      <div className="sticky bottom-0 z-40 border-t border-black/5 bg-white/95 p-3 backdrop-blur md:hidden">
        <Link href={TRIAL} className="flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-white">
          ทดลองใช้ฟรี 30 วัน
        </Link>
      </div>
    </div>
  );
}

const SPORTS: { key: string; label: string; points: string[] }[] = [
  { key: "badminton", label: "แบดมินตัน", points: ["จองรายชั่วโมง", "แพ็กเกจชั่วโมงเหมา", "waitlist เวลาเต็ม"] },
  { key: "football", label: "ฟุตบอล / ฟุตซอล", points: ["เก็บมัดจำ", "จองประจำรายสัปดาห์ (ก๊วนประจำ)", "จองทั้งสนาม"] },
  { key: "tennis", label: "เทนนิส", points: ["ระบบสมาชิก/คลับ", "จองคอร์ส coach"] },
  { key: "pickleball", label: "พิคเคิลบอล", points: ["open-play", "หาเพื่อนเล่น", "จัดอีเวนต์"] },
  { key: "basketball", label: "บาส / วอลเลย์", points: ["จองเหมาคอร์ท", "จัดทีม"] },
];

function SportsSection() {
  const [active, setActive] = useState(SPORTS[0].key);
  const sport = SPORTS.find((s) => s.key === active)!;
  return (
    <section id="sports" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-bold md:text-3xl">ระบบเดียว รองรับทุกกีฬา ปรับให้เข้ากับธุรกิจคุณ</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SPORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active === s.key ? "bg-brand text-white" : "bg-app text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
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

// Prices per spec §8 (marketing copy). Yearly = pay 10 months, billed yearly.
const PLANS: { name: string; monthly: number | null; highlight?: boolean; branches: string; feature: string; cta: string }[] = [
  { name: "Starter", monthly: 990, branches: "1 สาขา", feature: "จอง + มัดจำ + จองประจำ + ตรวจสลิป", cta: "ทดลองฟรี" },
  { name: "Business", monthly: 2290, branches: "3 สาขา", feature: "+ สมาชิก/Wallet/แพ็กเกจ/โปรโมชั่น", cta: "ทดลองฟรี" },
  { name: "Pro", monthly: 4490, highlight: true, branches: "ไม่จำกัดสาขา", feature: "+ CRM/Broadcast/Analytics/White Label เต็ม", cta: "ทดลองฟรี" },
  { name: "Enterprise", monthly: null, branches: "ไม่จำกัดสาขา", feature: "ทุกอย่าง + Dedicated", cta: "คุยกับทีมงาน" },
];

function PricingSection() {
  const [yearly, setYearly] = useState(false);
  const fmt = new Intl.NumberFormat("th-TH");

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-bold md:text-3xl">ราคาเดียว ใช้ได้ทุกกีฬา ไม่จำกัดจำนวนการจอง</h2>

      <div className="mt-6 flex items-center justify-center gap-3 text-sm">
        <span className={yearly ? "text-muted-foreground" : "font-semibold"}>รายเดือน</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly((y) => !y)}
          className={`relative h-6 w-11 rounded-full transition ${yearly ? "bg-brand" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${yearly ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span className={yearly ? "font-semibold" : "text-muted-foreground"}>
          รายปี <span className="text-brand">(จ่าย 10 ได้ 12)</span>
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const perMonth = p.monthly == null ? null : yearly ? Math.round((p.monthly * 10) / 12) : p.monthly;
          return (
            <div
              key={p.name}
              className={`flex flex-col rounded-2xl bg-white p-5 ring-1 ${p.highlight ? "ring-2 ring-brand" : "ring-black/5"}`}
            >
              {p.highlight && (
                <span className="mb-2 inline-block w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  แนะนำ
                </span>
              )}
              <div className="font-bold">{p.name}</div>
              <div className="mt-2">
                {perMonth == null ? (
                  <div className="text-2xl font-bold">ติดต่อเรา</div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold">฿{fmt.format(perMonth)}</span>
                    <span className="text-sm text-muted-foreground"> / เดือน</span>
                    {yearly && <div className="text-xs text-brand">เมื่อจ่ายรายปี</div>}
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-brand" /> {p.branches}</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-brand" /> คอร์ท/การจอง ไม่จำกัด</div>
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> {p.feature}</div>
              </div>
              <Link
                href={p.monthly == null ? LINE : TRIAL}
                className={`mt-5 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition ${
                  p.highlight ? "bg-brand text-white hover:bg-brand/90" : "border border-black/10 hover:bg-app"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ทุกแพ็กเกจรองรับทุกกีฬา · ทดลองฟรี 30 วัน · มีค่าติดตั้งครั้งเดียว (ฟรีช่วงเปิดตัว)
      </p>
    </section>
  );
}

const FAQS: [string, string][] = [
  ["ต้องมี LINE Official Account ก่อนไหม?", "ไม่จำเป็น ทีมงานช่วยตั้งค่าให้ได้"],
  ["ข้อมูลลูกค้าเป็นของใคร?", "เป็นของสนาม 100% เราไม่ดึงลูกค้าไปจากคุณ"],
  ["รองรับหลายสาขาไหม?", "รองรับ ตั้งแต่แพ็กเกจ Pro ขึ้นไป ไม่จำกัดสาขา"],
  ["รองรับกีฬาอะไรบ้าง?", "ทุกกีฬาที่จองเป็นคอร์ท/สนาม เช่น แบด ฟุตบอล ฟุตซอล เทนนิส พิคเคิลบอล"],
  ["ย้ายข้อมูลจากระบบเดิม/Excel ได้ไหม?", "ได้ ทีมงานช่วย import ให้"],
  ["มีสัญญาผูกมัดไหม?", "ไม่มี จ่ายรายเดือน ยกเลิกได้ทุกเมื่อ"],
  ["เก็บมัดจำ/จองประจำได้ทุกแพ็กเกจไหม?", "ได้ตั้งแต่แพ็กเกจ Starter"],
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-app">
      <div className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold md:text-3xl">คำถามที่พบบ่อย</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map(([q, a], i) => (
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
