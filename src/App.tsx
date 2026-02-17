import { useState, useEffect } from 'react'
import { InputBar } from './components/InputBar'
import { Timeline } from './components/Timeline'
import { MediaColumns } from './components/MediaColumns'
import { CalendarView } from './components/CalendarView'
import { useMediaEntries } from './hooks/useMediaEntries'
import { migrateToSeparateStorage, isCloudUser } from './lib/storage'
import { authSignup, authLogin, authSignout } from './lib/api'
import type { MediaEntry, ListType } from './types'

// Run migration once on module load
migrateToSeparateStorage()

function MobileWarning() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-text">PLEASE USE DESKTOP</h1>
        <p className="text-sm text-muted">
          Jeff Log is designed for desktop browsers and doesn't support mobile devices yet.
        </p>
        <div className="flex justify-center gap-2 text-xs text-dim">
          <span>🖥️ Desktop</span>
          <span>💻 Laptop</span>
        </div>
      </div>
    </div>
  )
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /android|ipad|iphone|ipod|windows phone|iemobile|blackberry|mobile/i
      const isMobileDevice = mobileRegex.test(userAgent)
      setIsMobile(isMobileDevice)
    }

    checkMobile()
  }, [])

  return isMobile
}

function Logo() {
  const pixelLetters: Record<string, number[][]> = {
    j: [
      [0,0,1,1],
      [0,0,2,2],
      [0,0,1,1],
      [1,1,2,2],
      [1,1,1,1],
    ],
    e: [
      [1,1,1,1],
      [2,2,0,0],
      [1,1,1,0],
      [2,2,0,0],
      [1,1,1,1],
    ],
    f: [
      [1,1,1,1],
      [2,2,0,0],
      [1,1,1,0],
      [2,2,0,0],
      [1,1,0,0],
    ],
    l: [
      [1,1,0,0],
      [2,2,0,0],
      [1,1,0,0],
      [2,2,0,0],
      [1,1,1,1],
    ],
    o: [
      [1,1,1,1],
      [2,0,0,2],
      [1,0,0,1],
      [2,0,0,2],
      [1,1,1,1],
    ],
    g: [
      [1,1,1,1],
      [2,0,0,2],
      [1,0,1,1],
      [2,0,0,2],
      [1,1,1,1],
    ],
  }

  const color = { top: 'var(--logo-top)', bottom: 'var(--logo-bottom)' }
  const word = 'jefflog'

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex gap-2">
        {word.split('').map((char, letterIndex) => {
          const pixels = pixelLetters[char]
          return (
            <div key={letterIndex} className="flex flex-col">
              {pixels.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  {row.map((cell, colIndex) => (
                    <div
                      key={colIndex}
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: cell === 1 ? color.top : cell === 2 ? color.bottom : 'transparent',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListToggle({ currentList, onToggle }: { currentList: ListType; onToggle: (list: ListType) => void }) {
  return (
    <div className="flex gap-1 border border-border">
      <button
        onClick={() => onToggle('backlog')}
        className={`px-4 py-2 text-xs transition-colors ${
          currentList === 'backlog'
            ? 'bg-border text-text'
            : 'text-muted hover:text-text'
        }`}
      >
        BACKLOG
      </button>
      <button
        onClick={() => onToggle('futurelog')}
        className={`px-4 py-2 text-xs transition-colors ${
          currentList === 'futurelog'
            ? 'bg-border text-text'
            : 'text-muted hover:text-text'
        }`}
      >
        FUTURELOG
      </button>
    </div>
  )
}

function AuthModal({ onAuthSuccess, onClose }: { onAuthSuccess: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate username
    if (!username || username.length < 3 || username.length > 50) {
      setError('Username must be between 3 and 50 characters')
      return
    }

    // Validate username is alphanumeric
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    // Validate password
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const result = await authSignup(username, password)
        if (result.error) {
          setError(result.error)
        } else if (result.access_token) {
          onAuthSuccess()
        }
      } else {
        const result = await authLogin(username, password)
        if (result.error) {
          setError(result.error)
        } else if (result.access_token) {
          onAuthSuccess()
        }
      }
    } catch (err) {
      setError('Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm border border-border bg-bg">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <span className="text-xs text-text">CLOUD SYNC</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={`text-xs px-2 py-1 border border-border ${
                mode === 'login' ? 'bg-border text-text' : 'text-muted hover:text-text'
              }`}
            >
              LOGIN
            </button>
            <button
              onClick={() => { setMode('signup'); setError('') }}
              className={`text-xs px-2 py-1 border border-border ${
                mode === 'signup' ? 'bg-border text-text' : 'text-muted hover:text-text'
              }`}
            >
              SIGN UP
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-muted">
            {mode === 'login' ? 'Log in to sync your entries across devices.' : 'Create an account to sync your entries across devices.'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-label text-xs block mb-1">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                className="w-full px-3 py-2 text-xs border border-border bg-bg text-text focus:border-muted outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="text-label text-xs block mb-1">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••••"
                className="w-full px-3 py-2 text-xs border border-border bg-bg text-text focus:border-muted outline-none"
              />
            </div>
            {error && (
              <div className="text-xs text-dropped">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 text-xs border border-border text-text hover:border-muted disabled:opacity-50"
              >
                {loading ? 'PROCESSING...' : mode === 'login' ? 'LOG IN' : 'SIGN UP'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs border border-border text-muted hover:text-text hover:border-muted"
              >
                CANCEL
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function ThemeToggle({ isDayTheme, onToggle, onShowAuth, onSignOut }: { isDayTheme: boolean; onToggle: () => void; onShowAuth: () => void; onSignOut: () => void }) {
  return (
    <div className="fixed top-4 left-4 z-50 flex gap-2">
      <button
        onClick={onToggle}
        className="p-2 border border-border text-muted hover:text-text hover:border-muted"
        title={isDayTheme ? 'Switch to night' : 'Switch to day'}
      >
        {isDayTheme ? (
          // Moon icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </button>
      {isCloudUser() ? (
        <button
          onClick={onSignOut}
          className="px-2 py-1 text-xs border border-border text-completed hover:text-text hover:border-muted"
          title="Sign out"
        >
          ☁ SIGNED OUT
        </button>
      ) : (
        <button
          onClick={onShowAuth}
          className="px-2 py-1 text-xs border border-border text-muted hover:text-text hover:border-muted"
          title="Cloud sync"
        >
          ☁ SYNC
        </button>
      )}
    </div>
  )
}

function App() {
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<MediaEntry | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [entryCount, setEntryCount] = useState(0)
  const [currentList, setCurrentList] = useState<ListType>('backlog')
  const { entries, loading, add, update, remove, refresh } = useMediaEntries(currentList)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [isDayTheme, setIsDayTheme] = useState(() => {
    return localStorage.getItem('jefflog-theme') === 'day'
  })

  useEffect(() => {
    if (isDayTheme) {
      document.documentElement.classList.add('day')
    } else {
      document.documentElement.classList.remove('day')
    }
    localStorage.setItem('jefflog-theme', isDayTheme ? 'day' : 'night')
  }, [isDayTheme])

  const toggleTheme = () => setIsDayTheme((prev) => !prev)

  const handleAuthSuccess = async () => {
    setShowAuth(false)
    // Refresh entries after signing in
    await refresh?.()
  }

  const handleSignOut = async () => {
    await authSignout()
    // Refresh entries after signing out
    await refresh?.()
  }

  useEffect(() => {
    if (!loading && entries.length !== entryCount) {
      if (entryCount !== 0) {
        setShowSaved(true)
        const timer = setTimeout(() => setShowSaved(false), 1500)
        return () => clearTimeout(timer)
      }
      setEntryCount(entries.length)
    }
  }, [entries.length, loading, entryCount])

  const handleAddEntry = async (entry: { title: string; type: MediaEntry['type']; status: MediaEntry['status']; year: number; list: ListType; releaseDate?: string }) => {
    await add({
      ...entry,
      seasonsCompleted: entry.type === 'tv' ? 0 : undefined,
      releaseDate: entry.releaseDate,
    })
    setEntryCount(entries.length + 1)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  const placeholderTitles: Record<MediaEntry['type'], string> = {
    movie: 'New Movie',
    tv: 'New TV Show',
    game: 'New Game',
    comic: 'New Comic',
  }

  const handleQuickAdd = async (type: MediaEntry['type']) => {
    await add({
      title: placeholderTitles[type],
      type,
      status: 'planned',
      year: new Date().getFullYear(),
      list: currentList,
      seasonsCompleted: type === 'tv' ? 0 : undefined,
    })
    setEntryCount(entries.length + 1)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  // Reset time filter when switching lists
  const handleListToggle = (list: ListType) => {
    setCurrentList(list)
    setSelectedTime(null)
  }

  // Filter entries by selected time
  const filteredEntries = selectedTime
    ? entries.filter((e) => {
        if (currentList === 'futurelog') {
          // Filter by release year
          if (!e.releaseDate) return false
          const parts = e.releaseDate.split('/')
          if (parts.length !== 3) return false
          let year = parseInt(parts[2], 10)
          if (year < 100) year += year < 50 ? 2000 : 1900
          return year === selectedTime
        } else {
          return e.year === selectedTime
        }
      })
    : entries

  const handleEntryClick = (entry: MediaEntry) => {
    setSelectedEntry(entry)
  }

  const handleCloseDetail = () => {
    setSelectedEntry(null)
  }

  const handleDeleteEntry = async () => {
    if (selectedEntry) {
      await remove(selectedEntry.id)
      setSelectedEntry(null)
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 1500)
    }
  }

  const handleQuickDelete = async (entry: MediaEntry) => {
    await remove(entry.id)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  const handleTypeChange = async (entry: MediaEntry, newType: MediaEntry['type']) => {
    await update(entry.id, { type: newType })
    setSelectedEntry({ ...entry, type: newType })
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  const handleStatusCycle = async () => {
    if (!selectedEntry) return
    const statusOrder: MediaEntry['status'][] = ['planned', 'in_progress', 'paused', 'completed', 'dropped']
    const currentIndex = statusOrder.indexOf(selectedEntry.status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]

    // Set completedAt when marking as completed
    const today = new Date()
    const completedAt = nextStatus === 'completed'
      ? `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear().toString().slice(-2)}`
      : selectedEntry.completedAt

    await update(selectedEntry.id, { status: nextStatus, completedAt })
    setSelectedEntry({ ...selectedEntry, status: nextStatus, completedAt })
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'movie': return 'text-movie'
      case 'tv': return 'text-tv'
      case 'game': return 'text-game'
      case 'comic': return 'text-comic'
      default: return 'text-muted'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'text-planned'
      case 'in_progress': return 'text-inprogress'
      case 'paused': return 'text-paused'
      case 'completed': return 'text-completed'
      case 'dropped': return 'text-dropped'
      default: return 'text-muted'
    }
  }

  const isMobile = useIsMobile()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted">
        loading...
      </div>
    )
  }

  if (isMobile) {
    return <MobileWarning />
  }

  return (
    <div className={`flex flex-col h-screen bg-bg transition-all ${showCalendar ? 'mr-72' : ''}`}>
      <ThemeToggle isDayTheme={isDayTheme} onToggle={toggleTheme} onShowAuth={() => setShowAuth(true)} onSignOut={handleSignOut} />

      {/* Calendar Toggle */}
      <button
        onClick={() => setShowCalendar(prev => !prev)}
        className={`fixed top-4 right-4 z-50 p-2 border text-muted hover:text-text hover:border-muted ${
          showCalendar ? 'border-muted bg-border' : 'border-border'
        }`}
        title={showCalendar ? 'Hide calendar' : 'Show calendar'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Save Indicator */}
      {showSaved && (
        <div className="fixed top-4 right-16 z-50 px-3 py-1 text-xs text-completed border border-completed/50 bg-bg">
          SAVED
        </div>
      )}

      {/* Top Half - Logo + Toggle + Input */}
      <div className="h-1/2 flex flex-col items-center justify-center border-b border-border">
        <Logo />

        <div className="mt-6">
          <ListToggle currentList={currentList} onToggle={handleListToggle} />
        </div>

        <div className="w-full max-w-lg mt-4">
          <InputBar onAdd={handleAddEntry} currentList={currentList} />
        </div>

        <div className="mt-2 text-dim text-xs">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} in {currentList}
        </div>
      </div>

      {/* Bottom Half - Timeline + Columns + Calendar */}
      <div className="h-1/2 flex overflow-hidden">
        <Timeline
          entries={entries}
          selectedYear={selectedTime}
          onYearSelect={setSelectedTime}
          currentList={currentList}
        />
        <MediaColumns
          entries={filteredEntries}
          onEntryClick={handleEntryClick}
          currentList={currentList}
          onAddEntry={handleQuickAdd}
          onDeleteEntry={handleQuickDelete}
        />
      </div>

      {/* Calendar View - Full height sidebar */}
      {showCalendar && (
        <div className="fixed top-0 right-0 h-full w-72 z-40 bg-bg">
          <CalendarView
            entries={entries}
            onEntryClick={handleEntryClick}
            currentList={currentList}
          />
        </div>
      )}

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={handleCloseDetail} />
          <div className="relative w-full max-w-sm border border-border bg-bg">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className={`text-xs ${getTypeColor(selectedEntry.type)}`}>
                {selectedEntry.type.toUpperCase()}
              </span>
              <select
                value={selectedEntry.type}
                onChange={(e) => handleTypeChange(selectedEntry, e.target.value as MediaEntry['type'])}
                className="text-xs bg-bg border border-border text-text px-2 py-1"
              >
                <option value="movie">MOVIE</option>
                <option value="tv">TV SHOW</option>
                <option value="game">GAME</option>
                <option value="comic">COMIC</option>
              </select>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <span className="text-label text-xs block mb-1">TITLE</span>
                <span className="text-text">{selectedEntry.title}</span>
              </div>
              <div className="flex gap-8">
                {selectedEntry.list === 'backlog' && (
                  <>
                    <div>
                      <span className="text-label text-xs block mb-1">YEAR</span>
                      <span className="text-muted text-sm">{selectedEntry.year}</span>
                    </div>
                    <div>
                      <span className="text-label text-xs block mb-1">STATUS</span>
                      <span className={`text-sm ${getStatusColor(selectedEntry.status)}`}>{selectedEntry.status.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    {selectedEntry.status === 'completed' && selectedEntry.completedAt && (
                      <div>
                        <span className="text-label text-xs block mb-1">FINISHED</span>
                        <span className="text-muted text-sm">{selectedEntry.completedAt}</span>
                      </div>
                    )}
                  </>
                )}
                {selectedEntry.list === 'futurelog' && (
                  <div>
                    <span className="text-label text-xs block mb-1">RELEASE</span>
                    <span className="text-muted text-sm">{selectedEntry.releaseDate || 'Not set'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-border">
              <button
                onClick={handleCloseDetail}
                className="px-3 py-1 text-xs border border-border text-muted hover:text-text hover:border-muted"
              >
                CLOSE
              </button>
              {selectedEntry.list === 'backlog' && (
                <button
                  onClick={handleStatusCycle}
                  className="px-3 py-1 text-xs border border-border text-muted hover:text-text hover:border-muted"
                >
                  CYCLE STATUS
                </button>
              )}
              <button
                onClick={handleDeleteEntry}
                className="px-3 py-1 text-xs border border-dropped text-dropped hover:bg-dropped hover:text-bg"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onAuthSuccess={handleAuthSuccess}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  )
}

export default App
