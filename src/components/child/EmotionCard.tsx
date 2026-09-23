import { Check } from 'lucide-react'
import type { Emotion } from '../../types'

interface EmotionCardProps {
  emotion: Emotion
  selected: boolean
  onSelect: () => void
}

export default function EmotionCard({ emotion, selected, onSelect }: EmotionCardProps) {
  const imageSrc = `/assets/emotions/${emotion.id}.png`

  return (
    <button type="button" aria-label={emotion.label} aria-pressed={selected} onClick={onSelect} style={{ backgroundColor: emotion.color }} className="emotion-card relative flex min-h-44 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[2rem] border-[3px] border-transparent px-3 py-4">
      {selected && (
        <span className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-teal text-white" aria-hidden="true"><Check size={20} strokeWidth={3} /></span>
      )}
      <img src={imageSrc} alt={`${emotion.label} feeling`} className="size-24 object-contain" draggable={false} />
      <span className="text-2xl font-extrabold text-ink sm:text-3xl">{emotion.label}</span>
    </button>
  )
}
