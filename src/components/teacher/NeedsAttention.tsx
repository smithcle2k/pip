import type { Student } from '../../types'
import type { MockCheckIn } from '../../data/mockCheckIns'
import { emotions } from '../../data/emotions'
import { Link } from 'react-router-dom'
import SupportStatusBadge from './SupportStatusBadge'
import StudentAvatar from '../child/StudentAvatar'
import { fullName } from '../../lib/names'

export default function NeedsAttention({ students, checkIns, responseIds }: { students: Student[]; checkIns: MockCheckIn[]; responseIds?: Set<string> }) {
  const ids = new Set(checkIns.filter(item => ['sad', 'mad', 'sick'].includes(item.emotion)).map(item => item.studentId))
  const studentsNeedingCheckIn = students.filter(student => ids.has(student.id))

  return (
    <section aria-labelledby="attention-title" className="teacher-card border-l-4 border-coral p-5 sm:p-6">
      <h2 id="attention-title" className="text-xl font-extrabold text-ink">May need a check-in</h2>
      <p className="mt-1 text-sm font-semibold text-muted">A calm moment with a teacher may help.</p>
      {studentsNeedingCheckIn.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {studentsNeedingCheckIn.map(student => {
            const checkIn = checkIns.find(item => item.studentId === student.id)
            const emotion = emotions.find(item => item.id === checkIn?.emotion)
            const complete = Boolean(checkIn?.id && responseIds?.has(checkIn.id)); return <li key={student.id} className="flex items-center gap-3 text-base font-bold text-ink"><Link to={`/teacher/student/${student.id}`} className="flex items-center gap-3"><StudentAvatar student={student} variant="compact" className="size-10 text-sm" />{fullName(student)}<span role="img" aria-label={emotion?.label}>{emotion?.emoji}</span><SupportStatusBadge status={complete ? 'checked_in_with' : 'needs_check_in'} /></Link></li>
          })}
        </ul>
      ) : <p className="mt-4 font-semibold text-muted">Everyone looks set for now.</p>}
    </section>
  )
}
