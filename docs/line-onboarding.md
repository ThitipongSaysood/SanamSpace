# วิธีเชื่อม LINE ต่อสนาม (Onboarding)

คู่มือทีละขั้นสำหรับเปิดสนามใหม่ให้ลูกค้า **login ด้วย LINE + รับ broadcast/แจ้งเตือน** ได้ —
เอาค่าจากไหน ใส่ตรงไหน ทดสอบยังไง

> อัปเดต: 2026-08-14 · ผู้ทำ: **ทีมแพลตฟอร์ม (admin) ร่วมกับเจ้าของสนาม** — เจ้าของสนามต้องเป็น
> คนสร้าง LINE ของตัวเอง (เป็นแบรนด์/ข้อมูลของสนาม) ทีมช่วยกรอกค่าให้ได้
> พื้นหลังว่าทำไมต้องแยกต่อสนาม: ดู [หลักการ multi-tenant LINE](#ทำไมต้องแยกต่อสนาม)

---

## กฎเหล็กข้อเดียวที่ต้องจำ

> **1 สนาม = 1 LINE Provider · ข้างในมี 2 channel: Messaging API (OA) + LINE Login (LIFF)**
> **ทั้งสอง channel ต้องอยู่ Provider เดียวกัน** ไม่งั้น broadcast/แจ้งเตือนจะส่งไม่ถึงลูกค้า

เพราะ LINE `userId` ผูกกับ **Provider** — userId ที่ได้ตอน login (LIFF) จะใช้ยิงข้อความจาก OA ได้
ก็ต่อเมื่ออยู่ Provider เดียวกัน

---

## ภาพรวม 4 ขั้น

1. **ที่ LINE Developers Console** — สร้าง Provider + 2 channel เอา 4 ค่า
2. **ตั้ง LIFF Endpoint URL** = หน้า login ของสนาม
3. **กรอก 4 ค่าลงระบบ** (owner หรือ admin)
4. **ทดสอบ** — login จาก LINE + ยิง broadcast ทดสอบ

ค่าที่ต้องเก็บให้ครบ 4 ตัว:

| ค่าในระบบ | มาจาก | ตัวอย่าง |
|---|---|---|
| `lineChannelId` | LINE **Login** channel → Basic settings → Channel ID | `2001234567` |
| `lineChannelSecret` | LINE **Login** channel → Basic settings → Channel secret | `abcd...` (32 ตัว) |
| `lineLiffId` | LIFF app ที่สร้างใต้ Login channel → LIFF ID | `2001234567-abcdEFGH` |
| `lineMessagingToken` | **Messaging API** channel (OA) → Channel access token (long-lived) | `eyJ...` (ยาว) |

---

## ขั้นที่ 1 — สร้าง Provider + 2 channel

ไปที่ [developers.line.biz/console](https://developers.line.biz/console/)

### 1.1 สร้าง Provider (1 ต่อสนาม)

- **Create a new provider** → ตั้งชื่อเป็นชื่อสนาม เช่น `Everyday Badminton`
- ⚠️ **อย่าเอาสนามใหม่ไปใส่ใน provider ของสนามอื่น หรือ provider กลางของ SanamSpace** —
  provider นี้คือ "กล่อง" ที่ทำให้ userId ของสนามนี้แยกและใช้ร่วมกันได้ระหว่าง login กับ OA

### 1.2 สร้าง Messaging API channel (= LINE OA ของสนาม)

ใน provider ของสนาม → **Create a new channel → Messaging API**

- ตั้งชื่อ/รูป/ข้อมูลตามแบรนด์สนาม (ลูกค้าจะเห็นอันนี้)
- ไปแท็บ **Messaging API** → เลื่อนหา **Channel access token (long-lived)** → **Issue** →
  คัดลอกเก็บไว้ → นี่คือ **`lineMessagingToken`**
- (ถ้ามี LINE OA เดิมของสนามอยู่แล้ว ใช้เชื่อมกับ channel นี้ได้ผ่าน LINE Official Account Manager)

### 1.3 สร้าง LINE Login channel + LIFF

ใน provider **เดียวกัน** → **Create a new channel → LINE Login**

- แท็บ **Basic settings**:
  - **Channel ID** → `lineChannelId`
  - **Channel secret** → `lineChannelSecret`
- แท็บ **LIFF** → **Add** สร้าง LIFF app:
  - **Size**: `Full`
  - **Endpoint URL**: `https://<โดเมนแอปลูกค้า>/v/<slug-ของสนาม>` (ดูขั้น 2)
  - **Scopes**: ติ๊ก `profile` และ `openid` (พอแล้ว — ระบบใช้ id_token; **ไม่ต้องขอ email** เพราะเราไม่เก็บ)
  - **Bot link feature**: เปิด `On (Aggressive)` เพื่อชวนลูกค้า add OA ของสนามตอน login (ไม่บังคับ)
  - กด Add → คัดลอก **LIFF ID** → `lineLiffId`

> ✅ เช็ก: Messaging channel (1.2) กับ Login channel (1.3) ต้องอยู่ **provider เดียวกัน** (ขั้น 1.1)

---

## ขั้นที่ 2 — ตั้ง LIFF Endpoint URL

หน้า login ของสนามคือ `/v/{slug}` บนแอปลูกค้า → LIFF Endpoint URL ต้อง **ตรงเป๊ะ**

```
https://<โดเมนแอปลูกค้า>/v/<slug>
```

- `<โดเมนแอปลูกค้า>` = ค่าเดียวกับ `CUSTOMER_APP_URL` ใน backend `.env` เช่น `https://app.sanamspace.com`
- `<slug>` = slug ของสนามในระบบ (เช่น `everyday-badminton`) — ดูได้ที่หน้า admin/organizations
- ตัวอย่าง: `https://app.sanamspace.com/v/everyday-badminton`

> LINE จะ redirect กลับมาที่ URL นี้หลัง login — ถ้าไม่ตรง จะ login ไม่จบ/วนลูป

---

## ขั้นที่ 3 — กรอก 4 ค่าลงระบบ

กรอกได้ 2 ทาง (ค่าไปลง `organization_settings` ของสนาม, secret เข้ารหัสอัตโนมัติ):

- **ทีมแพลตฟอร์ม**: `admin → Organizations → เลือกสนาม → ตั้งค่า LINE`
- **เจ้าของสนาม**: `owner → ตั้งค่า → การชำระเงิน/LINE`

ใส่:
- `lineChannelId`, `lineChannelSecret` (จาก Login channel)
- `lineLiffId` (จาก LIFF)
- `lineMessagingToken` (จาก Messaging channel)

> จนกว่าจะกรอก `lineChannelId` ครบ ระบบจะยัง **fallback ไป channel กลางของ .env** (สำหรับ dev/demo)
> — สนามจริงต้องกรอกของตัวเองให้ครบ

---

## ขั้นที่ 4 — ทดสอบ

1. **Login**: เปิด `https://app.../v/<slug>` (หรือกดจาก Rich Menu OA ของสนาม) → **เข้าสู่ระบบด้วย LINE**
   → ต้องเห็นหน้ายินยอมชื่อ/โลโก้ **ของสนาม** → เข้าแอปได้ → เป็นลูกค้าของสนามนี้
2. **แยกข้อมูล**: login สนาม A แล้ว โปรไฟล์/เครดิต/การจอง ต้องเป็นของสนาม A เท่านั้น
   (คนเดียวกัน login สนาม B = โปรไฟล์คนละใบ — ถูกต้อง)
3. **Broadcast**: `owner → Broadcast` ส่งทดสอบหาตัวเอง → ต้องได้ข้อความใน LINE จาก **OA ของสนาม**
   + มีลิงก์ "ยกเลิกรับข่าวสาร" ท้ายข้อความ
4. **แจ้งเตือนจอง**: ลองจอง+จ่าย → ต้องได้การ์ดยืนยันใน LINE จาก OA ของสนาม

---

## Checklist (ติ๊กต่อสนาม)

- [ ] สร้าง Provider ของสนาม (แยกจากสนามอื่น)
- [ ] Messaging API channel + Issue channel access token → `lineMessagingToken`
- [ ] LINE Login channel (provider เดียวกัน) → `lineChannelId` + `lineChannelSecret`
- [ ] LIFF app (Full, scope profile+openid) → `lineLiffId`
- [ ] LIFF Endpoint URL = `https://app.../v/<slug>` (ตรงเป๊ะ)
- [ ] กรอก 4 ค่าลง settings (admin หรือ owner)
- [ ] ทดสอบ login → เห็นแบรนด์สนาม + เป็นลูกค้าของสนาม
- [ ] ทดสอบ broadcast + แจ้งเตือนจอง ส่งถึงจริง

---

## Troubleshooting

| อาการ | สาเหตุที่พบบ่อย | แก้ |
|---|---|---|
| Broadcast/แจ้งเตือน **ส่งไม่ถึง** ทั้งที่ login ได้ | Login channel กับ Messaging OA **อยู่คนละ Provider** → userId ใช้ข้ามไม่ได้ | ย้ายให้ 2 channel อยู่ provider เดียวกันของสนาม |
| Login แล้วเด้ง error "not valid for this channel" | `lineChannelId` ที่กรอก **ไม่ตรง** channel ที่ออก id_token (ระบบเช็ก `aud`) | กรอก Channel ID ของ **Login channel** ให้ถูก |
| Login **วนลูป**/ไม่จบ | LIFF **Endpoint URL ไม่ตรง** `/v/{slug}` หรือ slug ผิด | แก้ Endpoint URL ให้ตรงโดเมน+slug |
| หน้า login โชว์แบรนด์ SanamSpace ไม่ใช่สนาม | ยังไม่ได้กรอก channel ของสนาม → ใช้ fallback กลาง | กรอก 4 ค่าของสนามให้ครบ |
| ลูกค้า add OA ไม่ขึ้น | ปิด Bot link feature ใน LIFF | เปิด Bot link = On (Aggressive) |

---

## ทำไมต้องแยกต่อสนาม

- **userId ผูกกับ Provider** → ต้องแยก provider ต่อสนาม เพื่อให้ login (LIFF) กับ OA (Messaging) คุยกันได้
- **White-label** → ลูกค้าเห็นแบรนด์ LINE ของสนาม + รับข้อความจาก OA ของสนาม ไม่ใช่ SanamSpace
- **ข้อมูลลูกค้าเป็นของสนาม** → ระบบ scope ทุกอย่างด้วย `organization_id` อยู่แล้ว (Customer ผูก
  `(organization_id, line_user_id)`) คนเดียวกันต่างสนาม = คนละเรคคอร์ด · booking/เครดิต/แต้ม/consent
  แยกต่อสนามทั้งหมด (PDPA)

> ❌ อย่าใช้ Login channel กลางตัวเดียวร่วมทุกสนาม + OA แยก — login ได้ แต่ยิงข้อความจาก OA สนามไม่ถึง
> (userId คนละ provider) และเสีย white-label
