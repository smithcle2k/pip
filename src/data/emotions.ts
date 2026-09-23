import type { Emotion } from '../types'

export const emotions: Emotion[] = [
  { id: 'happy', label: 'Happy', emoji: '😊', color: '#fff0b3' },
  { id: 'tired', label: 'Tired', emoji: '😴', color: '#e9e1f8' },
  { id: 'mad', label: 'Mad', emoji: '😡', color: '#ffd6ce' },
  { id: 'sad', label: 'Sad', emoji: '😢', color: '#dceefb' },
  { id: 'silly', label: 'Silly', emoji: '😜', color: '#ffe1b8' },
  { id: 'sick', label: 'Sick', emoji: '🤒', color: '#d9f0e4' },
]

// Discover only files that exist, so missing optional PNGs don't cause 404s.
// Vite refreshes this list during development and includes it at build time.
export const emotionImages = import.meta.glob<string>(
  '/public/assets/emotions/*.png',
  { eager: true, query: '?url', import: 'default' },
)
