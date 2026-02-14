import { useState, useRef, useEffect } from 'react'
import type { MediaType, Status, ListType } from '../types'

interface InputBarProps {
  onAdd: (entry: { title: string; type: MediaType; status: Status; year: number; list: ListType; releaseDate?: string }) => void
  currentList: ListType
}

const mediaTypes: { value: MediaType; label: string; color: string; borderColor: string }[] = [
  { value: 'movie', label: 'MOVIE', color: 'text-movie', borderColor: 'border-movie' },
  { value: 'tv', label: 'TV SHOW', color: 'text-tv', borderColor: 'border-tv' },
  { value: 'game', label: 'GAME', color: 'text-game', borderColor: 'border-game' },
  { value: 'comic', label: 'COMIC', color: 'text-comic', borderColor: 'border-comic' },
]

const statuses: { value: Status; label: string; color: string; borderColor: string }[] = [
  { value: 'planned', label: 'PLANNED', color: 'text-planned', borderColor: 'border-planned' },
  { value: 'in_progress', label: 'IN PROGRESS', color: 'text-inprogress', borderColor: 'border-inprogress' },
  { value: 'paused', label: 'ON PAUSE', color: 'text-paused', borderColor: 'border-paused' },
  { value: 'completed', label: 'COMPLETED', color: 'text-completed', borderColor: 'border-completed' },
  { value: 'dropped', label: 'DROPPED', color: 'text-dropped', borderColor: 'border-dropped' },
]

export function InputBar({ onAdd, currentList }: InputBarProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<MediaType>('movie')
  const [status, setStatus] = useState<Status>('planned')
  const [year, setYear] = useState(new Date().getFullYear())
  const [releaseDate, setReleaseDate] = useState('')
  const [showSubmenu, setShowSubmenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!title.trim()) {
          setShowSubmenu(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [title])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    onAdd({
      title: title.trim(),
      type,
      status,
      year,
      list: currentList,
      releaseDate: currentList === 'futurelog' && releaseDate ? releaseDate : undefined,
    })

    setTitle('')
    setType('movie')
    setStatus('planned')
    setYear(new Date().getFullYear())
    setReleaseDate('')
    setShowSubmenu(false)
    inputRef.current?.blur()
  }

  const handleFocus = () => {
    setShowSubmenu(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (!showSubmenu) setShowSubmenu(true)
  }

  const selectedTypeColor = mediaTypes.find(t => t.value === type)?.borderColor || 'border-border'

  return (
    <div className="flex justify-center py-4" ref={containerRef}>
      <div className="w-full max-w-md px-4">
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={handleInputChange}
            onFocus={handleFocus}
            placeholder={currentList === 'backlog' ? "Add to backlog..." : "Add to futurelog..."}
            className={`w-full px-4 py-2 border bg-transparent text-text placeholder-dim focus:outline-none transition-colors ${
              showSubmenu ? selectedTypeColor : 'border-border focus:border-muted'
            }`}
          />
        </form>

        {showSubmenu && (
          <div className="mt-2 border border-border p-4 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-label text-xs w-16">TYPE</span>
              <div className="flex gap-2 flex-wrap">
                {mediaTypes.map(({ value, label, color, borderColor }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`px-2 py-1 text-xs border transition-colors ${
                      type === value
                        ? `${borderColor} ${color}`
                        : 'border-border text-muted hover:border-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {currentList === 'backlog' && (
              <div className="flex items-center gap-4">
                <span className="text-label text-xs w-16">STATUS</span>
                <div className="flex gap-2 flex-wrap">
                  {statuses.map(({ value, label, color, borderColor }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={`px-2 py-1 text-xs border transition-colors ${
                        status === value
                          ? `${borderColor} ${color}`
                          : 'border-border text-muted hover:border-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentList === 'backlog' && (
              <div className="flex items-center gap-4">
                <span className="text-label text-xs w-16">YEAR</span>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-20 px-2 py-1 text-xs border border-border bg-transparent text-text focus:border-muted focus:outline-none"
                />
              </div>
            )}

            {currentList === 'futurelog' && (
              <div className="flex items-center gap-4">
                <span className="text-label text-xs w-16">RELEASE</span>
                <input
                  type="text"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  placeholder="DD/MM/YY"
                  className="w-24 px-2 py-1 text-xs border border-border bg-transparent text-text placeholder-dim focus:border-muted focus:outline-none"
                />
              </div>
            )}

            <div className="pt-3 border-t border-border flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="px-3 py-1 text-xs border border-completed text-completed hover:bg-completed hover:text-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-completed"
              >
                CONFIRM
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle('')
                  setType('movie')
                  setStatus('planned')
                  setYear(new Date().getFullYear())
                  setReleaseDate('')
                  setShowSubmenu(false)
                }}
                className="px-3 py-1 text-xs border border-border text-muted hover:text-text hover:border-muted"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
