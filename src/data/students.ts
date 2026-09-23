import type { Student } from '../types'
import { withKioskNames } from '../lib/names'

// Demo students only. Supabase supplies the roster when configured.
// Two Thomases show the disambiguation rule ("Thomas Ed." / "Thomas El.").
export const students: Student[] = withKioskNames([
  { id: 'chloe-id', firstName: 'Chloe', lastName: 'Nguyen', avatarColor: '#ffe6cd' },
  { id: 'daniel-id', firstName: 'Daniel', lastName: 'Okafor', avatarColor: '#ffe9a7' },
  { id: 'ethan-id', firstName: 'Ethan', lastName: 'Park', avatarColor: '#d9efe0' },
  { id: 'liam-id', firstName: 'Liam', lastName: 'Silva', avatarColor: '#dceef8' },
  { id: 'maya-id', firstName: 'Maya', lastName: 'Rivera', avatarColor: '#f6dce6' },
  { id: 'sophia-id', firstName: 'Sophia', lastName: 'Bennett', avatarColor: '#e9e1f8' },
  { id: 'thomas-ed-id', firstName: 'Thomas', lastName: 'Edwards', avatarColor: '#fff44f' },
  { id: 'thomas-el-id', firstName: 'Thomas', lastName: 'Ellis', avatarColor: '#fff44f' },
])
