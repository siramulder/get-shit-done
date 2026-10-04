export const labels = {
  appTitle: 'จัดลำดับงาน',
  inputLabel: 'เพิ่มงานใหม่',
  addButton: 'เพิ่มงาน',
  todoHeading: 'งานที่ต้องทำ',
  doneHeading: 'เสร็จวันนี้',
  emptyNoTasks: 'ยังไม่มีงาน เริ่มเพิ่มงานแรกของคุณได้เลย',
  emptyAllDone: 'ทำครบทุกงานแล้ว',
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
}
