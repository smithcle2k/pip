import { emotions } from '../../data/emotions'
import { formatDayLabel, formatTime, isToday } from '../../lib/data'
import type { CheckIn } from '../../types'

/** Last seven submissions, newest first. `latestId` marks today's displayed record. */
export default function CheckInHistory({ checkIns, latestId }: { checkIns: CheckIn[]; latestId?: string }) {
  const earlier = checkIns.filter(item => item.id !== latestId)
  return (
    <section aria-labelledby="history-title" className="teacher-card mt-5 p-6">
      <h2 id="history-title" className="text-xl font-extrabold text-ink">Recent check-ins</h2>
      {checkIns.length > 0 && (
        <ul className="mt-4 space-y-3">
          {checkIns.map(item => {
            const emotion = emotions.find(entry => entry.id === item.emotion)
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f9fa] px-4 py-3 font-bold">
                <span className="flex items-center gap-2"><span className="text-muted">{formatDayLabel(item.createdAt)}</span><span role="img" aria-label={emotion?.label}>{emotion?.emoji}</span>{emotion?.label}{item.id === latestId && isToday(item.createdAt) && <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-extrabold text-teal">Latest</span>}</span>
                <span className="text-muted">{formatTime(item.createdAt)}</span>
              </li>
            )
          })}
        </ul>
      )}
      {earlier.length === 0 && <p className="mt-4 font-semibold text-muted">No earlier check-ins yet.</p>}
    </section>
  )
}
