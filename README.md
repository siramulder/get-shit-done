# Task Priority App (MVP1)

เว็บแอปหน้าเดียวสำหรับจัดลำดับงานด้วยมือ:
- เพิ่มงานด้วยชื่อ
- เรียงลำดับด้วยการลากการ์ด หรือปุ่ม ↑ ↓ (ลากด้วยคีย์บอร์ดได้)
- ทำเสร็จ, ย้อนกลับ, ลบ
- ส่วน "เสร็จวันนี้"

ข้อมูลเก็บใน `localStorage` ของเบราว์เซอร์ ไม่มี backend และไม่มีบัญชีผู้ใช้

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
bash scripts/verify-phase2.sh           # ตรวจ scope, build, test และ dev server (อ่านอย่างเดียว)
```
เทสต์รันใน timezone `Asia/Bangkok` ซึ่งตั้งไว้ใน `vite.config.ts`

การลากวางในเบราว์เซอร์จริงต้องตรวจด้วยมือตาม [docs/MANUAL_QA.md](docs/MANUAL_QA.md) เพราะ jsdom ไม่มี layout

## โครงสร้าง
```
src/
  App.tsx        # ที่เดียวที่เรียก useTasks แล้วส่งค่าลงไปให้ component
  hooks/         # useTasks: state ของงานทั้งหมด + บันทึกอัตโนมัติ
  lib/           # storage.ts, date.ts, labels.ts (ข้อความ UI ทั้งหมด)
  components/    # UI ล้วน + ตัวช่วยลากวาง/focus
  types/         # Task
scripts/         # สคริปต์ตรวจแต่ละ phase
docs/            # PRD, dev plan, manual QA
```

## เอกสาร
- [docs/PRD.md](docs/PRD.md) — ความต้องการและขอบเขต MVP1
- [docs/DEV_PLAN.md](docs/DEV_PLAN.md) — สถานะแต่ละ phase, การตัดสินใจทั้งหมด, สิ่งที่ค้าง และขั้นถัดไป
- [docs/MANUAL_QA.md](docs/MANUAL_QA.md) — รายการตรวจในเบราว์เซอร์ M-01 ถึง M-14
- [CLAUDE.md](CLAUDE.md) — กติกาโค้ดและ workflow สำหรับคนหรือ AI ที่จะพัฒนาต่อ
