# DEV_PLAN — Task Priority App

อัปเดต: 2026-11-06 · สถานะ: MVP1 เสร็จแล้ว · v2 slice 0, slice 1 (+ visual direction R), hold กันกดซ้ำ, slice 2 (undo/redo) และ dark mode only deploy แล้ว · V2-17 (`3486359`), docs (`0a2adb7`) และ US-18 งานใหม่อยู่บนสุด (`8a8e1e8` + chore) ยังไม่ push · ถัดไป slice 3

เอกสารที่เกี่ยวข้อง: `docs/PRD.md` (MVP1), `docs/PRD-v2.md` (v2), `docs/MANUAL_QA.md`, `CLAUDE.md`

---

## สถานะปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| MVP1 Phase 0–3 | เสร็จ เทสต์อัตโนมัติผ่านทั้งหมด |
| MANUAL_QA ของ MVP1 | รอ PO กรอกคอลัมน์ "ผลที่ PO ตรวจ" · M-05 (โทรศัพท์) และ M-09 (VoiceOver) ตัดออกแล้ว |
| Deploy | GitHub Pages ผ่าน `.github/workflows/deploy.yml` ทุกครั้งที่ push `main` → https://siramulder.github.io/get-shit-done/ · **v2 slice 0 deploy แล้ว 2026-10-20** ที่ `c68af21` (workflow run 39388328699 สำเร็จ, bundle `index-qZ_3JNzS.js` ตรงกับ build ของ HEAD, ตรวจข้อความ newerVersion บนเว็บจริงแล้ว) · **visual direction R + slice 1 deploy แล้ว 2026-10-25** ที่ `0ee347a` (workflow run 40198547633 สำเร็จ, bundle `index-B2xILS-S.js` ตรงกับ build ของ HEAD) · **hold กันกดซ้ำ deploy แล้ว 2026-10-27** ที่ `7772f56` (workflow run 40530989649 สำเร็จ, bundle `index-Daf1G1xb.js` ตรงกับ build ของ HEAD) · **v2 slice 2 deploy แล้ว 2026-10-29** ที่ `96dd70c` (workflow run 40863667881 สำเร็จ, bundle `index-Bck1mbg2.js` ตรงกับ build ของ HEAD, ตรวจปุ่มเลิกทำ/ทำซ้ำในแถบหัวและ ⌘Z บนเว็บจริงแล้ว) · MVP1 ตัวสุดท้าย = tag `v1.0-mvp1` (`19ccfad`) |
| v2 | slice 0, slice 1, hold กันกดซ้ำ และ slice 2 (undo/redo) เสร็จและ deploy แล้ว (ดูสรุปด้านล่าง) · **dark mode only** (PO 2026-11-02) `e747fe7` style + `8ce8887` chore deploy แล้ว 2026-11-04 (workflow 41812662971) · `3486359` chore V2-17 ตรวจ CSS ที่ build — ยังไม่ push · **US-18 งานใหม่อยู่บนสุด** (PO 2026-11-05) `8a8e1e8` feat + chore verify-v2 — ยังไม่ push · ถัดไป slice 3 (deadline — ต้องแก้ `uncompleteTask` ทิ้ง `dueDate` พร้อม AC-12.5) · โหมดตรวจลำดับมี "เลิกทำ" ย้อนคำตอบทีละคู่แล้ว (US-9) |

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
| 0 | US-16 migration + ปลด scope guard + US-17 contrast placeholder | AC-16.1 ถึง 16.4, AC-17.1, S0-01 ถึง S0-10 (+S0-05b) | เสร็จ `f335a93` (docs), `878b6be` (feat), `ae0df0d` (fix), `c68af21` (chore) · deploy 2026-10-20 |
| 1 | US-6, 7, 8, 10 ตรวจลำดับ | AC-6.1, 6.2, 6.4, AC-7.1–7.6, AC-8.1, AC-10.1–10.3, AC-F1.1, F1.3, S1-01–S1-11 | เสร็จ `77b6bb5`, `d57b686` (R), `c901af9` (feat), `0ee347a` (chore) · deploy 2026-10-25 |
| 2 | US-15 + US-9 undo/redo | AC-15.1, 15.2, 15.3, 15.4, 15.5, 15.7, 15.8, 15.9, AC-9.1, 9.2, S2-01–S2-22 | เสร็จ `e594d98` (feat), `96dd70c` (chore) · deploy แล้ว 2026-10-29 · ดูสรุปด้านล่าง |
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
| `c68af21` | verify-v2.sh + verify-v2.selftest.sh + DEV_PLAN นี้ |

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

