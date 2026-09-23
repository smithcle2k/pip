import type { EmotionId } from '../types'

export interface MockCheckIn {
  id?: string
  createdAt?: string
  studentId: string
  emotion: EmotionId
  time: string
}

// Temporary classroom snapshot for Milestone 5. Supabase replaces this in Milestone 7.
export const mockCheckIns: MockCheckIn[] = [
  { studentId: 'chloe-id', emotion: 'happy', time: '8:14 AM' },
  { studentId: 'daniel-id', emotion: 'tired', time: '8:16 AM' },
  { studentId: 'maya-id', emotion: 'sad', time: '8:18 AM' },
  { studentId: 'sophia-id', emotion: 'mad', time: '8:20 AM' },
]
