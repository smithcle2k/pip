import { useNavigate } from 'react-router-dom'
import type { Student } from '../../types'
import StudentAvatar from './StudentAvatar'

export default function StudentCard({ student }: { student: Student }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/checkin/${student.id}`)}
      aria-label={`Check in as ${student.displayName}`}
      className="student-card flex min-h-44 w-full cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-white bg-white/90 px-3 py-5 sm:min-h-52 sm:py-6"
    >
      <StudentAvatar student={student} className="size-32 text-2xl sm:size-40 sm:text-3xl" />
    </button>
  )
}
