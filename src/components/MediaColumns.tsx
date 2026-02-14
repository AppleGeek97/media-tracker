import type { MediaEntry, MediaType, ListType } from '../types'

interface MediaColumnsProps {
  entries: MediaEntry[]
  onEntryClick: (entry: MediaEntry) => void
  currentList: ListType
}

const columns: { type: MediaType; label: string; color: string }[] = [
  { type: 'movie', label: 'MOVIES', color: 'text-movie border-movie/30' },
  { type: 'tv', label: 'TV SHOWS', color: 'text-tv border-tv/30' },
  { type: 'game', label: 'GAMES', color: 'text-game border-game/30' },
  { type: 'comic', label: 'COMICS', color: 'text-comic border-comic/30' },
]

const hoverColors: Record<MediaType, string> = {
  movie: 'hover:text-movie',
  tv: 'hover:text-tv',
  game: 'hover:text-game',
  comic: 'hover:text-comic',
}

export function MediaColumns({ entries, onEntryClick, currentList }: MediaColumnsProps) {
  const getEntriesByType = (type: MediaType) =>
    entries.filter((e) => e.type === type)

  return (
    <div className="flex-1 grid grid-cols-4 gap-px bg-border">
      {columns.map(({ type, label, color }) => (
        <div key={type} className="bg-bg flex flex-col">
          <div className={`px-4 py-3 border-b ${color}`}>
            <span className="text-xs">{label}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {getEntriesByType(type).map((entry) => (
              <button
                key={entry.id}
                onClick={() => onEntryClick(entry)}
                className={`w-full text-left px-4 py-2 border-b border-border/50 hover:bg-panel group ${hoverColors[type]}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${
                    entry.status === 'planned' ? 'text-planned' :
                    entry.status === 'in_progress' ? 'text-inprogress' :
                    entry.status === 'paused' ? 'text-paused' :
                    entry.status === 'dropped' ? 'text-dropped' :
                    'text-completed'
                  }`}>*</span>
                  <span className="text-text text-sm truncate group-hover:inherit flex-1">
                    {entry.title}
                  </span>
                </div>
                <div className="text-dim text-xs ml-4">
                  {currentList === 'futurelog' ? (entry.releaseDate || 'No date') : (
                    <>
                      {entry.year} · <span className={
                        entry.status === 'planned' ? 'text-planned' :
                        entry.status === 'in_progress' ? 'text-inprogress' :
                        entry.status === 'paused' ? 'text-paused' :
                        entry.status === 'dropped' ? 'text-dropped' :
                        'text-completed'
                      }>{entry.status.replace('_', ' ').toUpperCase()}</span>
                      {entry.status === 'completed' && entry.completedAt && (
                        <span> · {entry.completedAt}</span>
                      )}
                    </>
                  )}
                </div>
              </button>
            ))}
            {getEntriesByType(type).length === 0 && (
              <div className="px-4 py-8 text-dim text-xs text-center">
                No entries
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