### Visual direction R + v2 slice 1 — สรุป (2026-10-25)

| Commit | เนื้อหา |
|---|---|
| `77b6bb5` | docs: add visual direction R to CLAUDE.md (+ token header-line) |
| `d57b686` | style: apply visual direction R — token ใน `src/index.css` (`@theme static`), Chakra Petch, header ดำ, ขอบ 2px, ไม่มีเงา · AC-17.1 ตรวจ `placeholder:text-muted` แทน class palette (ID คงเดิม) |
| `c901af9` | feat(v2): pairwise review mode — `src/lib/review.ts` (pure) + `ReviewMode` + ปุ่ม "ตรวจลำดับ" ใน App |
| `0ee347a` | chore: verify-v2 slice 1 checks and self-test (+ เอกสารนี้, MANUAL_QA M-17–M-21) |

- **contrast R (วัดใน browser pane):** ทุกคู่ที่ต้องผ่าน ≥ 4.5:1 ทั้งสองโหมด ต่ำสุด on-neon/hot 5.66 (ตารางเต็มใน MANUAL_QA)
- **เทสต์:** 256 ข้อ (เดิม 212 + slice 1 44) · ลองทำโค้ดพัง 5 แบบ: (ก) ไม่ swap → แดง 16 ข้อ รวม AC-7.2, 7.4, S1-02 · (ข) เริ่มคู่บนสุด → 26 ข้อ รวม AC-7.1, S1-01 · (ค) ไม่คืน focus → AC-6.4 ×3 · (ง) ซ่อนหน้าหลักด้วย CSS → AC-6.2, AC-10.1, AC-8.1 · (จ) การ์ดล่างคนละสี → S1-10 ×2
- **verify-v2:** `--slice 1` ตรวจสะสม 42 ID · V2-02 ครอบความบริสุทธิ์ของ `review.ts` · V2-14 ใหม่ (ไม่มี hex/palette ใน components + App — เลือกตรวจที่นี่แทน S1-V1) · self-test 15 กรณี (a–o)
- **browser pane:** M-17, M-18, M-19, M-20 (375×812 และ 1280×900 ทั้ง light/dark), M-02 ซ้ำ ผ่าน · M-21 VoiceOver ตัดออก (PO 2026-10-31)

**การตัดสินใจใน slice นี้ (PO ตอบระหว่างวางแผน):**
- header ในโหมดตรวจลำดับ = แถบดำ + ชื่อแอปเท่านั้น (ไม่ render ช่องเพิ่มงาน)
- focus หลังตอบ = คงที่การ์ดที่กด · หน้าสรุป → "อีกรอบ" · "อีกรอบ" → การ์ดบน
- Escape + focus trap ผูกที่ element นอกสุดของโหมด (`tabIndex=-1` ครอบ header + dialog) ไม่มี listener บน document จึงไม่ชน Escape ของการลากด้วยคีย์บอร์ด
- ปุ่ม "ตรวจลำดับ" disabled บอกเหตุผลด้วย `aria-describedby` · ไม่แสดงเมื่อเป็นข้อมูลเวอร์ชันใหม่กว่า
- ลาก = outline 2px ink แทนเงา, hover = `bg-ink/10`, newerVersion = surface + ขอบ ink
- ปุ่ม "ข้าม" = พื้น `header` (ดำคงที่) ตัวหนังสือ neon ทั้งสองโหมด (พื้น ink ใน dark เป็นสีขาว neon อ่านไม่ออก 1.09:1)
- focus ring ของช่องพิมพ์/ปุ่มเพิ่มงานในแถบ header = neon (ink มองไม่เห็นบนแถบดำ)

**สิ่งที่เจอระหว่างทาง:**
- Tailwind v4 ตัด token ที่ยังไม่มี class ใช้ (เช่น `hot`) → ต้องใช้ `@theme static`
- `min-h` ชนะ `max-h` ใน CSS → dialog สูง 740px ที่ 1280×900 ตอนแรก แก้เป็น `min-h-[min(calc(100dvh-10rem),44rem)]` ได้ 704px
- oxlint เตือน setState ใน effect (กฎ "todo < 2 ปิดโหมดเอง") → เปลี่ยนเป็นค่าที่คำนวณระหว่าง render
- shuffle รอบหนึ่ง fail 4 ข้อด้วยเวลา ~900 วินาที/ข้อ ขณะเครื่องพักระหว่างรันพร้อม self-test — รันซ้ำบนเครื่องว่าง (ดูผล gate สุดท้าย)

