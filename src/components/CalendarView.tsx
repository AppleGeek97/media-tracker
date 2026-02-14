import type { MediaEntry, ListType } from '../types'

interface CalendarViewProps {
  entries: MediaEntry[]
  onEntryClick: (entry: MediaEntry) => void
  currentList: ListType
}

function parseReleaseDate(dateStr: string): Date | null {
  // Parse DD/MM/YY format
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // months are 0-indexed
  let year = parseInt(parts[2], 10)
  // Convert 2-digit year to 4-digit
  if (year < 100) {
    year += year < 50 ? 2000 : 1900
  }
  const date = new Date(year, month, day)
  if (isNaN(date.getTime())) return null
  return date
}

function formatMonthYear(date: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

function getTypeColor(type: string) {
  switch (type) {
    case 'movie': return 'text-movie'
    case 'tv': return 'text-tv'
    case 'game': return 'text-game'
    case 'comic': return 'text-comic'
    default: return 'text-muted'
  }
}

export function CalendarView({ entries, onEntryClick, currentList }: CalendarViewProps) {
  const isFuturelog = currentList === 'futurelog'

  // Separate entries with and without dates
  const withDates: { entry: MediaEntry; date: Date }[] = []
  const withoutDates: MediaEntry[] = []

  entries.forEach(entry => {
    if (isFuturelog) {
      // Futurelog: use releaseDate
      if (entry.releaseDate) {
        const date = parseReleaseDate(entry.releaseDate)
        if (date) {
          withDates.push({ entry, date })
        } else {
          withoutDates.push(entry)
        }
      } else {
        withoutDates.push(entry)
      }
    } else {
      // Backlog: use completedAt (only show completed entries with dates)
      if (entry.completedAt) {
        const date = parseReleaseDate(entry.completedAt)
        if (date) {
          withDates.push({ entry, date })
        }
      } else if (entry.status === 'completed') {
        withoutDates.push(entry)
      }
    }
  })

  // Sort by date: ascending for futurelog (upcoming), descending for backlog (recent first)
  if (isFuturelog) {
    withDates.sort((a, b) => a.date.getTime() - b.date.getTime())
  } else {
    withDates.sort((a, b) => b.date.getTime() - a.date.getTime())
  }

  // Group by month/year
  const groups: Map<string, { entry: MediaEntry; date: Date }[]> = new Map()
  withDates.forEach(item => {
    const key = formatMonthYear(item.date)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  })

  return (
    <div className="h-full overflow-y-auto overscroll-contain p-4 pt-16 border-l border-border">
      <div className="text-xs text-label mb-4">
        {isFuturelog ? 'UPCOMING RELEASES' : 'COMPLETED'}
      </div>

      {Array.from(groups.entries()).map(([monthYear, items]) => (
        <div key={monthYear} className="mb-4">
          <div className="text-xs text-muted mb-2 border-b border-border pb-1">{monthYear}</div>
          <div className="space-y-2">
            {items.map(({ entry, date }) => (
              <button
                key={entry.id}
                onClick={() => onEntryClick(entry)}
                className="w-full text-left px-2 py-1 border border-border hover:border-muted transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text text-sm truncate">{entry.title}</span>
                  <span className="text-dim text-xs whitespace-nowrap">
                    {date.getDate().toString().padStart(2, '0')}/{(date.getMonth() + 1).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className={`text-xs ${getTypeColor(entry.type)}`}>
                  {entry.type.toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {withoutDates.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted mb-2 border-b border-border pb-1">NO DATE</div>
          <div className="space-y-2">
            {withoutDates.map(entry => (
              <button
                key={entry.id}
                onClick={() => onEntryClick(entry)}
                className="w-full text-left px-2 py-1 border border-border hover:border-muted transition-colors"
              >
                <div className="text-text text-sm truncate">{entry.title}</div>
                <div className={`text-xs ${getTypeColor(entry.type)}`}>
                  {entry.type.toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {withDates.length === 0 && withoutDates.length === 0 && (
        <div className="text-dim text-xs text-center py-8">
          {isFuturelog ? 'No entries in futurelog' : 'No completed entries'}
        </div>
      )}
    </div>
  )
}
