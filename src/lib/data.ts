import { emotions } from '../data/emotions'
import { students as mockStudents } from '../data/students'
import { mockCheckIns } from '../data/mockCheckIns'
import { supabase, getSupabaseErrorMessage } from './supabase'
import type { CheckIn, Classroom, EmotionId, Student, TeacherResponse, ResponseType } from '../types'
import type { ExportCheckIn } from './checkInExport'
import { withKioskNames, badgeColor } from './names'

function todayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

type StudentRow = { id: string; first_name: string; last_name?: string | null; active?: boolean }
const STUDENT_COLUMNS = 'id, first_name, last_name, active'

/** Rows carry no kiosk label yet; withKioskNames stamps it once the roster is known. */
function fromRow(row: StudentRow) {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name ?? '', avatarColor: badgeColor(row.id), active: row.active ?? true }
}

export const mockClassroom: Classroom = { id: 'room-4', name: 'Room 4', teacherName: 'Ms. Rivera' }

/**
 * Resolves the signed-in teacher's single assigned classroom through classroom_teachers.
 * `status` is 'none' when the user has no membership and 'multiple' when setup assigned more than one.
 */
export async function loadClassroom(): Promise<{ classroom?: Classroom; status: 'ok' | 'none' | 'multiple'; error?: string }> {
  if (!supabase) return { classroom: mockClassroom, status: 'ok' }
  const { data, error } = await supabase.from('classroom_teachers').select('classroom_id, classrooms(name, teacher_name)')
  if (error) return { status: 'none', error: getSupabaseErrorMessage(error) }
  const rows = (data ?? []) as unknown as { classroom_id: string; classrooms: { name: string; teacher_name: string } | null }[]
  if (rows.length === 0) return { status: 'none' }
  if (rows.length > 1) return { status: 'multiple' }
  const row = rows[0]
  return { status: 'ok', classroom: { id: row.classroom_id, name: row.classrooms?.name ?? 'Classroom', teacherName: row.classrooms?.teacher_name ?? 'Teacher' } }
}

export async function loadStudents(options: { includeInactive?: boolean } = {}): Promise<{ students: Student[]; error?: string }> {
  if (!supabase) return { students: mockStudents }
  let query = supabase.from('students').select(STUDENT_COLUMNS).order('first_name').order('last_name').order('id')
  if (!options.includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) return { students: [], error: getSupabaseErrorMessage(error) }
  return { students: withKioskNames((data ?? []).map(fromRow)) }
}

export type CheckInExportBounds = { start: Date; end: Date; startDate: string; endDate: string; timeZone: string }

export async function loadCheckInExport(input: { classroomId: string; bounds: CheckInExportBounds; selectedStudentIds: string[]; includeInactive: boolean; signal?: AbortSignal }): Promise<{ rows: ExportCheckIn[]; error?: string }> {
  if (!supabase) return { rows: [] }
  if (input.signal?.aborted) return { rows: [], error: 'Export cancelled.' }
  const requestCutoff = new Date()
  const rosterQuery = supabase.from('students').select('id, first_name, last_name, active').eq('classroom_id', input.classroomId)
  const { data: rosterData, error: rosterError } = await rosterQuery
  if (rosterError) return { rows: [], error: 'Couldn’t verify the classroom roster.' }
  const roster = (rosterData ?? []) as StudentRow[]
  const byId = new Map(roster.map(student => [student.id, student]))
  const allowed = input.selectedStudentIds.filter(id => { const student = byId.get(id); return Boolean(student && (student.active || input.includeInactive)) })
  if (allowed.length !== input.selectedStudentIds.length) return { rows: [], error: 'One or more selected students are no longer available.' }
  if (!allowed.length) return { rows: [] }
  const rows: ExportCheckIn[] = []
  const pageSize = 500
  let offset = 0
  while (true) {
    if (input.signal?.aborted) return { rows: [], error: 'Export cancelled.' }
    const result = await supabase.from('check_ins')
      .select('id, student_id, emotion, created_at, students!inner(first_name, last_name, active, classroom_id)')
      .in('student_id', allowed)
      .gte('created_at', input.bounds.start.toISOString())
      .lt('created_at', input.bounds.end.toISOString())
      .lte('created_at', requestCutoff.toISOString())
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (result.error) return { rows: [], error: 'Couldn’t load all check-ins. No file was created.' }
    const page = (result.data ?? []) as unknown as Array<{ id: string; student_id: string; emotion: EmotionId; created_at: string; students: { first_name: string; last_name?: string | null; active: boolean; classroom_id: string } }>
    rows.push(...page.map(row => ({ id: row.id, studentId: row.student_id, firstName: row.students.first_name, lastName: row.students.last_name ?? '', active: row.students.active, classroomName: '', createdAt: row.created_at, emotion: row.emotion })))
    if (page.length < pageSize) break
    offset += pageSize
  }
  const classroom = await supabase.from('classrooms').select('name').eq('id', input.classroomId).single()
  if (classroom.error) return { rows: [], error: 'Couldn’t verify the classroom. No file was created.' }
  return { rows: rows.map(row => ({ ...row, classroomName: classroom.data.name })) }
}