### แก้ pain point โหมดตรวจลำดับ — ค้างคู่ที่ตอบแล้ว 800 ms (2026-10-27)

PO พบว่าหลังตอบคู่หนึ่ง คู่ถัดไปมาที่ตำแหน่งเดิมทันที การแตะซ้ำจึงตอบคู่ใหม่โดยไม่ตั้งใจ

| Commit | เนื้อหา |
|---|---|
| `90c5167` | fix(v2): hold the answered pair before showing the next one — `ANSWER_HOLD_MS = 800` ใน `review.ts`, hold state ใน `ReviewMode` (✓ + opacity-50 + aria-disabled), เทสต์ S1-12–S1-15, MANUAL_QA M-22 |
| `7772f56` | chore: verify-v2 adds hold tests to slice 1 (+ CLAUDE.md, DEV_PLAN นี้) · push + deploy 2026-10-27 |

- **การตัดสินใจ (PO):** ค้างคู่เดิมพร้อมเครื่องหมาย (ไม่ใช่แค่ล็อกเงียบ ๆ) · 800 ms · "ข้าม" ก็ค้างเหมือนกัน · ปิด/Escape ใช้ได้เสมอและยกเลิก timer · การสลับใน state/localStorage ยังทันที (AC-7.2) · live region เงียบระหว่างค้าง แล้วประกาศคู่ใหม่ตามปกติ · focus อยู่การ์ดที่กดตลอด hold หน้าสรุป → "อีกรอบ" หลัง hold
- **เทสต์:** 265 ข้อ (+9) · แก้เทสต์เดิม ID คง: AC-10.2 (ReviewMode) แยก Enter/Space เป็นคนละเทสต์ เพราะกดสองครั้งติดกันตอนนี้ตั้งใจให้ครั้งที่สองไม่มีผล · S1-10 เพิ่ม assertion หลัง hold · เทสต์ App ที่ตอบหลายคู่ใช้ fake timers + settle 800 ms (assertion เดิมไม่เปลี่ยน)
- **ลองทำโค้ดพัง 4 แบบ:** (ก) ไม่เช็ก hold → S1-12, S1-13 ×2 แดง · (ข) hold = 0 → S1-12, S1-13 ×2, S1-14, S1-15 แดง · (ค) ใช้ `disabled` แทน aria-disabled → S1-12, S1-13, S1-14 แดง (S1-15 จับไม่ได้ เพราะ jsdom ไม่ blur ปุ่มที่ถูก disabled ต่างจากเบราว์เซอร์) · (ง) ไม่ clearTimeout ตอนปิด → S1-14 ×2 แดง หลังแก้ assertion ให้เช็ก timer ทันทีหลังปิด (รอบแรกจับไม่ได้เพราะเช็กหลัง unmount ซึ่ง cleanup ล้างให้อยู่แล้ว)
- **สิ่งที่เจอ:** @testing-library/react เดินนาฬิกาปลอมให้เฉพาะของ jest → user-event ค้างกับ fake timers ของ vitest แก้ด้วย `vi.stubGlobal('jest', …)` ใน `src/test/setup.ts` · fake `setImmediate` ทำให้ React ไม่ render (scheduler ใช้ setImmediate ใน Node) → fake เฉพาะ setTimeout/clearTimeout/Date · browser pane: ดับเบิลคลิกห่าง 4 ms และ Enter ×4 ใน 16 ms → สลับครั้งเดียวทั้งคู่ (M-22)

### v2 slice 2 — Undo/Redo (US-15) + ย้อนคำตอบในโหมดตรวจลำดับ (US-9) — สรุป (2026-10-29)

| Commit | เนื้อหา |
|---|---|
| `e594d98` | feat(v2): undo/redo history and review-answer undo — reducer `{ present, past, future, dirty }` ใน `useTasks`, `UndoControls`, listener เดียวที่ window ใน `App`, `reviewHistory` + `undo({ redoable: false })`, labels `undo`/`history`/`review.answer*`, MANUAL_QA M-23–M-28 |
| `96dd70c` | chore: verify-v2 slice 2 checks and self-test — SLICE_2 (32 ID), V2-15, self-test p/q, CLAUDE.md, DEV_PLAN นี้ · push + deploy 2026-10-29 (workflow run 40863667881 สำเร็จ, bundle `index-Bck1mbg2.js`) |

