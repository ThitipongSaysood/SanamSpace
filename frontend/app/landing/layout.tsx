import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SanamSpace — ระบบจองสนามกีฬาครบวงจร ทุกกีฬา ในแบรนด์คุณเอง",
  description:
    "ระบบจองสนามแบด ฟุตบอล ฟุตซอล เทนนิส พิคเคิลบอล จองผ่าน LINE ตรวจสลิปอัตโนมัติ เก็บมัดจำ จัดการสมาชิกและรายได้ ทดลองฟรี 30 วัน",
  keywords: [
    "ระบบจองสนาม",
    "โปรแกรมจองสนามแบด",
    "ระบบจองสนามฟุตบอล",
    "ระบบจัดการสนามกีฬา",
    "จองคอร์ทออนไลน์",
  ],
  openGraph: {
    title: "SanamSpace — ระบบจองสนามกีฬาครบวงจร",
    description:
      "จองผ่าน LINE ตรวจสลิปอัตโนมัติ เก็บมัดจำ จัดการสมาชิกและรายได้ — ทดลองฟรี 30 วัน",
    type: "website",
  },
};

// FAQPage + SoftwareApplication structured data (spec §3).
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    ["ต้องมี LINE Official Account ก่อนไหม?", "ไม่จำเป็น ทีมงานช่วยตั้งค่าให้ได้"],
    ["ข้อมูลลูกค้าเป็นของใคร?", "เป็นของสนาม 100% เราไม่ดึงลูกค้าไปจากคุณ"],
    ["รองรับหลายสาขาไหม?", "รองรับ ตั้งแต่แพ็กเกจ Pro ขึ้นไป ไม่จำกัดสาขา"],
    ["รองรับกีฬาอะไรบ้าง?", "ทุกกีฬาที่จองเป็นคอร์ท/สนาม เช่น แบด ฟุตบอล ฟุตซอล เทนนิส พิคเคิลบอล"],
    ["ย้ายข้อมูลจากระบบเดิม/Excel ได้ไหม?", "ได้ ทีมงานช่วย import ให้"],
    ["มีสัญญาผูกมัดไหม?", "ไม่มี จ่ายรายเดือน ยกเลิกได้ทุกเมื่อ"],
    ["เก็บมัดจำ/จองประจำได้ทุกแพ็กเกจไหม?", "ได้ตั้งแต่แพ็กเกจ Starter"],
  ].map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
      {children}
    </>
  );
}
