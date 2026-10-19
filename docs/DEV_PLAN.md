# DEV_PLAN — Task Priority App

อัปเดต: 2026-10-19 · สถานะ: MVP1 เสร็จแล้ว · v2 slice 0 เสร็จ (commit แล้ว ยังไม่ push)

เอกสารที่เกี่ยวข้อง: `docs/PRD.md` (MVP1), `docs/PRD-v2.md` (v2), `docs/MANUAL_QA.md`, `CLAUDE.md`

---

## สถานะปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| MVP1 Phase 0–3 | เสร็จ เทสต์อัตโนมัติผ่านทั้งหมด |
| MANUAL_QA ของ MVP1 | รอ PO กรอกคอลัมน์ "ผลที่ PO ตรวจ" โดยเฉพาะ M-05 (สัมผัสบนเครื่องจริง) และ M-09 (VoiceOver) |
| Deploy | GitHub Pages ผ่าน `.github/workflows/deploy.yml` ทุกครั้งที่ push `main` → https://siramulder.github.io/get-shit-done/ ตอนนี้ยังเป็น MVP1 (`19ccfad`) เพราะ slice 0 ยังไม่ได้ push — อ่าน "ความเสี่ยงการ deploy" ก่อน push |
| v2 | slice 0 เสร็จและ commit แล้ว (ดูสรุปด้านล่าง) slice 1 ยังไม่เริ่ม |

MVP1 ถือว่าปิดเมื่อ MANUAL_QA ครบ การเริ่ม v2 slice 0 ไม่ต้องรอข้อนั้น เพราะ slice 0 ไม่แตะ UI ที่ค้างตรวจ

---

## MVP1 — สรุปที่ทำไปแล้ว

| Phase | เนื้อหา | Commit สำคัญ |
|---|---|---|
| 0 | Scaffold Vite + React 18 + TS strict + Tailwind v4 + Vitest, verify-phase0.sh | `chore: scaffold Task Priority App`, `3279f1d` |
| 1 | Task type, storage + validation + backup, date.ts, useTasks | `ff68515` |
| 2 | labels.ts, EmptyState, TaskInput, TaskItem, TaskList, DoneSection, App | `77e4f73`, `7a10d44`, `1acbf1f`, `3c10713`, `147c0cf` |
| 2.1 | ลากการ์ดได้ทุกจุด + CardPointerSensor (P2-38 → P2-50) | `40152e3`, `4d41fd5` |
| 3 | QA ในเบราว์เซอร์, เอกสาร, light mode | ดูประวัติ git |

### การตัดสินใจของ MVP1 ที่ยังมีผลใน v2

- **ข้อมูลเสียหาย:** เก็บงานที่ดี ทิ้งเฉพาะชิ้นที่เสีย และสำรอง string ดิบไว้ที่ `task-priority-app:tasks:corrupt-backup` (ทับของเก่า) ถ้าไม่ทิ้งอะไรเลยไม่เขียน backup
- **ไม่เขียน localStorage ตอน mount** ข้อมูลที่ทำความสะอาดแล้วถูกเขียนเมื่อผู้ใช้สั่งงานครั้งแรก
- **Timezone ของเทสต์:** `TZ=Asia/Bangkok` ผ่าน `test.env` ใน vite.config.ts พิสูจน์แล้วว่าชนะค่าของเครื่อง
- **"เสร็จวันนี้"** เรียงใหม่สุดอยู่บน และไม่อัปเดตเองเมื่อเปิดแอปค้างข้ามเที่ยงคืน (ยอมรับเป็นข้อจำกัด)
- **Empty state 2 แบบ:** ไม่มีงานเลย กับ ทำครบทุกงานแล้ว
- **ลากการ์ด:** listeners อยู่ที่ `<li>` + CardPointerSensor กันปุ่ม, attributes กับ activator อยู่ที่ ⠿, ไม่รองรับลากด้วยนิ้ว
- **ลบทันที** ไม่มี confirm dialog
- **ข้อความ UI อยู่ใน labels.ts ที่เดียว** component ไม่มีตัวอักษรไทย