- **browser pane (dev server, light + dark ที่ 1280×900):** M-23 ✅ (⌘Z ×4 / ⇧⌘Z ×4 / Ctrl+Z / Ctrl+Y ย้อนและทำซ้ำถูกทุกขั้น) · M-24 ส่วนแอป ✅ แต่ native revert ในช่องพิมพ์ตรวจใน pane ไม่ได้ (คีย์สังเคราะห์ของ pane ไม่ทำ editing command ของ Chromium) → PO ลองบน localhost แล้ว ผ่าน (2026-10-29) · M-25 ✅ (ย้อน 3 คู่ทีละคู่ ตอบใหม่ ปิด แล้ว ⌘Z ย้อนเฉพาะการสลับที่ยังอยู่) · M-26 + M-02 ซ้ำ ✅ (⌘Z ขณะยกงานไม่ทำอะไร ลูกศร/Space/Escape ปกติ) · M-27 ✅ (เลิกทำระหว่าง hold คืนคู่ทันที ไม่มีคู่ถัดไปโผล่) · M-28 VoiceOver ตัดออก (PO 2026-10-31) · ปุ่มบนแถบหัว 40px neon/header 16.69:1 ทั้งสองโหมด disabled muted 7.85 (dark) / 2.62 (light, ยกเว้น) · console ไม่มี error
- **verify-v2:** `--pre-commit --slice 2` 17 ผ่าน (78 ID) · self-test **17/17** (a–q) รวม p (listener นอก App.tsx → V2-15) และ q (AC-15.1 หาย → V2-07) · โหมดปกติหลัง commit `96dd70c`: 18 ผ่าน 0 fail 0 ข้าม

- **AC ที่มีจริงใน PRD:** US-9 = AC-9.1, 9.2 · US-15 = AC-15.1, 15.2, 15.3, 15.4, 15.5, 15.7, 15.8, 15.9 (ไม่มี 15.6) · ไม่มี AC เรื่อง aria-live หลัง undo/redo → S2-10 ตามที่ PO อนุมัติ · AC-15.2 ครอบ 7 การกระทำที่มีตอนนี้ (6 mutator + สลับจากตรวจลำดับ) ส่วน "แก้ชื่อ/deadline" รอ slice 3–4
- **เทสต์:** 309 ข้อ (เดิม 265 + slice 2 44) · shuffle 3/3 · build · lint · verify-v2 `--pre-commit` 17/17 (78 ID) · เทสต์เดิมไม่ต้องแก้ assertion ข้อไหน (ReviewMode.test ได้ props ใหม่ใน helper เท่านั้น) · เพิ่ม AC-10.1 กรณี "เลิกทำ enabled" ใน ReviewMode.test
- **ลองทำโค้ดพัง 6 แบบ จับได้ทั้งหมด:** (ก) undo ของลบคืนงานต่อท้าย → AC-15.1, AC-15.2 · (ข) ไม่ล้าง future → AC-15.5 · (ค) เช็ก `e.key` แทน `e.code` → S2-06, S2-11, AC-9.1, AC-9.2 · (ง) ⌘Z ในโหมดเรียก undo ของงานตรง ๆ → AC-9.1 (⌘Z), S2-16 — S2-13 ไม่แดงเพราะใช้ปุ่ม ไม่ใช่คีย์ลัด · (จ) ไม่กัน aria-pressed → S2-08, S2-10 · (ฉ) guard บันทึกแบบเทียบ reference → S2-21, S2-22

**การตัดสินใจใน slice นี้ (PO):**
- 2026-10-27 (ใน prompt): snapshot ทั้งก้อนต่อการกระทำ ใน useReducer · ปุ่มในแถบหัวทั้งสองหน้า สไตล์ neon รอง · listener เดียวที่ window เป็นข้อยกเว้นของกฎ "ห้าม document listener" (ห้ามแตะ Escape, V2-15 คุม)
- 2026-10-28: เลิกทำในโหมด**ไม่สร้าง redo** (`undo({ redoable: false })`) ไม่งั้นตอบใหม่เป็น "บน/ข้าม" แล้ว "ทำซ้ำ" หลังปิดโหมดจะสลับคู่ที่ย้อนไปแล้ว · Tab order ในโหมด = การ์ดก่อน เลิกทำท้ายวง (trap ใช้ลำดับกำหนดเอง ไม่ใช่ DOM)
- 2026-10-28 (ตอนอนุมัติ): เลิกใช้ guard `tasks === initialTasks.current` → reducer เก็บ `dirty` ไม่งั้น undo กลับถึง snapshot แรกจะไม่บันทึก (S2-21/22 ล็อกไว้)
- `moveTask(id, direction, reason)` — reason param สำหรับ label "สลับลำดับ" จากโหมดตรวจลำดับ
- `preventDefault` เฉพาะเมื่อได้ย้อน/ทำซ้ำจริง · Ctrl+Y เท่านั้นที่เป็น redo (Meta+Y ไม่รับ) · ข้อความประกาศซ้ำติดกันอาจไม่ถูกอ่านซ้ำ (ไม่ใส่กลไกพิเศษ)

