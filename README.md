# Advance Nay — Ten Ten Ten Co., Ltd

หน้าเว็บบันทึกเงิน advance หน้างาน เก็บข้อมูลลง Google Sheet

## ไฟล์ในโฟลเดอร์นี้
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | ตัวหน้าเว็บ (ต้องใส่ Web app URL ก่อนใช้ — ดูขั้นตอนที่ 2) |
| `icon.png` | ไอคอนโลโก้ ten ten ten. สำหรับหน้าจอ iPhone |
| `manifest.json` | ทำให้เปิดเต็มจอเหมือนแอป |
| `sw.js` | ให้เปิดใช้ได้ตอนเน็ตหลุด แล้วค่อยส่งขึ้นชีตทีหลัง |
| `AdvanceSheet.gs` | โค้ดฝั่ง Google Sheet (ไม่ต้องอัปขึ้นเว็บ) |

## ขั้นตอนที่ 1 — ต่อ Google Sheet
1. สร้าง Google Sheet เปล่า ตั้งชื่อ `Advance TenTenTen`
2. เมนู **Extensions › Apps Script** ลบโค้ดเดิม วาง `AdvanceSheet.gs` แทน กด Save
3. เลือกฟังก์ชัน `setup` แล้วกด **Run** ครั้งเดียว (อนุญาตสิทธิ์ตามที่ขึ้น — หน้าเตือน "Google hasn't verified" ให้กด Advanced › Go to ...)
4. กด **Deploy › New deployment › Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คัดลอก **Web app URL** (ลงท้าย `/exec`)

## ขั้นตอนที่ 2 — ใส่ URL ลงหน้าเว็บ
**ทำให้แล้ว** — `index.html` ในโฟลเดอร์นี้ต่อกับ Web app URL ของชีต Advance TenTenTen เรียบร้อย
ทดสอบแล้วขึ้น "ซิงก์ชีตแล้ว"

ถ้าวันหลัง deploy ใหม่จนได้ URL ใหม่ ให้แก้บรรทัด `const API = "..."` ใน `index.html`

## ขั้นตอนที่ 3 — เอาขึ้น GitHub Pages
1. สร้าง repo ใหม่ (public) เช่น `ttt-advance`
2. อัปไฟล์ทั้งโฟลเดอร์นี้ขึ้นไป (ลากวางได้เลย)
3. **Settings › Pages** → Source: `Deploy from a branch` → Branch: `main` / folder `/ (root)` → Save
4. รอ 1-2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/ttt-advance/`

## ขั้นตอนที่ 4 — ติดไอคอนบนไอโฟน
เปิดลิงก์ใน Safari → ปุ่มแชร์ → **Add to Home Screen** → ได้ไอคอนโลโก้ ten ten ten. กดแล้วเปิดเต็มจอ

## ทำหน้าให้พนักงานคนอื่น
คัดลอกโฟลเดอร์นี้ แล้วแก้ใน `index.html`
- `const OWNER = "Nay";` → ชื่อคนใหม่
- `const LS = "ttt.advance.nay.v2";` → เปลี่ยน `nay` เป็นชื่อคนใหม่
- ข้อความ `สรุป Advance · Nay` และ `<title>`

ถ้าอยากให้ทุกคนลงชีตเดียวกัน ใช้ `API` เดิมได้เลย (คอลัมน์ "ผู้บันทึก" จะแยกให้เอง)
