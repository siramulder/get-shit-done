export const labels = {
  appTitle: 'จัดลำดับงาน',
  inputLabel: 'เพิ่มงานใหม่',
  addButton: 'เพิ่มงาน',
  todoHeading: 'งานที่ต้องทำ',
  doneHeading: 'เสร็จวันนี้',
  emptyNoTasks: 'ยังไม่มีงาน เริ่มเพิ่มงานแรกของคุณได้เลย',
  emptyAllDone: 'ทำครบทุกงานแล้ว',
  newerVersion: 'ข้อมูลในเครื่องนี้มาจากแอปเวอร์ชันใหม่กว่า จึงยังเพิ่มหรือแก้งานไม่ได้ ข้อมูลเดิมไม่ถูกแตะต้อง',
  moveUp: (title: string) => `เลื่อนขึ้น: ${title}`,
  moveDown: (title: string) => `เลื่อนลง: ${title}`,
  complete: (title: string) => `ทำเสร็จ: ${title}`,
  remove: (title: string) => `ลบงาน: ${title}`,
  uncomplete: (title: string) => `ย้อนกลับ: ${title}`,
  dragHandle: (title: string) => `ลากเพื่อจัดลำดับ: ${title}`,
  dnd: {
    roleDescription: 'งานที่จัดลำดับได้',
    instructions:
      'กด Space หรือ Enter เพื่อหยิบงาน ใช้ลูกศรขึ้นลงเพื่อย้าย กด Space หรือ Enter อีกครั้งเพื่อวาง หรือกด Escape เพื่อยกเลิก',
    picked: (title: string, position: number, total: number) =>
      `หยิบ "${title}" แล้ว ตำแหน่ง ${position} จาก ${total}`,
    over: (title: string, position: number, total: number) =>
      `"${title}" อยู่ที่ตำแหน่ง ${position} จาก ${total}`,
    dropped: (title: string, position: number, total: number) =>
      `วาง "${title}" ที่ตำแหน่ง ${position} จาก ${total}`,
    cancelled: (title: string) => `ยกเลิกการย้าย "${title}"`,
  },
  review: {
    button: 'ตรวจลำดับ',
    needTwo: 'ต้องมีงานอย่างน้อย 2 ชิ้นจึงจะตรวจลำดับได้',
    question: 'อันไหนทำก่อน?',
    upper: 'บน',
    lower: 'ล่าง',
    counter: (k: number, total: number) => `คำถาม ${k} จาก ${total}`,
    skip: 'ข้าม',
    close: 'ปิด',
    again: 'อีกรอบ',
    doneTitle: 'ตรวจลำดับครบแล้ว',
    topTask: (title: string) => `งานบนสุดตอนนี้: ${title}`,
    announcePair: (upper: string, lower: string, k: number, total: number) =>
      `อันไหนทำก่อน? บน: ${upper} ล่าง: ${lower} คำถาม ${k} จาก ${total}`,
    announceDone: (title: string) => `ตรวจลำดับครบแล้ว งานบนสุดตอนนี้: ${title}`,
    answerUpper: (title: string) => `เลือก "${title}" ไว้บน`,
    answerSkip: (upper: string, lower: string) => `ข้ามคู่ "${upper}" กับ "${lower}"`,
    announceUndo: (label: string, upper: string, lower: string, k: number, total: number) =>
      `เลิกทำ: ${label} อันไหนทำก่อน? บน: ${upper} ล่าง: ${lower} คำถาม ${k} จาก ${total}`,
  },
  undo: {
    undo: 'เลิกทำ',
    redo: 'ทำซ้ำ',
    nothingToUndo: 'ไม่มีอะไรให้เลิกทำ',
    nothingToRedo: 'ไม่มีอะไรให้ทำซ้ำ',
    undone: (label: string) => `เลิกทำ: ${label}`,
    redone: (label: string) => `ทำซ้ำ: ${label}`,
  },
  history: {
    add: (title: string) => `เพิ่มงาน "${title}"`,
    remove: (title: string) => `ลบงาน "${title}"`,
    complete: (title: string) => `ทำเสร็จ "${title}"`,
    uncomplete: (title: string) => `ย้อนกลับ "${title}"`,
    move: (title: string) => `เลื่อนลำดับ "${title}"`,
    swap: (title: string) => `สลับลำดับ "${title}"`,
  },
}
