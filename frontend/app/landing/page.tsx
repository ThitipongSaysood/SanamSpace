"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarCheck, Wallet, Users, Megaphone, BarChart3, Palette,
  ScanLine, BellRing, QrCode, LineChart, CheckCircle2, ChevronDown, Menu, X,
  CalendarX2, FileWarning, UserX, FolderX, Receipt,
} from "lucide-react";

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
const LINE = "#line"; // TODO: ใส่ลิงก์ LINE OA จริง
const SIGNUP = LINE;

function CTAButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Link
        href={SIGNUP}
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
            <Link href={LOGIN} className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-app">
              เข้าสู่ระบบ
            </Link>
            <Link href={SIGNUP} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
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
              <Link href={SIGNUP} className="mt-1 rounded-lg bg-brand px-3 py-2.5 text-center font-semibold text-white">
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
                alt="ศูนย์ปฏิบัติการประจำวันของสนาม — งานที่ต้องจัดการและตารางวันนี้"
                width={1440}
                height={900}
                priority
                className="rounded-2xl shadow-lg ring-1 ring-black/5"
              />
              <Image
                src="/screenshots/app-home.png"
                alt="หน้าแอปของลูกค้า — แต้มสะสม การจองที่กำลังจะถึง และโปรโมชั่นของสนาม"
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

      {/* 06b What it actually looks like */}
      <ScreensSection />

      {/* 07 Core features */}
      <section id="features" className="bg-app">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold md:text-3xl">ทุกอย่างที่สนามต้องใช้ อยู่ในที่เดียว</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [CalendarCheck, "ปฏิทินจองอัจฉริยะ", "กันจองซ้ำ ดูทุกคอร์ท/สนามในจอเดียว"],
              [ScanLine, "ตรวจสลิปอัตโนมัติ", "อ่านยอด/ผู้โอน กันสลิปซ้ำ อนุมัติให้เอง (Business ขึ้นไป)"],
              [Wallet, "ระบบมัดจำ", "ยืนยันคอร์ทด้วยเงินมัดจำ ลด no-show"],
              [QrCode, "สแกนเมนูเดียว", "เช็คอินและรับของรางวัล สแกนจุดเดียวจบ"],
              [Users, "สมาชิก · เครดิต · แพ็กเกจชั่วโมง", "มัดใจขาประจำ เพิ่มยอดซ้ำ (Business ขึ้นไป)"],
              [Megaphone, "CRM + ยิงโปร LINE", "หาลูกค้าที่หายไป แล้วส่งโปรผ่าน LINE ของสนามเอง (Pro)"],
              [BarChart3, "รายงานรายได้ + คอร์ทว่าง", "รู้ว่าคอร์ทไหน เวลาไหนทำเงิน"],
              [Palette, "แบรนด์ของสนามเอง", "โลโก้ สี และ LINE OA เป็นของสนาม ลูกค้าไม่เห็นแบรนด์เรา"],
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
            ข้อมูลลูกค้าทั้งหมดเป็นของคุณ พร้อมโลโก้ สี และ LINE OA ของสนามเอง ทุกแพ็กเกจ
          </p>
        </div>
      </section>

      {/* 11 FAQ */}
      <FaqSection />

      {/* 12 Final CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold md:text-3xl">เริ่มให้สนามคุณรับจองอัตโนมัติวันนี้</h2>
        <p className="mt-3 text-muted-foreground">ทดลองฟรี 30 วัน · ทีมงานเปิดสนามและตั้งค่าให้</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={SIGNUP} className="inline-flex h-12 items-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand/90">
            ทดลองใช้ฟรี 30 วัน
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
                  <li><Link href={LOGIN} className="hover:text-foreground">เข้าสู่ระบบ</Link></li>
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
        <Link href={SIGNUP} className="flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-white">
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

const OWNER_SHOTS: { src: string; title: string; body: string }[] = [
  {
    src: "/screenshots/owner-operations.png",
    title: "ศูนย์ปฏิบัติการประจำวัน",
    body: "งานที่ต้องจัดการวันนี้อยู่หน้าเดียว — ใครยังไม่มา ใครค้างจ่าย อุปกรณ์ยังไม่คืน",
  },
  {
    src: "/screenshots/owner-bookings.png",
    title: "รายการจองทั้งหมด",
    body: "ค้นด้วยรหัส ชื่อ หรือคอร์ท · กรองตามช่วงวันและสถานะ",
  },
  {
    src: "/screenshots/owner-scan.png",
    title: "สแกนจุดเดียวจบ",
    body: "QR เช็คอินและรหัสรับของรางวัล ระบบแยกให้เอง",
  },
];

function ScreensSection() {
  return (
    <section id="screens" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-bold md:text-3xl">หน้าตาระบบจริง ไม่ใช่ภาพจำลอง</h2>
      <p className="mt-3 text-center text-muted-foreground">
        ทุกภาพถ่ายจากระบบที่ใช้งานได้จริง พร้อมข้อมูลตัวอย่างของสนามสาธิต
      </p>

      {/* The hero pairing: what staff see, next to what the customer sees. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <figure className="group flex flex-col lg:col-span-3">
          <BrowserFrame label="ระบบจัดการสนาม · แดชบอร์ด">
            <Image
              src="/screenshots/owner-dashboard.png"
              alt="แดชบอร์ดของสนาม — คอร์ทไหนมีคนเล่น เหลือกี่นาที และตัวเลขของวันนี้"
              width={1440}
              height={900}
              className="w-full transition duration-500 group-hover:scale-[1.02]"
            />
          </BrowserFrame>
          <figcaption className="mt-4">
            <div className="font-semibold">แดชบอร์ด</div>
            <p className="mt-1 text-sm text-muted-foreground">
              สถานะคอร์ทสด — ใครกำลังเล่น เหลือกี่นาที คิวถัดไปคือใคร พร้อมตัวเลขของวันนี้
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
                alt="แอปของลูกค้า — แต้มสะสม การจองที่กำลังจะถึง และโปรของสนาม"
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
                alt="หน้าจองของลูกค้า — เลือกคอร์ท วัน เวลา เช่าอุปกรณ์ และใส่คูปอง"
                width={585}
                height={1266}
                className="w-full"
              />
            </PhoneFrame>
          </div>
          <figcaption className="mt-4">
            <div className="font-semibold">แอปของลูกค้า — ในแบรนด์สนามคุณ</div>
            <p className="mt-1 text-sm text-muted-foreground">
              เข้าผ่าน LINE จองเองได้ทั้งขั้นตอน ตั้งแต่เลือกคอร์ทจนจ่ายเงิน
            </p>
          </figcaption>
        </figure>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {OWNER_SHOTS.map((s) => (
          <figure key={s.src} className="group">
            <BrowserFrame label={`ระบบจัดการสนาม · ${s.title}`}>
              <Image
                src={s.src}
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
const PLANS: {
  name: string;
  monthly: number;
  highlight?: boolean;
  limits: string[];
  feature: string;
}[] = [
  {
    name: "Starter",
    monthly: 990,
    limits: ["1 สาขา · 10 คอร์ท", "พนักงาน 5 คน · 1,000 การจอง/เดือน"],
    feature: "จองสนาม · มัดจำ · เช็คอิน QR · ตรวจสลิปเอง · ลูกค้า · คืนเงิน · รายงาน",
  },
  {
    name: "Business",
    monthly: 1990,
    highlight: true,
    limits: ["3 สาขา · 30 คอร์ท", "พนักงาน 15 คน · 5,000 การจอง/เดือน"],
    feature: "+ ขายหน้าร้าน · เช่าอุปกรณ์ · เครดิตลูกค้า · แพ็กเกจชั่วโมง · สมาชิก+แต้ม · คูปอง · แบนเนอร์ · ตรวจสลิปอัตโนมัติ",
  },
  {
    name: "Pro",
    monthly: 3990,
    limits: ["ไม่จำกัดสาขา/คอร์ท", "ไม่จำกัดพนักงานและการจอง"],
    feature: "+ CRM (เซกเมนต์ · RFM) · ยิงโปร LINE · รายงานขั้นสูง + ส่งออก",
  },
];

function PricingSection() {
  const [yearly, setYearly] = useState(false);
  const fmt = new Intl.NumberFormat("th-TH");

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-bold md:text-3xl">ราคาเดียว ใช้ได้ทุกกีฬา</h2>

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
        <span className={yearly ? "font-semibold" : "text-muted-foreground"}>รายปี</span>
      </div>

      {/* Three columns, not four. The grid was built for four packages and
          kept its shape when Enterprise was retired, so three cards filled
          three of four columns and the whole block sat left of a heading that
          is centred. `max-w-4xl mx-auto` keeps them a readable width rather
          than stretching each card across a third of a desk monitor. */}
      <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((p) => {
          // Paying yearly costs ten months and covers twelve, so the saving is
          // two months. Shown as the actual yearly figure rather than a
          // discounted monthly one: a venue signing a year wants to know what
          // leaves its account, not a rate it has to multiply out itself.
          const yearlyPrice = p.monthly * 10;
          const saving = p.monthly * 2;
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
                {yearly ? (
                  <div>
                    <span className="text-3xl font-bold">฿{fmt.format(yearlyPrice)}</span>
                    <span className="text-sm text-muted-foreground"> / ปี</span>
                    <div className="mt-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                      ประหยัด ฿{fmt.format(saving)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      เทียบกับรายเดือน ฿{fmt.format(p.monthly * 12)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold">฿{fmt.format(p.monthly)}</span>
                    <span className="text-sm text-muted-foreground"> / เดือน</span>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {p.limits.map((l) => (
                  <div key={l} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> {l}
                  </div>
                ))}
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> {p.feature}</div>
              </div>
              <Link
                href={LINE}
                className={`mt-5 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition ${
                  p.highlight ? "bg-brand text-white hover:bg-brand/90" : "border border-black/10 hover:bg-app"
                }`}
              >
                ทดลองใช้ฟรี 30 วัน
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ทุกแพ็กเกจรองรับทุกกีฬา · ทดลองฟรี 30 วัน ไม่ต้องใช้บัตรเครดิต · ไม่มีสัญญาผูกมัด ยกเลิกได้ทุกเมื่อ
      </p>
    </section>
  );
}

const FAQS: [string, string][] = [
  ["ต้องมี LINE Official Account ก่อนไหม?", "ไม่จำเป็น ทีมงานช่วยตั้งค่าให้ได้"],
  ["ข้อมูลลูกค้าเป็นของใคร?", "เป็นของสนาม 100% เราไม่ดึงลูกค้าไปจากคุณ"],
  ["รองรับหลายสาขาไหม?", "Business รองรับ 3 สาขา · Pro ไม่จำกัด · Starter 1 สาขา"],
  ["รองรับกีฬาอะไรบ้าง?", "ทุกกีฬาที่จองเป็นคอร์ท/สนาม เช่น แบด ฟุตบอล ฟุตซอล เทนนิส พิคเคิลบอล"],
  ["ย้ายข้อมูลจากระบบเดิม/Excel ได้ไหม?", "ได้ ทีมงานช่วย import ให้"],
  ["มีสัญญาผูกมัดไหม?", "ไม่มี จ่ายรายเดือน ยกเลิกได้ทุกเมื่อ"],
  ["เก็บมัดจำได้ทุกแพ็กเกจไหม?", "ได้ ตั้งแต่ Starter — เช็คอิน QR ตรวจสลิป คืนเงิน และรายงาน ก็อยู่ในทุกแพ็กเกจ"],
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
