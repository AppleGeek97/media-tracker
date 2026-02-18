import { useState } from 'react'
import { X } from 'lucide-react'
import * as gist from '../lib/gist'
import { syncToGist, syncFromGist } from '../lib/storage'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type StatusMessage = { type: 'success' | 'error' | 'info'; message: string } | null

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<StatusMessage>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isEnabled = gist.isGistEnabled()
  const syncPending = gist.isSyncPending()

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setStatus({ type: 'error', message: 'Please enter a token' })
      return
    }

    setIsValidating(true)
    setStatus(null)

    const result = await gist.validateGitHubToken(token.trim())

    if (result.valid) {
      gist.setGitHubToken(token.trim())
      setStatus({ type: 'success', message: 'Token saved! Creating gist...' })

      // Initial sync - create gist
      const syncResult = await syncToGist()
      if (syncResult.success) {
        setStatus({ type: 'success', message: 'Sync enabled! Your data is now backed up to GitHub Gist.' })
        setToken('')
      } else {
        // Provide helpful error messages for common issues
        if (syncResult.error?.includes('Resource not accessible') || syncResult.error?.includes('403')) {
          setStatus({
            type: 'error',
            message: 'Token lacks gist permissions. Make sure you selected the "gist" scope when creating the token. Re-create the token at github.com/settings/tokens'
          })
        } else {
          setStatus({ type: 'error', message: syncResult.error || 'Failed to create gist' })
        }
        // Clear the invalid token
        gist.clearGitHubToken()
      }
    } else {
      setStatus({ type: 'error', message: result.error || 'Invalid token' })
    }

    setIsValidating(false)
  }

  const handleDisableSync = async () => {
    setIsDeleting(true)
    setStatus(null)

    gist.clearGitHubToken()
    setStatus({ type: 'info', message: 'Sync disabled. Your data remains in local storage.' })
    setIsDeleting(false)
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    setStatus(null)

    // First pull from gist
    const pullResult = await syncFromGist()
    if (!pullResult.success) {
      setStatus({ type: 'error', message: pullResult.error || 'Failed to sync from gist' })
      setIsSyncing(false)
      return
    }

    // Then push to gist
    const pushResult = await syncToGist()
    if (pushResult.success) {
      setStatus({ type: 'success', message: 'Sync complete!' })
    } else {
      setStatus({ type: 'error', message: pushResult.error || 'Sync failed' })
    }

    setIsSyncing(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md border border-border bg-bg">
        {/* Header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm text-text">SETTINGS</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-text"
            title="Close settings"
          >
            <X width={14} height={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* GitHub Gist Sync Section */}
          <div className="space-y-3">
            <h3 className="text-xs text-text font-semibold">GITHUB GIST SYNC</h3>
            <p className="text-xs text-muted">
              Sync your entries across devices using GitHub Gist. Create a{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-tv hover:underline"
              >
                Personal Access Token
              </a>
              :
            </p>
            <ol className="text-xs text-muted space-y-1 list-decimal list-inside pl-2">
              <li>Go to github.com/settings/tokens → "Generate new token (classic)"</li>
              <li>Name it something like "Media Logbook"</li>
              <li><strong className="text-text">Select only the "gist" scope</strong></li>
              <li>Click "Generate token" and copy it</li>
            </ol>
            <p className="text-xs text-dim italic">
              Important: Use "classic" token type (not fine-grained) and only check the "gist" box.
            </p>

            {isEnabled ? (
              <div className="space-y-3 p-3 border border-border bg-panel">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text">Status</span>
                  <div className="flex items-center gap-2">
                    {syncPending && (
                      <span className="text-xs text-dim">(pending sync)</span>
                    )}
                    <span className="text-xs text-completed">Enabled</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="flex-1 px-3 py-2 text-xs border border-border text-text hover:border-muted disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={handleDisableSync}
                    disabled={isDeleting}
                    className="px-3 py-2 text-xs border border-dropped text-dropped hover:bg-dropped hover:text-bg disabled:opacity-50"
                  >
                    {isDeleting ? 'Disabling...' : 'Disable'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3 border border-border bg-panel">
                <div>
                  <label className="text-xs text-label block mb-1">GITHUB TOKEN</label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full px-2 py-2 text-xs border border-border bg-bg text-text placeholder:text-dim"
                    disabled={isValidating}
                  />
                </div>

                <button
                  onClick={handleSaveToken}
                  disabled={isValidating}
                  className="w-full px-3 py-2 text-xs border border-border text-text hover:border-muted disabled:opacity-50"
                >
                  {isValidating ? 'Validating...' : 'Enable Sync'}
                </button>
              </div>
            )}

            {/* Status messages */}
            {status && (
              <div
                className={`p-2 text-xs ${
                  status.type === 'success'
                    ? 'text-completed border border-completed/50'
                    : status.type === 'error'
                    ? 'text-dropped border border-dropped/50'
                    : 'text-muted border border-border'
                }`}
              >
                {status.message}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="pt-3 border-t border-border space-y-2">
            <h4 className="text-xs text-label">HOW IT WORKS</h4>
            <ul className="text-xs text-muted space-y-1 list-disc list-inside">
              <li>Your data is stored in a private GitHub Gist</li>
              <li>Auto-syncs on every add/edit/delete</li>
              <li>Works offline - syncs when connection restored</li>
              <li>Last-write-wins for conflict resolution</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