**สิ่งที่เจอระหว่างทาง:**
- ปิดฝาเครื่องขณะรันเทสต์: เครื่องหลับ Deep Idle และตื่นทุก 15 นาที (`pmset -g log`) → รันทั้งชุดใช้ 907 วิ โดย CPU 22 วิ และข้อที่ค้างตอนหลับถูกนับ timeout (คนละข้อทุกรอบ) · เปิดฝาแล้ว 309/309 ใน 4.9 วิ · ตัวกันหลับของแอปกันไม่ได้เมื่อปิดฝา
- oxlint `set-state-in-effect` ที่ `setHeld(null)` ใน effect ของ undoCount → เปลี่ยนเป็นเก็บ `undoCount` ไว้ใน hold แล้วคำนวณว่า hold ยังใช้ได้ไหม
- S2-02 เขียนผิดตอนแรก (`setup('A')` เพิ่ม A ผ่าน addTask จึงมี entry ติดมา) → seed แทน · S2-17 คาดคู่ผิด (รอบแรกสลับ C ขึ้นเหนือ B) · S2-20 regex จับ `outline-offset-2` เป็นสี → แก้เทสต์ทั้งสาม ไม่ใช่โค้ด
- live region ของ dnd-kit (`role=status`) อยู่ใน `<main>` ด้วย — เวลาอ่านประกาศของแอปต้องเลือก region ที่ไม่มี role

### Dark mode only — ไม่มี light mode — สรุป (2026-11-02)

| Commit | เนื้อหา |
|---|---|
| `e747fe7` | style: dark mode only — `src/index.css` เหลือ token ชุดเดียว (ค่าชุด dark เดิม) ตัด `@media (prefers-color-scheme: dark)`, `color-scheme: dark` · CLAUDE.md หัวข้อ Visual Direction เป็น "neon on black, dark only" ตาราง token คอลัมน์เดียว · PRD-v2 US-17/AC-17.1 และ AC-12.4 ถ้อยคำเป็น dark (ID คง) · คำบรรยายเทสต์ AC-17.1 แก้ให้ตรง (ID คง) · MANUAL_QA M-29 |
| `8ce8887` | chore: verify-v2 adds V2-16 dark-only check — V2-16: ไม่มี `prefers-color-scheme` และไม่มี `dark:` variant ใน src (รวม .css) · self-test เพิ่มกรณี r (media query ใน index.css) และ s (`dark:` ใน component) รวม 19 กรณี · DEV_PLAN |
| `3486359` | chore: verify-v2 adds V2-17 built-CSS dark-only check — หลัง build ตรวจ `dist/assets/*.css` ว่าไม่มี `prefers-color-scheme` และไม่มี utility ของ variant `dark` · self-test กรณี t (สตริงนั้นใน docs/DEV_PLAN.md นอก src) รวม 20 กรณี |
| docs: record dark-only deployment | DEV_PLAN (บันทึกนี้), MANUAL_QA M-29 บนเว็บจริง, ลบสตริงต้นเหตุใน DEV_PLAN |

