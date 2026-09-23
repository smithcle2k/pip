export interface Student {
  id: string
  firstName: string
  lastName: string
  /** Kiosk label ("Thomas E."), derived from the whole roster; see lib/names.ts. */
  displayName: string
  avatarColor: string
  active?: boolean
}

export type EmotionId = 'happy' | 'tired' | 'mad' | 'sad' | 'silly' | 'sick'

export interface Emotion {
  id: EmotionId
  label: string
  emoji: string
  color: string
  audioSrc?: string
}

export interface CheckIn {
  id: string
  studentId: string
  emotion: EmotionId
  createdAt: string
}

export type ResponseType = 'quick_conversation' | 'calm_down_break' | 'movement_break' | 'quiet_space' | 'classroom_activity' | 'no_action_needed'
export type SupportStatus = 'needs_check_in' | 'checked_in_with'
export interface TeacherResponse { id: string; studentId: string; checkInId: string; teacherId: string; responseType: ResponseType; note: string | null; createdAt: string }
export interface Classroom { id: string; name: string; teacherName: string }
