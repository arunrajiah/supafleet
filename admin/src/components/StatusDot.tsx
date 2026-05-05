type Status = 'running' | 'stopped' | 'error' | 'missing'

const colours: Record<Status, string> = {
  running: 'bg-brand',
  stopped: 'bg-yellow-500',
  error:   'bg-red-500',
  missing: 'bg-gray-600',
}

export default function StatusDot({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colours[status]}`} />
      <span className="text-xs text-gray-400 capitalize">{status}</span>
    </span>
  )
}