### สิ่งที่เทสต์อัตโนมัติไม่ครอบคลุม (ต้องตรวจเองทุกครั้งที่แก้ส่วน drag หรือ review mode)

jsdom ไม่มี layout จึงพิสูจน์ไม่ได้: การลากด้วยเมาส์, การจัดลำดับด้วยคีย์บอร์ดของ dnd-kit, การกดปุ่มแล้วไม่เริ่มลากโดยไม่ตั้งใจ, หน้าตาบนจอเล็ก, contrast จริงบนหน้าจอ ทั้งหมดอยู่ใน `docs/MANUAL_QA.md`

---

## v2 — แผน slice

หลักการ: **ทุกเช้า ตัดสินใจทีละคู่ โดยแอปให้ข้อมูล ไม่ตัดสินแทน**
แต่ละ slice ใช้งานได้จริงทันทีเมื่อ AC ผ่าน รายละเอียด AC อยู่ใน `docs/PRD-v2.md`

| Slice | Story | AC | สถานะ |
|---|---|---|---|
| 0 | US-16 migration + ปลด scope guard + US-17 contrast placeholder | AC-16.1 ถึง 16.4, AC-17.1, S0-01 ถึง S0-10 (+S0-05b) | เสร็จ `f335a93` (docs), `878b6be` (feat), `ae0df0d` (fix), chore verify-v2 (commit ถัดไป) |
| 1 | US-6, 7, 8, 10 ตรวจลำดับ | AC-6.1, 6.2, 6.4, AC-7.x, AC-8.1, AC-10.x, AC-F1.1, F1.3 | ยังไม่เริ่ม |
| 2 | US-15 + US-9 undo/redo | AC-15.x, AC-9.1, 9.2 | ยังไม่เริ่ม |
| 3 | US-11, 12, 13 deadline | AC-11.x, AC-12.x, AC-13.x และ AC-6.3 | ยังไม่เริ่ม |
| 4 | US-14 แก้ชื่อ inline | AC-14.x | ยังไม่เริ่ม |
| 5 | QA + ทดสอบผู้ใช้ + migration จริง + เอกสาร | G1 ถึง G4 | ยังไม่เริ่ม |

**ข้อแลกเปลี่ยนที่รู้ตัว:** build หลัง slice 1 ยังไม่มี undo ตอบผิดต้องแก้ด้วยปุ่ม ↑↓ ยอมรับได้เพราะเป้าหมายของ slice 1 คือพิสูจน์ว่า PO ใช้จริงทุกเช้าไหม ถ้าต้องการความปลอดภัยก่อน สลับ slice 1 กับ 2 ได้โดยไม่กระทบ slice อื่น

### v2 slice 0 — สรุปที่ทำไปแล้ว (2026-10-19)

| Commit | เนื้อหา |
|---|---|
| `f335a93` | docs: PRD-v2 (รวม US-17/AC-17.1 ที่เพิ่มใน slice นี้), CLAUDE.md v2, DEV_PLAN v2, ลบ docs/CLAUDE.md ที่ซ้ำ |
| `878b6be` | feat(v2): Store v2 + migration + dueDate validation + สถานะ "เวอร์ชันใหม่กว่า" + เทสต์ AC-16.x / S0-xx + MANUAL_QA M-15, M-16 |
| `ae0df0d` | fix(v2): placeholder light mode gray-500 (4.84:1) + เทสต์ AC-17.1 + MANUAL_QA M-14 |
| chore | verify-v2.sh + verify-v2.selftest.sh + DEV_PLAN นี้ |