export async function recordCheckInExport(input: { classroomId: string; startDate: string; endDate: string; timeZone: string; selectedStudentIds: string[]; includeInactive: boolean; rowCount: number }) {
  if (!supabase) return { error: 'Demo mode: downloads require a connected classroom.' }
  const { error } = await supabase.rpc('record_check_in_export', { p_classroom_id: input.classroomId, p_start_date: input.startDate, p_end_date: input.endDate, p_time_zone: input.timeZone, p_student_ids: input.selectedStudentIds, p_include_inactive: input.includeInactive, p_row_count: input.rowCount })
  return error ? { error: 'The export activity could not be recorded. No file was created.' } : {}
}

export const NAME_LIMIT = 80
export function nameLength(value: string) { return Array.from(value).length }
export function validateStudentName(firstName: string, lastName: string) {
  const first = firstName.trim(); const last = lastName.trim()
  if (!first) return 'Please enter a first name.'
  if (!last) return 'Please enter a last name.'
  if (nameLength(first) > NAME_LIMIT || nameLength(last) > NAME_LIMIT) return `Names can be up to ${NAME_LIMIT} characters.`
  return ''
}
export async function createStudent(firstName: string, lastName: string, classroomId?: string) {
  if (!supabase) return { error: 'Preview mode: connect Supabase to save students.' }
  let targetId = classroomId
  if (!targetId) {
    const classroom = await loadClassroom()
    if (classroom.error || classroom.status !== 'ok' || !classroom.classroom) return { error: 'Couldn’t resolve your classroom. Please try again.' }
    targetId = classroom.classroom.id
  }
  const { error } = await supabase.from('students').insert({ classroom_id: targetId, first_name: firstName.trim(), last_name: lastName.trim(), active: true }).select('id').single()
  return error ? { error: 'Couldn’t add this student. Please try again.' } : {}
}
export async function updateStudentName(id: string, firstName: string, lastName: string) {
  if (!supabase) return { error: 'Preview mode: connect Supabase to save students.' }
  const { data, error } = await supabase.from('students').update({ first_name: firstName.trim(), last_name: lastName.trim(), updated_at: new Date().toISOString() }).eq('id', id).eq('active', true).select('id').single()
  return error || !data ? { error: 'Couldn’t update this student. Please try again.' } : {}
}
export async function deactivateStudent(id: string) {
  if (!supabase) return { error: 'Preview mode: connect Supabase to save students.' }
  const { data, error } = await supabase.from('students').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id).eq('active', true).select('id').single()
  return error || !data ? { error: 'Couldn’t remove this student. Please try again.' } : {}
}

export async function saveCheckIn(studentId: string, emotion: EmotionId): Promise<{ error?: string }> {
  if (!supabase) return {}
  const { error } = await supabase.from('check_ins').insert({ student_id: studentId, emotion })
  return error ? { error: 'Let’s try again.' } : {}
}

export async function loadTodayCheckIns(): Promise<{ checkIns: CheckIn[]; error?: string }> {
  if (!supabase) return { checkIns: mockStudents.length ? [] : [] }
  const { start, end } = todayBounds()
  const { data, error } = await supabase.from('check_ins').select('id, student_id, emotion, created_at').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).order('created_at', { ascending: false }).order('id', { ascending: false })
  if (error) return { checkIns: [], error: getSupabaseErrorMessage(error) }
  const allowed = new Set(emotions.map(item => item.id))
  return { checkIns: (data ?? []).filter(row => allowed.has(row.emotion as EmotionId)).map(row => ({ id: row.id, studentId: row.student_id, emotion: row.emotion as EmotionId, createdAt: row.created_at })) }
}

