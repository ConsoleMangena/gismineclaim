const statusColors = {
  active: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-gray-100 text-gray-800',
  revoked: 'bg-red-100 text-red-800',
  open: 'bg-red-100 text-red-800',
  under_review: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-gray-100 text-gray-800',
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export default function StatusBadge({ value }) {
  const colorClass = statusColors[value] || 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass}`}>
      {value?.replace('_', ' ')}
    </span>
  )
}