- **ที่มา:** PO 2026-11-02 "dark mode only ไม่มี light mode" ตอบคำถาม: ใช้ค่าชุด dark ที่มีอยู่, ขอบเขต = โค้ด + เอกสาร + ตัวตรวจ
- **ผล:** 309/309, shuffle 3/3, build, lint, verify-v2 --pre-commit 18 ผ่าน 0 fail (V2-16 ใหม่) · browser pane M-29: จำลอง OS เป็น light แอปยังดำ ทุกคู่สี (ยกเว้น control disabled) ≥ 4.5:1 เท่าค่า dark เดิม ทั้ง 1280×900 และ 375×812 รวมโหมดตรวจลำดับ · CSS ที่ build ไม่มี `prefers-color-scheme`
- **สิ่งที่เจอ:** V2-16 จับคอมเมนต์ของตัวเองใน index.css ที่มีคำว่า prefers-color-scheme (พิสูจน์ว่าตัวตรวจทำงาน) → เปลี่ยนถ้อยคำ · Tailwind v4 สแกนทุกไฟล์ในโปรเจกต์ สตริง `dark` + `:text-ink` ที่เขียนติดกันตรง ๆ ใน self-test ทำให้บันเดิลมี utility นั้นพร้อม media query → self-test ประกอบสตริงตอนรันแทน (ห้ามเขียนติดกันที่ไหนในรีโป แม้ในเอกสาร — ดู V2-17)
- **ไม่เปลี่ยน:** โค้ด component ทุกตัว (ไม่มี `dark:` อยู่แล้ว), เทสต์ทุกข้อ (แก้แค่คำบรรยาย AC-17.1), token neon/on-neon/hot
- **Deploy (2026-11-04, PO สั่ง push):** push 4 commit (`e60a672`, `b58161c`, `e747fe7`, `8ce8887`) — ครั้งแรก GitHub ตอบ Internal Server Error (remote rejected) ครั้งที่สองผ่าน → workflow 41812662971 สำเร็จ → เว็บจริงได้ `index-CKFgJaml.js` / `index-Dxo9ufxp.css` เท่ากับ build ในเครื่องทุกไบต์ · browser pane บนเว็บจริง จำลอง OS light: พื้น rgb(10,10,10), `color-scheme` dark, h1 neon, console ว่าง
- **เจอหลัง deploy:** CSS บนเว็บจริงมี utility ของ variant `dark` (ชื่อ `text-ink`) ใต้ `@media (prefers-color-scheme: dark)` 1 rule — ไม่มี element ใช้ (0 ตัว) แอปยังดำ แต่ขัดกับที่ M-29 บันทึกว่า "0 แห่ง" (ตัวเลขนั้นวัดก่อนเขียน DEV_PLAN) ต้นเหตุคือบรรทัด "สิ่งที่เจอ" ด้านบนใน DEV_PLAN นี้เองที่เคยเขียนสตริง class นั้นติดกัน Tailwind จึงสแกนเจอ → แก้ถ้อยคำ + เพิ่ม **V2-17** ตรวจ `dist/assets/*.css` หลัง build ทุกครั้ง (`3486359`) build ใหม่ไม่มี media query (0 แห่ง) · ยังไม่ push — push แล้วเว็บจริงจะได้ CSS ที่ไม่มี rule ค้าง
- **ผลข้างเคียงกับเอกสารเก่า:** คอลัมน์ light ใน MANUAL_QA (ตาราง contrast R, M-14, M-15, M-20, M-22, M-23) และ "contrast light mode" ใน slice 0 เป็นประวัติ ไม่ต้องตรวจซ้ำ

### งานใหม่อยู่บนสุด (US-18) — สรุป (2026-11-05/06)

| Commit | เนื้อหา |
|---|---|
| `8a8e1e8` | feat(v2): insert new tasks at the top of the list — `addTask` แทรกงานใหม่ไว้หัว array และ renumber todo `order` 0..n-1 ด้วย `withTodoOrder` (↩ ยังต่อท้าย) · เทสต์ที่พึ่งลำดับเดิมแก้ทีละข้อ: useTasks.test.ts 22 ข้อ, App.test.tsx 36 ข้อ (ID คง คำบรรยายแก้ helper `setup`/`addTasks` ไม่แตะ) · ใหม่ AC-18.1/18.2/18.3 ทั้งระดับ hook และ App · PRD-v2 US-18 · CLAUDE.md กฎ Data Model · MANUAL_QA หมายเหตุ + M-30 |
| chore: verify-v2 adds US-18 ids to slice 2 and self-test case u | `SLICE_2` + AC-18.1–18.3 (V2-07 รวม 81 ID) · self-test กรณี u เปลี่ยนชื่อ AC-18.1 → V2-07 ต้อง FAIL รวม 21 กรณี · DEV_PLAN |