export async function loadStudentHistory(studentId: string): Promise<{ checkIns: CheckIn[]; responses: TeacherResponse[]; error?: string }> {
  if (!supabase) return { checkIns: demoHistory(studentId), responses: [] }
  const { data, error } = await supabase.from('check_ins').select('id, student_id, emotion, created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(7)
  if (error) return { checkIns: [], responses: [], error: 'Couldn’t load student history.' }
  const checkIns = (data ?? []).map(row => ({ id: row.id, studentId: row.student_id, emotion: row.emotion as EmotionId, createdAt: row.created_at }))
  const ids = checkIns.map(c => c.id)
  if (!ids.length) return { checkIns, responses: [] }
  const result = await supabase.from('teacher_responses').select('id, student_id, check_in_id, teacher_id, response_type, note, created_at').in('check_in_id', ids)
  if (result.error) return { checkIns, responses: [], error: 'Couldn’t load student history.' }
  return { checkIns, responses: (result.data ?? []).map(r => ({ id: r.id, studentId: r.student_id, checkInId: r.check_in_id, teacherId: r.teacher_id, responseType: r.response_type as ResponseType, note: r.note, createdAt: r.created_at })) }
}

/** Notes are limited by code points, matching Postgres char_length, so emoji count once. */
export const NOTE_LIMIT = 250
export function noteLength(note: string) { return Array.from(note).length }

export function formatTime(createdAt: string) { return new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }

/** "Today", "Yesterday", or a short date, using the browser's local calendar day. */
export function formatDayLabel(createdAt: string) {
  if (isToday(createdAt)) return 'Today'
  const { start } = todayBounds()
  const yesterday = new Date(start); yesterday.setDate(yesterday.getDate() - 1)
  const value = new Date(createdAt)
  if (value >= yesterday && value < start) return 'Yesterday'
  return value.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** Demo preview only: today's mock snapshot as ID-bearing records so the support page can render. */
function demoHistory(studentId: string): CheckIn[] {
  return mockCheckIns.filter(item => item.studentId === studentId).map(item => {
    const createdAt = new Date(); const match = /(\d+):(\d+) (AM|PM)/.exec(item.time)
    if (match) createdAt.setHours((Number(match[1]) % 12) + (match[3] === 'PM' ? 12 : 0), Number(match[2]), 0, 0)
    return { id: `demo-${studentId}`, studentId, emotion: item.emotion, createdAt: createdAt.toISOString() }
  })
}

export function isToday(createdAt: string) {
  const { start, end } = todayBounds()
  const value = new Date(createdAt)
  return value >= start && value < end
}

export async function saveTeacherResponse(input: { studentId: string; checkInId: string; teacherId: string; responseType: ResponseType; note: string | null }): Promise<{ response?: TeacherResponse; error?: string; duplicate?: boolean }> {
  if (!supabase) return { error: 'Phase 2 preview requires Supabase.' }
  if (noteLength(input.note ?? '') > NOTE_LIMIT) return { error: `Notes can be up to ${NOTE_LIMIT} characters.` }
  const { data, error } = await supabase.from('teacher_responses').insert({ student_id: input.studentId, check_in_id: input.checkInId, teacher_id: input.teacherId, response_type: input.responseType, note: input.note }).select('id, student_id, check_in_id, teacher_id, response_type, note, created_at').single()
  if (error) return { error: 'Couldn’t save this check-in. Please try again.', duplicate: error.code === '23505' }
  return { response: { id: data.id, studentId: data.student_id, checkInId: data.check_in_id, teacherId: data.teacher_id, responseType: data.response_type, note: data.note, createdAt: data.created_at } }
}

export async function loadResponses(checkInIds: string[]): Promise<{ responses: TeacherResponse[]; error?: string }> {
  if (!supabase || !checkInIds.length) return { responses: [] }
  const { data, error } = await supabase.from('teacher_responses').select('id, student_id, check_in_id, teacher_id, response_type, note, created_at').in('check_in_id', checkInIds)
  if (error) return { responses: [], error: 'Couldn’t load follow-up status.' }
  return { responses: (data ?? []).map(r => ({ id:r.id, studentId:r.student_id, checkInId:r.check_in_id, teacherId:r.teacher_id, responseType:r.response_type as ResponseType, note:r.note, createdAt:r.created_at })) }
}
