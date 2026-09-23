import type { SupportStatus } from '../../types'

/** Text-first status badge shared by the dashboard cards and the support page. */
export default function SupportStatusBadge({ status }: { status: SupportStatus | null }) {
  if (!status) return null
  return status === 'checked_in_with'
    ? <span className="text-sm font-bold text-teal">✓ Checked in with</span>
    : <span className="text-sm font-bold text-coral">Needs check-in</span>
}