- **ที่มา:** PO 2026-11-05 "แก้ให้งานที่เพิ่มเข้ามาใหม่อยู่ลำดับบนสุดของ list" ตอบคำถาม: ↩ คงเดิมต่อท้าย · เทสต์แก้ทุกข้อทีละข้อ ไม่แตะ helper · สเปคเป็น US-18 + AC-18.x
- **ทำไม renumber ไม่ใช้ order ติดลบ:** reload แล้ว `normalizeTodoOrder` ต้องไม่เปลี่ยนเลข (AC-18.2 `toStrictEqual`) และ array ดิบใน localStorage ต้องอ่านเหมือนลิสต์ (S2-22, AC-15.9) · done คืน reference เดิม (AC-16.2)
- **เทสต์ที่ action เดิมกลายเป็น no-op** (↑ ของงานที่อยู่บนสุดแล้ว, ↓ ของงานล่างสุด, ↩ ของงานที่เดิมอยู่ท้ายอยู่แล้ว) เปลี่ยนเป้าให้ยังมีการกระทำจริง ไม่ปล่อยให้ผ่านแบบว่างเปล่า: P1-36, P1-44, P1-45, P1-48, P1-58, P1-59, P1-61, AC-15.2 (swap), S2-02, S2-05, P2-15, P2-17, P2-27, P3-01/02
- **ผล:** 315/315 (309 + AC-18 ×6), shuffle 3/3, build, lint, verify-v2 --pre-commit 19 ผ่าน 0 fail (V2-06 ID MVP1 ครบ 106, V2-07 81 ID)
- **ลองทำโค้ดพัง 7 แบบ จับได้ทั้งหมด:** (ก) คืนเป็นต่อท้าย → 60 ข้อแดง · (ข) หัว array แต่ order max+1 → 59 ข้อ · (ค) order = min−1 ไม่ renumber → **เฉพาะ AC-18.1/18.2/18.3** (พิสูจน์ว่า AC-18.x จำเป็น) · (ง) บนสุดในลิสต์แต่ต่อท้าย array → AC-18.1/18.2/18.3, AC-15.9, S2-22 · (จ) renumber done ด้วย → AC-16.2, AC-18.1/18.2, P1-61 · (ฉ) ↩ แทรกบนด้วย → P1-36, P1-61, S2-05, P2-17 · (ช) undo ไม่ถอดงานที่เพิ่ม → AC-18.3 + 19 ข้อของ slice 2
- **เอกสารเก่า:** ผล M-01, M-19, M-22, M-23, M-25, M-26, M-27 ใน MANUAL_QA บันทึกตอนงานใหม่ต่อท้าย เป็นประวัติ (มีหมายเหตุในไฟล์)
- เครื่องปิดฝาระหว่างรัน verify (AppleClamshellState = Yes) รอบ --pre-commit จึงเกิน 7 นาที ผลไม่กระทบ

### การตัดสินใจของ v2

- **ไม่ตรวจด้วย VoiceOver** (PO 2026-10-31): M-09, M-21, M-28 ตัดออกจากรายการตรวจเอง โค้ด a11y (aria-live, ชื่อปุ่ม, focus trap) ยังอยู่และล็อกด้วยเทสต์ตามเดิม
- **งานใหม่อยู่บนสุด** (PO 2026-11-05, US-18): `addTask` แทรกบนสุดและ renumber todo `order` 0..n-1 ด้วย `withTodoOrder` เหมือนหลังย้าย (ไม่ใช้ order ติดลบ) · ↩ ยังต่อท้าย · undo ของการลบยังคืนตำแหน่งเดิม · เทสต์ MVP1 ที่คาดลำดับเดิมแก้ค่าคาดหวังทีละข้อ ID คง helper `setup`/`addTasks` ไม่แตะ · AC-18.x เกาะ SLICE_2 ของ verify-v2
- **Dark mode only** (PO 2026-11-02): ไม่มี light mode แอปไม่ตาม `prefers-color-scheme` ของเครื่อง token ชุดเดียว = ค่าชุด dark เดิม · verify-v2 V2-16 กัน media query และ `dark:` variant ใน src · V2-17 ตรวจ CSS ที่ build จริง (Tailwind สแกนทุกไฟล์ในรีโป ห้ามเขียน class ของ variant `dark` ติดกันที่ไหนเลย แม้ในเอกสาร)
- **ไม่ตรวจบนโทรศัพท์** (PO 2026-10-31: ไม่ใช่งานบนโทรศัพท์): M-05 และส่วนแตะซ้ำบนโทรศัพท์ของ M-22 ตัดออกจากรายการตรวจเอง · layout 375px, ปุ่ม ≥ 40px และ touch-action คงไว้ตามเดิม ไม่เปลี่ยนโค้ด
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

