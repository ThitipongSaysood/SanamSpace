---
id: OWN-SET-002
screen: Branding
module: Settings
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-SET-002 · Branding

## Objective
- ตั้งค่า white-label branding ขององค์กร (โลโก้, แบนเนอร์, สี, ชื่อแบรนด์)
- ควบคุมหน้าตา Customer App และ Owner Portal ตามแบรนด์ของ tenant
- เก็บค่าทั้งหมดใน organization_settings

## User Story
> As an **Owner**, I want **ตั้งค่าโลโก้ สี และชื่อแบรนด์ของสนาม**, so that **แอปและพอร์ทัลแสดงเป็นแบรนด์ของเราแบบ white-label**.

## Entry Point
- เมนู Settings → Branding จาก sidebar
- ลิงก์จาก General Settings (OWN-SET-001)

## Exit Point
- บันทึกสำเร็จ → คงหน้าเดิม + toast ยืนยัน
- ไปแท็บ General (OWN-SET-001) / Branch Settings (OWN-SET-003)

## Components
- อัปโหลดโลโก้ / แบนเนอร์ (เก็บที่ Cloudflare R2)
- ตัวเลือกสีหลัก/รอง (เช่น Primary #16A34A)
- ชื่อแบรนด์ที่แสดงผล
- Live preview ของหน้าตาแอป/พอร์ทัล
- ปุ่ม "บันทึก"

## Validation Rules
- ไฟล์ภาพ: ประเภท (PNG/JPG/SVG) และขนาดไม่เกินที่กำหนด
- ค่าสีเป็นรหัส HEX ที่ถูกต้อง
- ผูกกับ `organization_id`; เฉพาะ Owner แก้ไขได้
- ค่าทั้งหมดเก็บใน organization_settings

## API Dependencies
- `GET /api/v1/organizations/{id}` — ดึงค่า branding
- `PUT /api/v1/organizations/{id}` — บันทึก branding (โลโก้/สี/ชื่อ)
- หมายเหตุ: อัปโหลดไฟล์ขึ้น Cloudflare R2 (ไม่มี endpoint upload เฉพาะใน spec)

## Edge Cases
- ไฟล์ใหญ่/ผิดประเภท → block + แจ้ง error
- อัปโหลด R2 ล้มเหลว → คงค่าเดิม + retry
- Permission denied: เฉพาะ Owner (Organization = Full); role อื่นซ่อนปุ่มบันทึก
- สีตัดกับพื้นหลังจนอ่านยาก → เตือน contrast (optional)
- Preview ไม่ตรงหลังบันทึก → รีโหลด config

## Success Criteria
- อัปโหลดโลโก้/แบนเนอร์และตั้งสี/ชื่อแบรนด์ได้ ค่าคงอยู่หลังรีโหลด
- Customer App และ Owner Portal แสดงผลตาม branding ที่ตั้ง
- เฉพาะ Owner ตั้งค่าได้
- ไฟล์ผิดประเภท/ใหญ่เกินถูกบล็อก
