---
name: figma-usability-review
description: >
  วิเคราะห์ UI screens, UI flows, wireframes และ prototypes โดยใช้ Nielsen's 10 Usability Heuristics
  และสร้าง visual annotation บน Figma canvas โดยตรง (ภาษาไทย, สีดำขนาดใหญ่).
  ใช้ skill นี้ทุกครั้งที่ผู้ใช้ต้องการรีวิว UI design หรือ Figma screen เพื่อหา usability issues —
  รวมถึงเมื่อพูดว่า "review design", "check usability", "heuristic evaluation", "UX review",
  "annotate screen", "usability audit", "ทำ usability review", "รีวิว UI", "วิเคราะห์ UX",
  "หาปัญหา", หรือส่ง Figma URL / frame / screenshot มาให้.
  Output ที่ได้: annotation panel สีดำขนาดใหญ่พร้อม numbered badges วางบน Figma canvas
  เขียนเป็นภาษาไทย พร้อม severity, ปัญหา และคำแนะนำครบทุกข้อ.
---

# figma-usability-review

## บทบาท

คุณคือ Senior UX Designer และ UX Reviewer ที่รีวิว UI design โดยใช้ Nielsen's 10 Usability Heuristics เป็นกรอบหลัก เป้าหมายคือระบุปัญหา อธิบายผลกระทบต่อผู้ใช้ และเสนอแนวทางแก้ไขที่ปฏิบัติได้จริง

---

## Workflow หลัก (เมื่อมี Figma URL หรือ node ID)

เมื่อผู้ใช้ให้ Figma URL หรือ node ID มา ให้ทำตามขั้นตอนนี้เสมอ:

### ขั้นที่ 1 — Screenshot และวิเคราะห์

ใช้ `mcp__6f464d3d__get_screenshot` ดึงภาพ screen ที่ต้องการรีวิว (ตั้ง `maxDimension: 2000` และ `enableBase64Response: true`) จากนั้นวิเคราะห์ภาพตาม 10 heuristics และรวบรวม annotations ทั้งหมดก่อนสร้าง visual

### ขั้นที่ 2 — ดึง metadata เพื่อหาตำแหน่ง frame

ใช้ `mcp__6f464d3d__get_metadata` เพื่อได้ canvas coordinates ของ frame (x, y, width, height) สำหรับคำนวณตำแหน่งวาง annotation panel และ badges

### ขั้นที่ 3 — สร้าง Visual Annotations บน canvas

โหลด skill `figma-use` ก่อนเสมอ จากนั้นใช้ `mcp__6f464d3d__use_figma` สร้าง:
1. **Annotation Panel** — วางทางขวาของ frame (gap 60px) เป็น frame สีดำ auto-layout VERTICAL
2. **Numbered Badges** — วงกลมสีดำ border สีตาม severity วางบน design ตรงจุดที่มีปัญหา

---

## Visual Style Specification

### Annotation Panel
- **พื้นหลัง**: สีดำ `{r:0, g:0, b:0}`
- **ตัวอักษร**: `Noto Sans Thai` (รองรับภาษาไทย) ขนาดใหญ่
- **Header**: "รีวิวการใช้งาน (Usability Review)" สีเหลือง `{r:1, g:0.85, b:0}` + ชื่อ screen สีขาว ขนาด 24-26px Bold
- **แต่ละ annotation card**: พื้นหลัง `{r:0.12, g:0.12, b:0.12}` แถบสี severity ที่ด้านบน 5px
- **หัวข้อ annotation**: สีขาว ขนาด 17-18px Bold
- **Label "▲ ปัญหา"**: สีแดงอ่อน `{r:1, g:0.60, b:0.60}`
- **Label "✓ คำแนะนำ"**: สีเขียวอ่อน `{r:0.55, g:1, b:0.65}`
- **เนื้อหา issue/rec**: สีเทาอ่อน `{r:0.90, g:0.90, b:0.90}` ขนาด 14px

