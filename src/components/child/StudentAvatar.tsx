import type { Student } from '../../types'
import { initials } from '../../lib/names'

/**
 * Name circle used everywhere a student is shown. The kiosk variant stacks the
 * first name over the last-name initial ("Thomas" / "E."); the compact variant
 * shows a two-letter monogram for small teacher-side rows.
 */
export default function StudentAvatar({ student, className, variant = 'kiosk' }: { student: Student; className: string; variant?: 'kiosk' | 'compact' }) {
  const [first, ...rest] = student.displayName.split(' ')
  const suffix = rest.join(' ')
  return (
    <span aria-hidden="true" style={{ backgroundColor: student.avatarColor }} className={`flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-full border border-ink/60 text-center leading-tight font-bold text-ink ${className}`}>
      {variant === 'compact' ? initials(student) : <><span className="max-w-[90%] truncate">{first}</span>{suffix && <span>{suffix}</span>}</>}
    </span>
  )
}
