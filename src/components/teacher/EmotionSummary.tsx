import { emotions } from '../../data/emotions'
import type { EmotionId } from '../../types'

export default function EmotionSummary({ counts }: { counts: Record<EmotionId, number> }) {
  return (
    <section aria-labelledby="emotion-summary-title" className="teacher-card p-5 sm:p-6">
      <h2 id="emotion-summary-title" className="text-xl font-extrabold text-ink">Today’s feelings</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {emotions.map(emotion => (
          <div key={emotion.id} className="rounded-2xl px-3 py-4 text-center" style={{ backgroundColor: emotion.color }}>
            <span className="text-3xl" role="img" aria-label={emotion.label}>{emotion.emoji}</span>
            <p className="mt-2 text-sm font-bold text-ink">{emotion.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-teal">{counts[emotion.id]}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