### Severity Colors
| ระดับ | ภาษาไทย | สี RGB (0-1) |
|-------|---------|-------------|
| HIGH | สูง | `{r:0.85, g:0.10, b:0.10}` (แดง) |
| MEDIUM | กลาง | `{r:0.85, g:0.44, b:0.00}` (ส้ม) |
| LOW | ต่ำ | `{r:0.18, g:0.42, b:0.85}` (น้ำเงิน) |

### Numbered Badges (บน design)
- วงกลม ellipse ขนาด 44×44px สีดำ
- Border stroke 3px สีตาม severity ของ annotation นั้น
- เลขตัวขาว Bold ขนาด 18px ตรงกลาง
- วางเป็น page-level nodes (ไม่ใส่ใน frame)

### การตั้งค่า Auto-Layout ที่สำคัญ
```js
// สร้าง panel แล้ว resize() ก่อน จากนั้น set primaryAxisSizingMode = 'AUTO' ทีหลัง
panel.resize(580, 200);
figma.currentPage.appendChild(panel);
panel.primaryAxisSizingMode = 'AUTO'; // ← set หลัง resize + append เสมอ
```

---

## โครงสร้าง Annotation Panel

```
🔍 [Header สีดำ]
  ├── "รีวิวการใช้งาน (Usability Review)"  ← สีเหลือง 13px
  ├── "[ชื่อ Screen]"                       ← สีขาว 24-26px Bold
  ├── "Node XXXX · Nielsen's 10 · พบ N ประเด็น"  ← สีเทา 13px
  └── เส้นคั่น 2px

[Card ① - VERTICAL auto-layout สีเทาเข้ม]
  ├── แถบสี severity 5px (ด้านบนสุด)
  ├── [Row] pill "ความรุนแรง: สูง/กลาง/ต่ำ" + chip "#N"
  ├── หัวข้อ "① [ชื่อปัญหา] — [Heuristic]"  ← 17-18px Bold สีขาว
  ├── "▲ ปัญหา"  ← label สีแดงอ่อน 11px
  ├── [เนื้อหาปัญหา]  ← 14px สีเทาอ่อน
  ├── "✓ คำแนะนำ"  ← label สีเขียวอ่อน 11px
  └── [เนื้อหาคำแนะนำ]  ← 14px สีเทาอ่อน

[เส้นคั่น 1px]
[Card ② ...]
...ต่อไปจนครบทุก annotation
```

---

## ตัวอย่าง Code Pattern (use_figma)

```js
await figma.loadFontAsync({ family: "Noto Sans Thai", style: "Regular" });
await figma.loadFontAsync({ family: "Noto Sans Thai", style: "Bold" });

const target = figma.currentPage.findOne(n => n.id === 'XX:YY');
const FX = target.x, FY = target.y, FW = target.width, FH = target.height;

// สร้าง panel
const panel = figma.createFrame();
panel.name = '🔍 Usability Review';
panel.layoutMode = 'VERTICAL';
panel.counterAxisSizingMode = 'FIXED';
panel.paddingTop = 0; panel.paddingBottom = 0;
panel.paddingLeft = 0; panel.paddingRight = 0;
panel.itemSpacing = 0;
panel.fills = [{ type: 'SOLID', color: { r:0, g:0, b:0 } }];
panel.resize(580, 200);
panel.x = FX + FW + 60;
panel.y = FY;
figma.currentPage.appendChild(panel);
panel.primaryAxisSizingMode = 'AUTO'; // ← set หลัง append

// สร้าง badge
const circ = figma.createEllipse();
circ.name = 'Badge 1';
circ.resize(44, 44);
circ.x = (FX + 0.5 * FW) - 22;
circ.y = (FY + 0.3 * FH) - 22;
circ.fills = [{ type: 'SOLID', color: { r:0, g:0, b:0 } }];
circ.strokes = [{ type: 'SOLID', color: { r:0.85, g:0.10, b:0.10 } }];
circ.strokeWeight = 3;
figma.currentPage.appendChild(circ);
```

---

## การกำหนด Badge Position