- **เทสต์:** 212 ข้อ (MVP1 เดิม 160 + ใหม่ 52) ผ่านครบ shuffle ×3 build lint ผ่าน · ID เทสต์ MVP1 ทั้ง 106 ตัวยังอยู่ (V2-06)
- **รีวิวอิสระหลัง commit (3 มุมมอง + ลองหักล้าง):** ไม่พบการละเมิดกฎ 1–8 · เจอเทสต์ที่ยังอ่อน 3 จุดและแก้แล้ว (รวมเข้า commit feat/fix ด้วย autosquash ก่อน push): S0-02 ยอมรับ dueDate ทั้งใน array MVP1 และ Store v2 (ทั้ง todo และ done), S0-04 ตรวจกฎรายชิ้นใน Store v2 ด้วย (status ผิด + id ซ้ำ), กฎ "ไม่เขียนตอนเปิด" พิสูจน์ด้วย spy `setItem` ไม่ใช่แค่เทียบค่า (AC-16.1, AC-16.2, AC-16.4, เทสต์ mount) · S0-10 ให้งาน C มี dueDate ที่ทุก mutation ต้องรักษาไว้ · App S0-01 ยืนยันว่ายังไม่มี UI deadline · self-test กรณี l ตรวจจากบรรทัดหลักฐานเท่านั้น (คำว่า loadTasks อยู่ในหัวข้อ FAIL อยู่แล้ว) · พิสูจน์ด้วย mutant 2 ตัวที่เทสต์เดิมจับไม่ได้: effect ตอน mount ที่เขียน byte เดิมกลับ → ตอนนี้ fail 4 ข้อ / toTask รับ dueDate เฉพาะใน Store v2 → ตอนนี้ fail 4 ข้อ
- **เทสต์ MVP1 ที่แก้ (ID คงเดิม):** P1-01 type ที่คาดเพิ่ม `dueDate?` และคำบรรยายต่อท้าย "and optional dueDate" / P1-03 คาด `{ schemaVersion: 2, tasks }` แทน array / helper `stored()` ใน useTasks.test อ่าน `.tasks` (กระทบ P1-31, 36, 55, 58 โดย assertion ไม่เปลี่ยน) — เหตุผลทั้งหมดคือข้อ 7 / AC-16.2 / PRD-v2 ข้อ 6
- **ลองทำโค้ดพังโดยตั้งใจ 4 แบบ เทสต์จับได้:** เอา guard ใน `update()` ออก → AC-16.4 fail / saveTasks เขียน array → 10 ข้อ fail (P1-03, P1-31, 36, 55, 58, AC-16.2, S0-01, S0-10 ×2, เทสต์ mount) / isCalendarDate รับทุก YYYY-MM-DD → S0-02 fail 6 ข้อ / ขยาย `schemaVersion` เป็น `number` → tsc fail ที่ S0-09 (TS2344 + TS2578) · หมายเหตุ: เอาเฉพาะ guard ใน effect บันทึกออก เทสต์ยังเขียว เพราะ guard ใน `update()` เป็นชั้นหลัก (ชั้น effect เป็นเบลต์เสริม)
- **verify-v2.sh:** --pre-commit 15 ผ่าน 1 SKIP · self-test 12/12 (กรณี a–l จับได้ที่ข้อที่คาดทุกกรณี positive control 10/10 ก่อน)
- **browser pane (dev server):** M-15 ✅ (ข้อความ dark 13.47:1 / light 8.73:1, ช่องและปุ่ม disabled, พิมพ์/คลิกแล้ว raw ไม่เปลี่ยน) · M-16 ✅ (payload MVP1 จริงโหลดครบ ลำดับเดิม → กด ↓ → Store v2 ครบ 4 งาน → reload ยังครบ) · M-14 placeholder light 4.84:1 / dark 6.82:1
- **payload จริงของ AC-16.1** คัดลอกจาก https://siramulder.github.io/get-shit-done/ (= BASE) หลังเพิ่ม 4 งานและทำเสร็จงานที่ 2 ผ่าน UI จึงมีช่องว่างใน order (0, 2, 3) เหมือนข้อมูลผู้ใช้จริง

