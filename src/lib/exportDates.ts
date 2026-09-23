export type ExportPreset = 'last7' | 'last30' | 'custom'

export type ExportDateRange = {
  startDate: string
  endDate: string
  timeZone: string
  start: Date
  end: Date
}

export const EXPORT_MAX_DAYS = 366

function pad(value: number) { return String(value).padStart(2, '0') }

export function dateKey(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }

export function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function addCalendarDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function inclusiveDayCount(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.floor((endUtc - startUtc) / 86400000) + 1
}

export function resolveExportDates(startDate: string, endDate: string, now = new Date()): { range?: ExportDateRange; error?: string } {
  const start = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  if (!start || !end) return { error: 'Enter valid start and end dates.' }
  if (end < start) return { error: 'The end date must be on or after the start date.' }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (end > today) return { error: 'The end date cannot be in the future.' }
  if (inclusiveDayCount(start, end) > EXPORT_MAX_DAYS) return { error: `Choose a range of ${EXPORT_MAX_DAYS} days or fewer.` }
  return { range: { startDate, endDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', start: new Date(start), end: addCalendarDays(end, 1) } }
}

export function presetDates(preset: ExportPreset, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = preset === 'last7' ? 6 : 29
  const start = addCalendarDays(today, -days)
  return { startDate: dateKey(start), endDate: dateKey(today) }
}

export function formatDateKey(value: string) {
  const date = parseDateKey(value)
  return date?.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) ?? value
}
