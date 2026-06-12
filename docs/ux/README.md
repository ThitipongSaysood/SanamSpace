# SanamSpace — UX Documentation

มาตรฐานการจัดเก็บเอกสาร UX ทั้งหมดของระบบ SanamSpace
อ้างอิงสเปก: [structure/SanamSpace_UX_Folder_Structure_v1.md](../../structure/SanamSpace_UX_Folder_Structure_v1.md)

> 🚧 โครงนี้ถูก scaffold ไว้แล้ว — แต่ละไฟล์เป็น **stub** ที่ใส่ template ไว้ รอเติมเนื้อหา

---

## โครงสร้าง

```
docs/ux/
├── customer/      # จอฝั่งลูกค้า (CUS-)        12 โมดูล
├── owner/         # จอฝั่งเจ้าของสนาม (OWN-)    11 โมดูล
├── super-admin/   # จอฝั่ง Super Admin (ADM-)    7 โมดูล
├── shared/        # UI components ใช้ร่วม (SHR-)
├── flows/         # User flows (ต้องมี diagram)
├── wireframes/    # ภาพ wireframe (.png)
├── prototypes/    # ไฟล์ prototype (.fig)
└── research/      # งานวิจัย UX
```

---

## กติกา (Documentation Rules)

1. **1 Screen = 1 File** — ทุกจอแยกเป็นไฟล์ของตัวเอง
2. **1 Flow = 1 File** — ทุก flow แยกไฟล์ และ **ต้องมี Diagram**
3. ทุก Screen ต้องมีอย่างน้อย: User Story · Components · Validation · API Dependency
4. ห้ามเก็บเอกสาร UX ไว้นอก `docs/ux/`

---

## Templates

- **Screen** (`customer/`, `owner/`, `super-admin/`, `shared/`): Objective · User Story · Entry Point · Exit Point · Components · Validation Rules · API Dependencies · Edge Cases · Success Criteria
- **Flow** (`flows/`): Objective · Actors · Preconditions · Flow Steps · **Diagram (Mermaid)** · Alternate & Error Paths · API Dependencies · Success Criteria
- **Research** (`research/`): Purpose · Summary · Details · Findings · References

แต่ละไฟล์มี frontmatter (`id`, `status: draft`, `updated`) อยู่ด้านบน

---

## Naming Convention

| ฝั่ง | Prefix | ตัวอย่าง Screen ID |
|---|---|---|
| Customer | `CUS-` | `CUS-BOOK-001` (Create Booking) |
| Owner | `OWN-` | `OWN-DASH-001` (Dashboard) |
| Super Admin | `ADM-` | `ADM-ORG-001` |
| Shared | `SHR-` | `SHR-001` (Buttons) |
| Flow | `FLOW-` | `FLOW-CUS-BOOKING` |

Wireframe: `WF-CUS-001-Login.png` · Prototype: `PT-CUS-v1.fig`

---

## สถานะการเขียน

ทุกจอเขียนเป็น **draft spec** แล้ว (เนื้อหาจริงอ้างอิง PRD / API spec / Permission & Feature Matrix / mockups ใน `image/`) — รอรีวิว

| App | โมดูล | จำนวนจอ | สถานะ |
|---|---|---|---|
| Customer | 01–12 · Auth, Home, Venue, Court, Booking, Payment, Membership, Wallet, Profile, Notification, Package, Settings | 42 | draft |
| Owner | 01–11 · Dashboard, Booking, Court, Customer, CRM, Membership, Promotion, Payment, Report, Settings, Staff | 37 | draft |
| Super Admin | 01–07 · Organizations, Subscriptions, Plans, Features, Billing, Analytics, System Settings | 14 | draft |
| Shared | UI Components (Buttons, Forms, Tables, …) | 11 | draft |
| Flows | Customer + Owner (มี Mermaid diagram) | 7 | draft |
| Research | Personas, Journey, Pain Points, Interview, Competitor | 5 | draft |

รวม **116 spec files** (+ 3 README)

> Wireframes (`.png`) และ Prototypes (`.fig`) ยังว่าง — ใส่ภาพตาม naming standard ในแต่ละโฟลเดอร์ (`WF-…`, `PT-…`)
> · API Dependencies ในแต่ละจออ้างอิง endpoint จริงจาก [API Specification](../../structure/API_Specification_v1.md) (`—` = ยังไม่มี endpoint)
