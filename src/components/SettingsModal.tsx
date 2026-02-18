import { useState, useEffect } from 'react'
import { X, Github, LogOut, RefreshCw, AlertTriangle, Shield } from 'lucide-react'
import * as gist from '../lib/gist'
import { syncToGist, syncFromGist } from '../lib/storage'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type StatusMessage = { type: 'success' | 'error' | 'info' | 'warning'; message: string } | null

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [status, setStatus] = useState<StatusMessage>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null)

  const isEnabled = gist.isGistEnabled()
  const syncPending = gist.isSyncPending()
  const isExpired = gist.isTokenExpired()
  const timeUntilExpiry = gist.getTimeUntilExpiry()

  // Update token expiry every second
  useEffect(() => {
    if (isEnabled) {
      setTokenExpiry(gist.getTokenExpiry())
      const interval = setInterval(() => {
        setTokenExpiry(gist.getTokenExpiry())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isEnabled])

  // Check for OAuth callback on mount
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')

      if (code && state) {
        setStatus({ type: 'info', message: 'Exchanging authorization code for token...' })

        const result = await gist.exchangeCodeForToken(code, state)

        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname)

        if (result.success) {
          setStatus({ type: 'success', message: 'Successfully authenticated with GitHub! Creating gist...' })

          // Initial sync - create gist
          const syncResult = await syncToGist()
          if (syncResult.success) {
            setStatus({ type: 'success', message: 'Sync enabled! Your data is now backed up to GitHub Gist.' })
          } else {
            setStatus({ type: 'error', message: syncResult.error || 'Failed to create gist' })
          }
        } else {
          setStatus({ type: 'error', message: result.error || 'Authentication failed' })
        }
      }
    }

    handleOAuthCallback()
  }, [])

  const handleSignIn = async () => {
    setStatus(null)
    await gist.initiateOAuth()
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setStatus(null)

    gist.clearGitHubToken()
    setStatus({ type: 'info', message: 'Signed out. Your data remains in local storage.' })
    setIsSigningOut(false)
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    setStatus(null)

    // Check if token is expired
    if (isExpired) {
      setStatus({ type: 'warning', message: 'Token expired. Please sign in again.' })
      setIsSyncing(false)
      return
    }

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

  // Format time until expiry
  const formatTimeRemaining = (ms: number | null): string => {
    if (!ms) return 'Unknown'
    if (ms <= 0) return 'Expired'

    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md border border-border bg-bg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-bg z-10">
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
        <div className="p-4 space-y-4">
          {/* Security Notice */}
          <div className="p-3 border border-tv/50 bg-panel space-y-2">
            <div className="flex items-center gap-2 text-tv text-xs">
              <Shield width={14} height={14} />
              <span className="font-semibold">SECURITY NOTICE</span>
            </div>
            <ul className="text-xs text-muted space-y-1 list-disc list-inside">
              <li>Tokens stored in <strong className="text-text">sessionStorage</strong> (cleared when tab closes)</li>
              <li>Uses <strong className="text-text">OAuth + PKCE</strong> - no secrets stored</li>
              <li>Only <strong className="text-text">gist</strong> scope requested (minimal permissions)</li>
              <li>Tokens expire after 8 hours</li>
            </ul>
          </div>

          {/* GitHub Gist Sync Section */}
          <div className="space-y-3">
            <h3 className="text-xs text-text font-semibold">GITHUB GIST SYNC</h3>

            {isEnabled ? (
              <div className="space-y-3 p-3 border border-border bg-panel">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text">Status</span>
                  <div className="flex items-center gap-2">
                    {syncPending && (
                      <span className="text-xs text-dim">(pending sync)</span>
                    )}
                    {isExpired ? (
                      <span className="text-xs text-dropped">Token Expired</span>
                    ) : (
                      <span className="text-xs text-completed">Signed In</span>
                    )}
                  </div>
                </div>

                {/* Token expiry */}
                {tokenExpiry && !isExpired && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Token expires in</span>
                    <span className="text-xs text-text">{formatTimeRemaining(timeUntilExpiry)}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing || isExpired}
                    className="flex-1 px-3 py-2 text-xs border border-border text-text hover:border-muted disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RefreshCw width={12} height={12} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="px-3 py-2 text-xs border border-dropped text-dropped hover:bg-dropped hover:text-bg disabled:opacity-50 flex items-center gap-2"
                  >
                    <LogOut width={12} height={12} />
                    {isSigningOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>

                {/* Re-authenticate warning */}
                {isExpired && (
                  <div className="p-2 border border-dropped/50 text-xs text-dropped flex items-start gap-2">
                    <AlertTriangle width={12} height={12} className="flex-shrink-0 mt-0.5" />
                    <span>Token expired. Click "Sign Out" and sign in again to continue syncing.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-3 border border-border bg-panel">
                <p className="text-xs text-muted">
                  Sign in with GitHub to sync your entries across devices using private Gists.
                </p>

                <button
                  onClick={handleSignIn}
                  className="w-full px-3 py-2 text-xs border border-border text-text hover:border-muted flex items-center justify-center gap-2"
                >
                  <Github width={14} height={14} />
                  Sign in with GitHub
                </button>

                <p className="text-xs text-dim italic">
                  You'll be redirected to GitHub to authorize this app.
                </p>
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
                    : status.type === 'warning'
                    ? 'text-tv border border-tv/50'
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
              <li>OAuth with PKCE for secure authentication</li>
              <li>Auto-syncs on every add/edit/delete</li>
              <li>Works offline - syncs when connection restored</li>
              <li>Last-write-wins for conflict resolution</li>
            </ul>
          </div>

          {/* Developer Setup Notice */}
          {gist.GITHUB_CLIENT_ID.includes('YOUR_CLIENT_ID_HERE') && (
            <div className="p-3 border border-dropped/50 bg-panel space-y-2">
              <div className="flex items-center gap-2 text-dropped text-xs font-semibold">
                <AlertTriangle width={12} height={12} />
                <span>DEVELOPER: SETUP REQUIRED</span>
              </div>
              <p className="text-xs text-muted">
                To enable OAuth, create a GitHub OAuth App:
              </p>
              <ol className="text-xs text-muted space-y-1 list-decimal list-inside">
                <li>Go to github.com/settings/applications/new</li>
                <li>Homepage URL: https://jefflog.vercel.app</li>
                <li>Callback URL: https://jefflog.vercel.app/auth/callback</li>
                <li>Copy Client ID to GITHUB_CLIENT_ID in src/lib/gist.ts</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