**การตัดสินใจใน slice 0:**
- Store v2 ที่มี key เกินระดับบน → เก็บงาน ทิ้ง key เขียน backup (S0-05b) เหมือนกฎ field เกินระดับงานของ MVP1
- กฎ dueDate ใช้เหมือนกันทุก container: array MVP1 ที่มี dueDate ถูกต้อง (เกิดได้แค่แก้ข้อมูลเอง) เก็บไว้ ไม่ backup
- ปี 0000–0999 ผ่าน regex และเป็นวันที่จริงตาม ISO → ยอมรับ ไม่เพิ่มกฎ
- `loadTasks()` คงไว้เพื่อเทสต์เท่านั้น โค้ดจริงใช้ `loadStore()` — V2-02 บังคับ
- UI ตอน "เวอร์ชันใหม่กว่า": ข้อความ `role="status"` แทน EmptyState ใต้หัวข้อ "งานที่ต้องทำ" ส่วน "เสร็จวันนี้" ไม่แสดง
- mutator ทั้ง 6 ผ่าน `update()` ตัวเดียวที่ no-op เมื่อเป็นเวอร์ชันใหม่กว่า — slice 2 (undo) ควรเกาะจุดนี้
- ชื่อเทสต์ MVP1 แก้คำบรรยายให้ตรงความจริงได้ แต่ ID ต้องอยู่ที่เดิม (กติกาที่ PO ยืนยัน 2026-10-19)

**สิ่งที่เจอระหว่างทาง (ยกไป slice ถัดไป):**
- `uncompleteTask` (useTasks.ts) สร้าง task ใหม่จาก field ที่ระบุชื่อตายตัว → งาน done ที่มี dueDate กด ↩ แล้ว dueDate หาย **slice 3 ต้องแก้พร้อมเทสต์ AC-12.5** (ใน slice 0 ยังไม่มีทางได้ dueDate นอกจากแก้ข้อมูลเอง S0-03 จึงพิสูจน์แค่ระดับโหลด)
- `README.md` ยังเขียนว่า MVP1 และชี้ไป verify-phase2.sh — ไม่อยู่ในขอบเขต slice 0
- ปุ่ม ↑↓ disabled ใน light mode 1.71:1 ยังจดไว้ไม่แก้ (WCAG ยกเว้น control ที่ disabled) · placeholder ของช่องที่ disabled ตอน "เวอร์ชันใหม่กว่า" light ≈ 2.6:1 หลังแก้ gray-500 แล้วลด opacity 0.6

### การตัดสินใจของ v2

- **Deadline เป็นป้ายอย่างเดียว** ไม่เรียงลำดับ ไม่เลื่อนงานขึ้นเอง ไม่สะกิด
- **ตรวจลำดับไล่จากคู่ล่างสุดขึ้นบน** n-1 คำถาม ทุกคำตอบมีผลทันที ข้ามได้ ออกได้ทุกเมื่อ ไม่มีหน้ายืนยัน
- **Undo ครอบคลุมทุกการกระทำ** ไม่ใช่เฉพาะการลบ เก็บ 50 ขั้น อยู่แค่ใน session
- **Undo ของการลบคืนงานกลับตำแหน่งเดิม** (ต่างจาก "ย้อนกลับ" งาน done ที่ไปต่อท้าย)
- **แถวใน "เสร็จวันนี้" ไม่แสดงป้าย deadline และแก้ชื่อไม่ได้**
- **ไฟล์ Phase 1 ของ MVP1 ไม่ถูก freeze อีกต่อไป** แก้ได้ แต่เทสต์ P1-xx ต้องยังผ่าน
- **verify-phase0.sh และ verify-phase2.sh เป็น snapshot ที่ปลดระวางแล้ว** verify-phase2 จะ fail โดยตั้งใจเพราะ P2-43 grep คำว่า deadline สร้าง `scripts/verify-v2.sh` ใหม่ใน slice 0

### คำถามเปิดของ v2