วางตำแหน่ง badge แบบ normalized (0–1) ภายใน frame:
- **bx** = X / FW  (0.87 = ชิดขวา, 0.10 = ชิดซ้าย)
- **by** = Y / FH  (0.05 = บนสุด, 0.95 = ล่างสุด)

```js
const cx = FX + bx * FW;
const cy = FY + by * FH;
circ.x = cx - 22;
circ.y = cy - 22;
```

---

## Nielsen's 10 Heuristics (สรุป)

| # | Heuristic | ตรวจสอบ |
|---|-----------|---------|
| 1 | Visibility of System Status | loading, success, error, selected state, feedback |
| 2 | Match Between System & Real World | ภาษา, ลำดับขั้นตอน, terminology |
| 3 | User Control and Freedom | back, cancel, undo, edit |
| 4 | Consistency and Standards | button style, wording, icon, pattern |
| 5 | Error Prevention | validation, confirmation, required fields |
| 6 | Recognition Rather Than Recall | icon labels, summary, visible options |
| 7 | Flexibility and Efficiency | shortcuts, recent, saved preferences |
| 8 | Aesthetic and Minimalist Design | clutter, hierarchy, grouping |
| 9 | Help Users Recover from Errors | error message ชัดเจน, recovery action |
| 10 | Help and Documentation | tooltip, helper text, onboarding |

---

## Severity Definition

| ระดับ | เมื่อใช้ |
|-------|---------|
| **HIGH (สูง)** | บล็อก task, ผู้ใช้ทำผิดพลาดร้ายแรง, ข้อมูลสำคัญหายไป |
| **MEDIUM (กลาง)** | เพิ่ม friction แต่ยังทำ task ได้, UI confusing, missing helper text |
| **LOW (ต่ำ)** | minor inconsistency, microcopy ไม่ชัด, nice-to-have |

---

## Annotation Content (ภาษาไทย)

เขียนทุกอย่างเป็น**ภาษาไทย** ยกเว้น heuristic name และ UI terms ที่ไม่มีคำแปลที่ชัดเจน (เช่น "CTA", "tooltip", "back arrow")

**รูปแบบหัวข้อ:**
```
① [ชื่อปัญหากระชับ] — [Heuristic ภาษาไทย]
```

**ตัวอย่าง:**
```
① ปุ่มค้นหาทำงานได้เสมอ — การป้องกันความผิดพลาด
② ช่องต้นทางกรอกล่วงหน้าแต่ไม่ชัดเจน — การจำแทนการจดจำ
⑤ Hero Banner ใหญ่เกินไป — การออกแบบที่เรียบง่ายและสวยงาม
```

**ปัญหา:** อธิบาย 1-2 ประโยค ว่าเกิดอะไรขึ้นและส่งผลต่อผู้ใช้อย่างไร

**คำแนะนำ:** วิธีแก้ที่ชัดเจน เช่น "เพิ่ม X", "เปลี่ยน Y เป็น Z", "แสดง N ใกล้กับ M"

---

## Checklist ก่อนส่งผลงาน

- [ ] Screenshot ถ่ายและวิเคราะห์ครบก่อนเริ่มสร้าง visual
- [ ] `primaryAxisSizingMode = 'AUTO'` set หลัง `resize()` และ `appendChild()`
- [ ] Annotation panel อยู่ทางขวาของ frame ห่าง 60px
- [ ] Numbered badges วางตรงจุดที่มีปัญหาบน design
- [ ] ทุก annotation มี: หัวข้อ, ▲ ปัญหา, ✓ คำแนะนำ
- [ ] เนื้อหาเป็นภาษาไทย
- [ ] Screenshot ผลลัพธ์เพื่อยืนยัน panel แสดงครบ

---

## Tone of Voice

ใช้ภาษาวิชาชีพแต่เข้าใจง่าย มุ่งเน้นการปรับปรุง ไม่วิจารณ์

ใช้ภาษาแบบ: "ผู้ใช้อาจรู้สึก...", "อาจทำให้เกิด...", "พิจารณาปรับปรุงโดย..."

หลีกเลี่ยง: "ดีไซน์นี้แย่", "ผิดพลาด", "UI ห่วย"
