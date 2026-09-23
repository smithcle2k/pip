import { useEffect, useRef } from 'react'
import { Volume2 } from 'lucide-react'
import { playPrompt, stopAudio } from '../../lib/audio'
import type { Student } from '../../types'
import StudentAvatar from './StudentAvatar'

interface CheckInHeaderProps {
  student: Student
  questionAudioSrc?: string
}

export default function CheckInHeader({ student, questionAudioSrc }: CheckInHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const question = `How are you feeling today, ${student.firstName}?`

  useEffect(() => {
    document.title = `How are you feeling, ${student.firstName}? · Pip`
    headingRef.current?.focus()
    // Start loading available voices before the first speaker-button tap.
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices()
    return stopAudio
  }, [student.firstName])

  return (
    <div className="mb-7 flex flex-col items-center gap-4 text-center sm:mb-8 sm:flex-row sm:justify-center sm:text-left">
      <StudentAvatar student={student} className="size-24 text-lg sm:size-28 sm:text-xl" />
      <div className="flex items-center gap-3 sm:gap-4">
        <h1 ref={headingRef} tabIndex={-1} id="checkin-title" className="page-heading max-w-xl text-left text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
          {question}
        </h1>
        <button type="button" onClick={() => playPrompt(question, questionAudioSrc)} aria-label="Read the question aloud" className="flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-white/90 text-teal shadow-sm active:scale-95">
          <Volume2 size={28} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
