import { memo } from 'react'
import type { MediaEntry, ListType } from '../types'

interface TimelineProps {
  entries: MediaEntry[]
  selectedYear: number | null
  onYearSelect: (year: number | null) => void
  currentList: ListType
}

function parseReleaseYear(dateStr: string): number | null {
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  let year = parseInt(parts[2], 10)
  if (year < 100) year += year < 50 ? 2000 : 1900
  return year
}

const TimelineInner = function TimelineInner({ entries, selectedYear, onYearSelect, currentList }: TimelineProps) {
  const isFuturelog = currentList === 'futurelog'

  let years: number[] = []

  if (isFuturelog) {
    // Get years from release dates
    const yearSet = new Set<number>()
    entries.forEach(e => {
      if (e.releaseDate) {
        const year = parseReleaseYear(e.releaseDate)
        if (year) yearSet.add(year)
      }
    })
    years = [...yearSet].sort((a, b) => a - b)
  } else {
    // Get years from entry year field
    years = [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a)
  }

  return (
    <div className="border-b sm:border-b-0 sm:border-r border-border flex flex-row sm:flex-col shrink-0 sm:w-20 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-hidden py-2 sm:py-4 px-3 sm:px-0 items-center sm:items-stretch gap-0">
      <span className="hidden sm:block px-3 mb-4 text-label text-xs shrink-0">{isFuturelog ? 'RELEASE' : 'TIME'}</span>

      <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-3 sm:gap-0 sm:space-y-2 sm:flex-1 sm:overflow-y-auto sm:px-3">
        <button
          onClick={() => onYearSelect(null)}
          className={`flex items-center gap-1 text-xs shrink-0 ${
            selectedYear === null ? 'text-accent' : 'text-muted hover:text-text'
          }`}
        >
          <span className={selectedYear === null ? 'text-accent' : 'text-dim'}>
            {selectedYear === null ? '*' : ' '}
          </span>
          <span>ALL</span>
        </button>

        {years.map((year) => {
          const isSelected = selectedYear === year
          return (
            <button
              key={year}
              onClick={() => onYearSelect(isSelected ? null : year)}
              className={`flex items-center gap-1 text-xs shrink-0 ${
                isSelected ? 'text-accent' : 'text-muted hover:text-text'
              }`}
            >
              <span className={isSelected ? 'text-accent' : 'text-dim'}>
                {isSelected ? '*' : ' '}
              </span>
              <span>{year}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const Timeline = memo(TimelineInner)
