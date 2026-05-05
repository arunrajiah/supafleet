'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteTenantButton({ name }: { name: string }) {
  const router  = useRouter()
  const [open, setOpen]       = useState(false)
  const [dropDb, setDropDb]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState('')

  async function handleDelete() {
    if (confirm !== name) return
    setLoading(true)
    const res = await fetch(`/api/tenants/${name}`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ dropDb }),
    })
    setLoading(false)
    if (res.ok) router.push('/dashboard')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-red-400 border border-red-900/60 hover:border-red-700 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors"
      >
        Delete database
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete <span className="font-mono text-red-400">{name}</span>?</h3>
            <p className="text-sm text-gray-400 mb-5">
              This will stop and remove all containers for this tenant.
            </p>

            <label className="flex items-start gap-3 mb-5 cursor-pointer group">
              <input
                type="checkbox"
                checked={dropDb}
                onChange={(e) => setDropDb(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-red-500"
              />
              <div>
                <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  Also delete the database and all storage files
                </p>
                <p className="text-xs text-red-400 mt-0.5">This action is irreversible.</p>
              </div>
            </label>

            <div className="mb-5">
              <p className="text-xs text-gray-500 mb-1.5">
                Type <span className="font-mono text-gray-300">{name}</span> to confirm:
              </p>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={name}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-gray-700 focus:outline-none focus:border-red-700"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={confirm !== name || loading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                {loading ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => { setOpen(false); setConfirm(''); setDropDb(false) }}
                className="flex-1 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
