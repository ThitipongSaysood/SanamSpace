---
id: SHR-010
screen: Loading State
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-010 · Loading State

> _Shared UI component spec — สถานะกำลังโหลด (spinner / skeleton) ใช้ร่วมกันทุกแอป_

## Objective
- บอกผู้ใช้ว่าระบบกำลังทำงาน ลดความรู้สึกว่าค้าง
- คงเค้าโครงหน้าไว้ระหว่างรอข้อมูล (skeleton)
- กันการกดซ้ำระหว่างประมวลผล

## User Story
> As a **user**, I want **เห็นว่าระบบกำลังโหลดอยู่**, so that **รออย่างมั่นใจและไม่กดซ้ำจนเกิดข้อผิดพลาด**.

## Entry Point
N/A — shared component · แสดงระหว่างดึงข้อมูล/บันทึก/อัปโหลด บนทุกจอ

## Exit Point
N/A — shared component · เมื่อโหลดเสร็จ แทนที่ด้วยเนื้อหาจริง / Empty / Error

## Components
- Variants: Spinner (inline/ปุ่ม), Skeleton (รายการ/การ์ด/ตาราง), Full-page loader, Progress bar (งานที่วัด %)
- โครงสร้าง skeleton สะท้อนเลย์เอาต์จริง (block เทาอ่อน shimmer)
- ปุ่มขณะโหลด: spinner + ล็อกปุ่ม (อ้างอิง Button SHR-001)
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · spinner/progress สีหลัก `#16A34A`

## Validation Rules
- เลือกชนิดให้เหมาะ: list/หน้าใหญ่ → skeleton, action สั้น → spinner
- โหลดนานควรมีข้อความบอก/ความคืบหน้า
- Do: คง layout เดิมด้วย skeleton · Don't: ใช้ full-page loader บังทั้งจอกับงานเล็ก

## API Dependencies
N/A — presentational · ผูกกับสถานะ pending ของ request ในจอที่ใช้

## Edge Cases
- โหลดนานเกินไป — แสดงข้อความ "กำลังโหลด…" / ปุ่มยกเลิกถ้าทำได้
- โหลดเร็วมาก — ดีเลย์เล็กน้อยกัน spinner กระพริบ
- โหลดเสร็จ → empty: ส่งต่อ Empty State (SHR-009)
- โหลดล้มเหลว → Error State (SHR-011)
- โหลดบางส่วน (pagination) — แสดง loader ท้ายรายการ ไม่บังของเดิม

## Success Criteria
- ทุกแอปใช้ loading component ชุดเดียวกัน รูปแบบตรงกัน
- ไม่กระตุก/ไม่กระพริบ, skeleton ตรงเลย์เอาต์จริง
- a11y ประกาศสถานะ loading (aria-busy/role=status), contrast ผ่าน AA
