export default function Logo() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-950 fill-current">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-white font-bold tracking-tight">MultiDB</span>
    </div>
  )
}