- MANUAL_QA ของ MVP1: M-05 (โทรศัพท์) และ M-09 (VoiceOver) ตัดออกแล้ว · M-14 (รอบ AC-17.1), M-15, M-16 รอ PO ยืนยัน
- M-16 ผ่านบนเครื่องจริงของ PO แล้ว (2026-10-20) → push และ deploy slice 0 แล้ว
- M-22 (hold) ผ่านใน browser pane · ไม่ตรวจบนโทรศัพท์ (PO 2026-10-31)
- ปุ่ม ↑↓ disabled 1.73:1 (dark only ตั้งแต่ 2026-11-02) — WCAG ยกเว้น control ที่ disabled จดไว้ไม่แก้
- `README.md` ยังเป็นเนื้อหา MVP1 และชี้ไป verify-phase2.sh
- slice 3: `uncompleteTask` ทิ้ง `dueDate` ต้องแก้พร้อม AC-12.5 · ป้าย deadline บนการ์ดตรวจลำดับ (AC-6.3)
- slice 2 push ตามคำสั่ง PO 2026-10-29 (M-24 PO ลองบน localhost แล้ว ผ่าน)
- dark mode only deploy แล้ว 2026-11-04 (workflow 41812662971) · chore `3486359` (V2-17) + docs `0a2adb7` ยังไม่ push รอ PO สั่ง (push แล้ว CSS บนเว็บจริงจะไม่มี rule ของ variant `dark` ค้าง)
- US-18 งานใหม่อยู่บนสุด `8a8e1e8` feat + chore verify-v2 ยังไม่ push รอ PO สั่ง · M-30 ใน browser pane ดู MANUAL_QA
- "เสร็จวันนี้" ไม่อัปเดตข้ามเที่ยงคืนขณะเปิดค้าง ยกไป v2.1
- Export/Import JSON ตัดออกจาก v2 เพื่อรักษาขนาด เป็น P1 ถัดไป (`Store` มี `schemaVersion` รองรับแล้ว)

## ความเสี่ยงการ deploy (มีผลตั้งแต่ slice 0 ขึ้น main เมื่อ 2026-10-20)

- จุดอ้างอิง: **tag `v1.0-mvp1` = `19ccfad`** คือ MVP1 ตัวสุดท้ายที่อ่าน localStorage แบบ `Task[]` ล้วน ทุก commit หลังจากนี้เขียน Store v2
- push `main` = deploy ทันที ผู้ใช้ MVP1 ทุกคน (รวม PO) ได้ v2 และ localStorage ของเขาถูกเขียนเป็น Store v2 **เมื่อกดอะไรครั้งแรก** (ก่อนหน้านั้นยังเป็น array เดิม)
- **ห้าม rollback deploy กลับไป `v1.0-mvp1` หรือ commit ก่อนหน้า:** MVP1 อ่าน Store v2 ไม่ออก (ไม่ใช่ array → ตีเป็นข้อมูลเสีย) จะแสดงลิสต์ว่าง และถ้าผู้ใช้เพิ่มงานใน MVP1 ต่อ ข้อมูล v2 จะเหลืออยู่แค่ใน key backup — ให้ **fix forward เท่านั้น** (แก้บน v2 แล้ว push ใหม่)
- **ขั้นตอนกู้ข้อมูลถ้าเกิดขึ้นแล้ว** (ทำในเบราว์เซอร์ของผู้ใช้ก่อนที่จะมีการโหลดข้อมูลเสียชุดใหม่มาทับ backup):
  1. เปิด DevTools → Console บนหน้าแอป
  2. ดูว่ามี backup: `localStorage.getItem('task-priority-app:tasks:corrupt-backup')` — ต้องขึ้นต้นด้วย `{"schemaVersion":2`
  3. คัดลอกเก็บไว้ก่อน: `copy(localStorage.getItem('task-priority-app:tasks:corrupt-backup'))` แล้ววางลงไฟล์
  4. ตรวจว่าแอปที่เปิดอยู่เป็น v2 (มีข้อความ "เวอร์ชันใหม่กว่า" หรือ `<title>` ตรงกับ build v2) แล้วคืนค่า: `localStorage.setItem('task-priority-app:tasks', localStorage.getItem('task-priority-app:tasks:corrupt-backup'))` และ reload
  5. ข้อจำกัด: backup มีชุดเดียว (ชุดล่าสุดที่ถูกตีว่าเสีย) ถ้าถูกเขียนทับไปแล้วกู้ไม่ได้

## ที่จอดไอเดียหลัง v2

เปรียบเทียบตอนเพิ่มงาน (binary insertion ใช้ตรรกะ "ผู้ชนะ" ชุดเดียวกับ slice 1), ชวนตรวจลำดับตอนเปิดแอปครั้งแรกของวัน (ต้องเก็บ "วันที่ตรวจล่าสุด" ใน Store), เรียงตาม deadline, Undo ข้าม reload (ต้อง persist history ซึ่งตัดสินใจว่าไม่ทำ)
