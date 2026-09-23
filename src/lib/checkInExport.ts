import type { EmotionId, Student } from '../types'

export type ExportCheckIn = {
  id: string
  studentId: string
  firstName: string
  lastName: string
  active: boolean
  classroomName: string
  createdAt: string
  emotion: EmotionId
}

const headers = ['Check-in ID', 'Student ID', 'Student first name', 'Student last name', 'Current student status', 'Classroom name', 'Check-in date and time', 'Time zone', 'Check-in timestamp in UTC', 'Emotion']

function safeCell(value: string) {
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function serializeCheckInsCsv(rows: ExportCheckIn[], timeZone: string) {
  const formatter = new Intl.DateTimeFormat([], { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const lines = [headers, ...rows.map(row => [row.id, row.studentId, row.firstName, row.lastName, row.active ? 'active' : 'inactive', row.classroomName, formatter.format(new Date(row.createdAt)), timeZone, row.createdAt, row.emotion])]
  return '\uFEFF' + lines.map(line => line.map(value => safeCell(String(value))).join(',')).join('\r\n') + '\r\n'
}

export function exportFilename(startDate: string, endDate: string) { return `pip-checkins_${startDate}_to_${endDate}.csv` }

export function selectedStudentIds(students: Student[], includeInactive: boolean) {
  return students.filter(student => student.active || includeInactive).map(student => student.id)
}
