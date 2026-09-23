import type { Student } from '../../types'
import type { MockCheckIn } from '../../data/mockCheckIns'
import { emotions } from '../../data/emotions'
import { Link } from 'react-router-dom'
import SupportStatusBadge from './SupportStatusBadge'
import StudentAvatar from '../child/StudentAvatar'
import { fullName } from '../../lib/names'

export default function StudentStatusCard({ student, checkIn, responseIds }: { student: Student; checkIn?: MockCheckIn; responseIds?: Set<string> }) {
  const emotion = checkIn ? emotions.find(item => item.id === checkIn.emotion) : undefined

  return (
    <li className="flex items-center gap-4 border-b border-[#e2e8f0] px-1 py-4 last:border-b-0">
      <StudentAvatar student={student} variant="compact" className="size-12 text-base" />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold text-ink">{fullName(student)}</span>
        {emotion ? <span className="flex items-center gap-1.5 text-sm font-bold text-muted"><span role="img" aria-label={emotion.label}>{emotion.emoji}</span> {emotion.label}</span> : <span className="text-sm font-semibold text-muted">Not checked in</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold text-muted">{checkIn?.time ?? '—'}</span>{checkIn?.id && responseIds?.has(checkIn.id) && <SupportStatusBadge status="checked_in_with" />}
      <Link to={`/teacher/student/${student.id}`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-extrabold text-teal hover:bg-mint">View</Link>
    </li>
  )
}
