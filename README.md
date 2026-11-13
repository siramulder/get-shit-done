# Task Priority App (v2 "ตัดสินใจทีละคู่")

เว็บแอปหน้าเดียวสำหรับจัดลำดับงานด้วยมือ ใช้งานจริงที่ https://siramulder.github.io/get-shit-done/

- เพิ่มงานด้วยชื่อ งานใหม่อยู่บนสุด
- เรียงลำดับด้วยการลากการ์ด หรือปุ่ม ↑ ↓ (ลากด้วยคีย์บอร์ดได้)
- **ตรวจลำดับ**: แอปถามทีละคู่ว่า "อันไหนทำก่อน?" ไล่จากล่างขึ้นบน ข้ามได้ ออกได้ทุกเมื่อ
- **เลิกทำ / ทำซ้ำ** ได้ทุกการกระทำ (⌘Z, ⇧⌘Z)
- ทำเสร็จ, ย้อนกลับ, ลบ และส่วน "เสร็จวันนี้"
- กำหนดส่งเป็นป้ายบอกอย่างเดียว ไม่เรียงลำดับให้เอง (กำลังทำใน slice 3)

ข้อมูลเก็บใน `localStorage` ของเบราว์เซอร์ ไม่มี backend และไม่มีบัญชีผู้ใช้ แอปเป็นธีมมืดอย่างเดียว

## วิธีรัน
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # ไฟล์ static อยู่ใน dist/
```

## วิธีเทสต์
```bash
npm test -- --run                       # Vitest + React Testing Library (jsdom)
npx vitest --run --sequence.shuffle     # สลับลำดับเทสต์ ต้องผ่านเหมือนกัน
npm run lint
bash scripts/verify-v2.sh               # ตัวตรวจหลักของ v2: scope, id ของเทสต์, build, test, dev server (รายงานอย่างเดียว)
bash scripts/verify-v2.selftest.sh      # พิสูจน์ว่า verify-v2 จับข้อบกพร่องที่ใส่ไว้ได้ (ใช้เวลานาน)
```
เทสต์รันใน timezone `Asia/Bangkok` ซึ่งตั้งไว้ใน `vite.config.ts`

`scripts/verify-phase0.sh` และ `scripts/verify-phase2.sh` เป็น snapshot ของ MVP1 ที่เลิกใช้แล้ว ไม่ใช้เป็นด่านตรวจของ v2

การลากวาง หน้าตาบนจอเล็ก และ contrast ต้องตรวจในเบราว์เซอร์จริงตาม [docs/MANUAL_QA.md](docs/MANUAL_QA.md) เพราะ jsdom ไม่มี layout

## โครงสร้าง
```
src/
  App.tsx        # ที่เดียวที่เรียก useTasks แล้วส่งค่าลงไปให้ component
  hooks/         # useTasks: state ของงานทั้งหมด, บันทึกอัตโนมัติ, ประวัติ undo/redo
  lib/           # storage.ts (+ migration), date.ts, review.ts (ตรรกะตรวจลำดับ), labels.ts (ข้อความ UI ทั้งหมด)
  components/    # UI ล้วน + ตัวช่วยลากวาง/focus
  types/         # Task, Store
scripts/         # verify-v2.sh + self-test และ snapshot ของ MVP1
docs/            # PRD, dev plan, manual QA
```

## เอกสาร
- [docs/PRD-v2.md](docs/PRD-v2.md) — ความต้องการและ acceptance criteria ของ v2
- [docs/PRD.md](docs/PRD.md) — ความต้องการของ MVP1
- [docs/DEV_PLAN.md](docs/DEV_PLAN.md) — สถานะแต่ละ slice, การตัดสินใจทั้งหมด, สิ่งที่ค้าง และขั้นถัดไป
- [docs/MANUAL_QA.md](docs/MANUAL_QA.md) — รายการตรวจในเบราว์เซอร์
- [CLAUDE.md](CLAUDE.md) — กติกาโค้ดและ workflow สำหรับคนหรือ AI ที่จะพัฒนาต่อ
