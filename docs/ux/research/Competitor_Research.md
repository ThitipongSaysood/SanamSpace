---
title: Competitor Research
type: research
status: draft
updated: 2026-06-12
---

# Competitor Research

## Purpose
- เปรียบเทียบ SanamSpace กับวิธีจองสนามที่มีอยู่ในตลาด เพื่อหาจุดต่างและจุดยืน (positioning)
- เน้นเชิงโครงสร้าง (capability) มากกว่าตัวเลขแบรนด์ — รายละเอียดเฉพาะคู่แข่งระบุเป็น **สมมติฐาน (assumption)** ให้ทีมไป verify

## Summary
- คู่แข่ง/ทางเลือกหลัก 3 กลุ่ม: (1) ระบบจองสนามเจ้าอื่น, (2) จองแบบแมนนวลผ่าน LINE/โทร, (3) Google Form/สเปรดชีต
- ทางเลือกเดิมแก้ "การจอง" แต่ส่วนใหญ่ไม่มี multi-tenant white-label, CRM, slip verification, membership/wallet ครบในที่เดียว
- จุดต่างของ SanamSpace: white-label + multi-tenant + CRM + ตรวจสลิป + membership/wallet/points บนฐาน LINE

## Details

### กลุ่มคู่แข่ง / ทางเลือก
- **ระบบจองสนามสำเร็จรูปเจ้าอื่น** — มีฟีเจอร์จอง/ปฏิทินคอร์ต อาจมีจ่ายเงินในตัว แต่มักเป็นแบรนด์ของผู้ให้บริการ ไม่ใช่ white-label ของสนาม — **สมมติฐาน:** ฟีเจอร์เฉพาะรายต้อง verify
- **LINE manual booking** — ลูกค้าทักแชทถามคิว เจ้าของจดเอง ยืนยันด้วยมือ ใช้กันแพร่หลายที่สุด ต้นทุนต่ำแต่ใช้แรงงานสูง เสี่ยงจองทับ
- **Google Form / สเปรดชีต / โทรจอง** — ฟอร์มรับจอง + ชีตจัดตาราง ไม่กันชน real-time, ไม่มีจ่ายเงิน/ข้อมูลลูกค้า

### เปรียบเทียบเชิงโครงสร้าง (assumption — ต้อง verify)
| ความสามารถ | ระบบเจ้าอื่น | LINE แมนนวล | Google Form/ชีต | SanamSpace |
|---|---|---|---|---|
| กันจองทับ real-time | บางเจ้า | ไม่มี | ไม่มี | ✅ |
| จ่าย/ตรวจสลิป | บางเจ้า | แมนนวล | ไม่มี | ✅ Slip Verification |
| Membership/Wallet/Points | บางเจ้า | ไม่มี | ไม่มี | ✅ (Business+) |
| CRM / Segment / Broadcast | น้อย | ไม่มี | ไม่มี | ✅ (Pro) |
| White-label (โลโก้/สี/โดเมน) | น้อย | ไม่มี | ไม่มี | ✅ (Business→Enterprise) |
| Multi-tenant หลายสาขา | บางเจ้า | ไม่มี | ไม่มี | ✅ organization-scoped |
| ผูกกับ LINE (Login/แจ้งเตือน) | บางเจ้า | ✅ (chat) | ไม่มี | ✅ LIFF + Messaging API |
| Analytics/Utilization | บางเจ้า | ไม่มี | จำกัด | ✅ |

### จุดต่าง (differentiators) ของ SanamSpace
- **White-label + Multi-tenant:** สนามใช้แบรนด์/โดเมนของตัวเอง บนแพลตฟอร์มเดียว แยกข้อมูลด้วย organization_id
- **ครบ end-to-end:** จอง → ตรวจสลิป → membership/wallet/points → CRM/การตลาด → analytics ในระบบเดียว
- **บนฐาน LINE:** LINE Login + แจ้งเตือน ตรงพฤติกรรมผู้ใช้ไทย ลด friction การ onboard
- **Plan ไล่ระดับ:** จากสนามเปิดใหม่ (Starter) → chain หลายสาขา + white-label เต็ม (Enterprise) ตาม Feature Matrix

## Findings
- ช่องว่างชัดที่สุดในตลาด = ไม่มีเครื่องมือที่รวม "จอง + ตรวจสลิป + CRM/membership + white-label" ครบ → จุดขายหลักของ SanamSpace
- คู่แข่งที่แท้จริงในวันแรกอาจไม่ใช่ระบบสำเร็จรูป แต่คือ "พฤติกรรมจองผ่าน LINE แบบแมนนวล" → ต้องชนะที่ความง่าย+ลดงานเจ้าของ
- White-label/multi-tenant เป็น moat เชิงโครงสร้างที่ระบบแมนนวลและฟอร์มลอกเลียนไม่ได้
- **ทุกข้อมูลเฉพาะคู่แข่งในตารางเป็นสมมติฐาน** ต้องทำ competitive audit จริง (ทดลองสมัคร/ดูราคา/ฟีเจอร์) ก่อนใช้อ้างอิงตัดสินใจ

## References
- structure/SanamSpace_PRD_Master_v1.md — Vision (White Label Multi-Tenant), Modules, Architecture Rules (No Cross Tenant Access)
- structure/Feature_Matrix_v1.md — White Label, CRM, Membership, Plan Positioning
- image/image1.1.png — customer app ที่ผูกกับ LINE
- **assumption:** รายละเอียดฟีเจอร์/ราคาคู่แข่งยังไม่ verify — ต้องทำ competitive audit ภาคสนาม
