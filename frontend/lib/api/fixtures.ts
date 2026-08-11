import type {
  Venue, Court, Sport, CourtSpec, ReviewSummary, VenuePackage,
  Membership, Wallet, Promotion, AppNotification,
} from "@/lib/types";

export const venues: Venue[] = [
  {
    id: "everyday-badminton", name: "Everyday Badminton",
    sports: ["badminton"], rating: 4.8, reviewCount: 124,
    openTime: "10:00", closeTime: "22:00", address: "ถนนงามวงศ์วาน นนทบุรี",
    imageUrl: "/venues/everyday.jpg",
    facilities: ["parking", "shower", "cafe", "wifi", "aircon"],
    pricePerHour: 250, distanceKm: 1.2,
    phone: "081-234-5678",
    travelHint: "15 นาทีจาก MRT บางรักน้อย-ท่าอิฐ",
    peakNote: "18:00–22:00 สนามเต็มเร็วมาก แนะนำให้จองล่วงหน้า",
    description: "สนามแบดมินตันมาตรฐาน พื้นไม้ไร้แรงสะท้อน รองรับทุกระดับการเล่น พร้อมสิ่งอำนวยความสะดวกครบครัน",
    weekHours: [
      { day: "จันทร์", open: "08:00", close: "24:00" },
      { day: "อังคาร", open: "08:00", close: "24:00" },
      { day: "พุธ", open: "08:00", close: "24:00" },
      { day: "พฤหัสบดี", open: "08:00", close: "24:00" },
      { day: "ศุกร์", open: "08:00", close: "24:00" },
      { day: "เสาร์", open: "07:00", close: "24:00" },
      { day: "อาทิตย์", open: "07:00", close: "24:00" },
    ],
  },
  {
    id: "tsr-arena", name: "TSR Arena",
    sports: ["badminton", "futsal"], rating: 4.6, reviewCount: 88,
    openTime: "09:00", closeTime: "23:00", address: "ปทุมธานี",
    imageUrl: "/venues/tsr.jpg", facilities: ["parking", "cafe"],
    pricePerHour: 220, distanceKm: 2.1,
  },
];

const everydayCourtSpec: CourtSpec = {
  sport: "แบดมินตัน",
  floor: "PVC",
  aircon: "มี",
  height: "12 เมตร",
  lighting: "LED",
  standard: "BWF",
  players: "2-4 คน",
};

export const courts: Court[] = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `court-${i + 1}`, venueId: "everyday-badminton",
    name: `Court ${i + 1}`, sport: "badminton" as const, pricePerHour: 200,
    spec: everydayCourtSpec,
  })),
  // TSR Arena offers badminton + futsal courts.
  ...Array.from({ length: 4 }, (_, i): Court => ({
    id: `tsr-court-${i + 1}`, venueId: "tsr-arena",
    name: `Court ${i + 1}`,
    sport: (i < 2 ? "badminton" : "futsal") as Sport,
    pricePerHour: i < 2 ? 220 : 600,
  })),
];

export const reviewSummary: ReviewSummary = {
  average: 4.8,
  total: 236,
  breakdown: { 5: 198, 4: 28, 3: 6, 2: 3, 1: 1 },
  reviews: [
    {
      id: "rv-1", author: "ทานต์", rating: 5, date: "25 เม.ย. 2567",
      text: "สนามดีมาก แอร์เย็น สะอาด ห้องน้ำสะอาด เดินทางสะดวกครับ",
    },
    {
      id: "rv-2", author: "บอล", rating: 5, date: "18 เม.ย. 2567",
      text: "ไฟสว่างดี พื้นสนามดีมากครับ",
    },
  ],
};

export const packages: VenuePackage[] = [
  { id: "pkg-10", name: "แพ็กเกจ 10 ชม.", hours: 10, price: 2500, validDays: 90, savePercent: 15 },
  { id: "pkg-20", name: "แพ็กเกจ 20 ชม.", hours: 20, price: 4500, validDays: 120, savePercent: 20 },
  { id: "pkg-50", name: "แพ็กเกจ 50 ชม.", hours: 50, price: 10000, validDays: 180, savePercent: 25 },
];

export const membership: Membership = {
  tier: "Gold",
  memberId: "ED-0001234",
  points: 820,
  expiresAt: "31 ธ.ค. 2567",
  benefits: [
    "ส่วนลด 10% ทุกการจอง",
    "สะสมแต้ม 1 บาท = 1 คะแนน",
    "สิทธิ์จองล่วงหน้าก่อนใคร 1 วัน",
  ],
};

export const wallet: Wallet = {
  balance: 580,
  transactions: [
    { id: "txn-1", date: "20 พ.ค.", label: "เติมเงิน", amount: 500 },
    { id: "txn-2", date: "18 พ.ค.", label: "จอง Court 1", amount: -225 },
    { id: "txn-3", date: "15 พ.ค.", label: "จอง Court 2", amount: -225 },
  ],
};

export const promotions: Promotion[] = [
  { id: "promo-1", title: "จองก่อน 16:00 น. ลด 10%", subtitle: "ทุกวัน จันทร์–ศุกร์", tag: "ส่วนลด", couponCode: "SAVE10" },
  { id: "promo-2", title: "Happy Hour", subtitle: "18:00–20:00", tag: "แพ็กเกจ" },
  { id: "promo-3", title: "สมาชิก Gold ลดเพิ่ม 5%", subtitle: "ทุกการจอง", tag: "ส่วนลด" },
];

export const notifications: AppNotification[] = [
  {
    id: "ntf-1", kind: "booking", title: "การจองสำเร็จ",
    body: "Court 1 วันที่ 25 พ.ค. 18:00", timeAgo: "เมื่อสักครู่",
  },
  {
    id: "ntf-2", kind: "reminder", title: "เตือนความจำการจอง",
    body: "อย่าลืมการจองของคุณ Court 1 วันที่ 25 พ.ค. 18:00", timeAgo: "1 ชั่วโมงที่แล้ว",
  },
  {
    id: "ntf-3", kind: "promo", title: "โปรโมชั่นพิเศษ",
    body: "ลด 10% จองก่อน 16:00", timeAgo: "2 ชั่วโมงที่แล้ว",
  },
  {
    id: "ntf-4", kind: "points", title: "คะแนนเข้าแล้ว",
    body: "คุณได้รับ 225 คะแนน", timeAgo: "1 วันที่แล้ว",
  },
];
