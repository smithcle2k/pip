import type { Student } from '../types'

const letters = (value: string) => Array.from(value.trim())
const fold = (value: string) => value.toLocaleLowerCase()
const sameFirst = (a: string, b: string) => fold(a.trim()) === fold(b.trim())

/**
 * Kiosk label: first name plus the first letter of the last name ("Thomas E.").
 * When another classmate shares the first name and that initial, the shortest
 * distinguishing prefix of the last name is used instead ("Thomas Ed.").
 */
export function kioskName(student: Pick<Student, 'id' | 'firstName' | 'lastName'>, roster: Pick<Student, 'id' | 'firstName' | 'lastName'>[]) {
  const first = student.firstName.trim()
  const last = letters(student.lastName)
  if (!last.length) return first
  const peers = roster.filter(peer => peer.id !== student.id && sameFirst(peer.firstName, first)).map(peer => letters(peer.lastName))
  let length = 1
  while (length < last.length && peers.some(peer => fold(peer.slice(0, length).join('')) === fold(last.slice(0, length).join('')))) length++
  return length >= last.length ? `${first} ${last.join('')}` : `${first} ${last.slice(0, length).join('')}.`
}

/** Teacher label: the full name. */
export const fullName = (student: Pick<Student, 'firstName' | 'lastName'>) => [student.firstName.trim(), student.lastName.trim()].filter(Boolean).join(' ')

/** Two-letter monogram for small teacher-side badges. */
export const initials = (student: Pick<Student, 'firstName' | 'lastName'>) => `${letters(student.firstName)[0] ?? ''}${letters(student.lastName)[0] ?? ''}`.toLocaleUpperCase()

/** Stamp each student's kiosk label, which depends on the whole roster. */
export const withKioskNames = <T extends Pick<Student, 'id' | 'firstName' | 'lastName'>>(roster: T[]): (T & { displayName: string })[] => roster.map(student => ({ ...student, displayName: kioskName(student, roster) }))

/** Sort by first name, then last name, then id, so lists are stable. */
export const byName = (a: Pick<Student, 'id' | 'firstName' | 'lastName'>, b: Pick<Student, 'id' | 'firstName' | 'lastName'>) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName) || a.id.localeCompare(b.id)

const palette = ['#fff44f', '#ffe6cd', '#d9efe0', '#dceef8', '#f6dce6', '#e9e1f8', '#ffe9a7']
/** Stable pastel per student id for the name circle. */
export function badgeColor(id: string) { let hash = 0; for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return palette[hash % palette.length] }