| # | คำถาม | บล็อก |
|---|---|---|
| Q1 | ตัวเลือกวันที่: ใช้ `<input type="date">` หรือทำเอง | บล็อก slice 3 |
| Q2 | คีย์ลัดเลือกการ์ดในโหมดตรวจลำดับ (↑/↓) นอกจาก Tab+Enter | ไม่บล็อก |
| Q3 | เพิ่ม Playwright สำหรับ E2E ของ drag และ review mode หรือไม่ | ตอบก่อน slice 5 |
| Q4 | รูปแบบวันที่สั้น ใช้ พ.ศ. ตาม th-TH หรือ ค.ศ. | ไม่บล็อก (ค่าเริ่มต้น th-TH) |

---

## ค้างอยู่ / จดไว้ไม่แก้

- MANUAL_QA ของ MVP1 ยังรอ PO กรอก M-05 และ M-09 · M-14 (รอบ AC-17.1), M-15, M-16 รอ PO ยืนยัน
- slice 0 ยังไม่ได้ push — push เมื่อ PO สั่ง และอ่าน "ความเสี่ยงการ deploy" ก่อน
- "เสร็จวันนี้" ไม่อัปเดตข้ามเที่ยงคืนขณะเปิดค้าง ยกไป v2.1
- Export/Import JSON ตัดออกจาก v2 เพื่อรักษาขนาด เป็น P1 ถัดไป (`Store` มี `schemaVersion` รองรับแล้ว)

## ความเสี่ยงการ deploy (อ่านก่อน push slice 0 ขึ้น main)

- push `main` = deploy ทันที ผู้ใช้ MVP1 ทุกคน (รวม PO) จะได้ v2 และ localStorage ของเขาจะถูกเขียนเป็น Store v2 **เมื่อกดอะไรครั้งแรก** (ก่อนหน้านั้นยังเป็น array เดิม)
- **ห้าม rollback deploy กลับไป MVP1 หลังจากนั้น:** MVP1 อ่าน Store v2 ไม่ออก (ไม่ใช่ array → ตีเป็นข้อมูลเสีย) จะแสดงลิสต์ว่าง และถ้าผู้ใช้เพิ่มงานใน MVP1 ต่อ ข้อมูล v2 จะเหลืออยู่แค่ใน key backup — ให้ **fix forward เท่านั้น** (แก้บน v2 แล้ว push ใหม่)
- **ขั้นตอนกู้ข้อมูลถ้าเกิดขึ้นแล้ว** (ทำในเบราว์เซอร์ของผู้ใช้ก่อนที่จะมีการโหลดข้อมูลเสียชุดใหม่มาทับ backup):
  1. เปิด DevTools → Console บนหน้าแอป
  2. ดูว่ามี backup: `localStorage.getItem('task-priority-app:tasks:corrupt-backup')` — ต้องขึ้นต้นด้วย `{"schemaVersion":2`
  3. คัดลอกเก็บไว้ก่อน: `copy(localStorage.getItem('task-priority-app:tasks:corrupt-backup'))` แล้ววางลงไฟล์
  4. ตรวจว่าแอปที่เปิดอยู่เป็น v2 (มีข้อความ "เวอร์ชันใหม่กว่า" หรือ `<title>` ตรงกับ build v2) แล้วคืนค่า: `localStorage.setItem('task-priority-app:tasks', localStorage.getItem('task-priority-app:tasks:corrupt-backup'))` และ reload
  5. ข้อจำกัด: backup มีชุดเดียว (ชุดล่าสุดที่ถูกตีว่าเสีย) ถ้าถูกเขียนทับไปแล้วกู้ไม่ได้

## ที่จอดไอเดียหลัง v2

เปรียบเทียบตอนเพิ่มงาน (binary insertion ใช้ตรรกะ "ผู้ชนะ" ชุดเดียวกับ slice 1), ชวนตรวจลำดับตอนเปิดแอปครั้งแรกของวัน (ต้องเก็บ "วันที่ตรวจล่าสุด" ใน Store), เรียงตาม deadline, Undo ข้าม reload (ต้อง persist history ซึ่งตัดสินใจว่าไม่ทำ)
