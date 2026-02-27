import { useState, useEffect, memo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MediaEntry, MediaType, ListType } from '../types'

interface MediaColumnsProps {
  entries: MediaEntry[]
  onEntryClick: (entry: MediaEntry) => void
  currentList: ListType
  onAddEntry?: (type: MediaType) => void
  onDeleteEntry?: (entry: MediaEntry) => void
  onUpdateEntry?: (id: string, updates: Partial<MediaEntry>) => void
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

interface DraggableEntryProps {
  entry: MediaEntry
  currentList: ListType
  onEntryClick: (entry: MediaEntry) => void
  onDeleteEntry?: (entry: MediaEntry) => void
}

interface DroppableColumnProps {
  type: MediaType
  label: string
  color: string
  entries: MediaEntry[]
  currentList: ListType
  onEntryClick: (entry: MediaEntry) => void
  onAddEntry?: (type: MediaType) => void
  onDeleteEntry?: (entry: MediaEntry) => void
}

const DroppableColumn = memo(function DroppableColumn({ type, label, color, entries, currentList, onEntryClick, onAddEntry, onDeleteEntry }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: type,
  })

  return (
    <div className="bg-bg flex flex-col h-full min-h-0">
      <div
        ref={setNodeRef}
        className={`px-4 py-3 border-b ${color}`}
      >
        <span className="text-xs">{label}</span>
      </div>
      <div
        onClick={() => onAddEntry?.(type)}
        className={`flex-1 overflow-y-auto min-h-0 ${onAddEntry ? 'hover:bg-panel/30 cursor-pointer' : ''} transition-colors`}
      >
        <SortableContext
          items={entries.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {entries.map((entry) => (
            <DraggableEntry
              key={entry.id}
              entry={entry}
              currentList={currentList}
              onEntryClick={onEntryClick}
              onDeleteEntry={onDeleteEntry}
            />
          ))}
        </SortableContext>
        {entries.length === 0 && (
          <div className="px-4 py-8 text-dim text-xs text-center">
            No entries
          </div>
        )}
      </div>
    </div>
  )
})

const DraggableEntry = memo(function DraggableEntry({ entry, currentList, onEntryClick, onDeleteEntry }: DraggableEntryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/entry">
      <div
        {...attributes}
        onClick={(e) => {
          e.stopPropagation()
          onEntryClick(entry)
        }}
        className={`w-full text-left border-b border-border/50 hover:bg-panel px-4 py-2 ${hoverColors[entry.type]}`}
      >
        <button
          {...listeners}
          className="w-full text-left -mx-4 -my-2 px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-text text-sm truncate flex-1">
              {entry.title}
            </span>
          </div>
        </button>
        <div className="text-dim text-xs">
          {currentList === 'futurelog' ? (entry.releaseDate || 'No date') : (
            <>
              <span className={
                entry.status === 'planned' ? 'text-planned' :
                entry.status === 'in_progress' ? 'text-inprogress' :
                entry.status === 'paused' ? 'text-paused' :
                entry.status === 'dropped' ? 'text-dropped' :
                entry.status === 'replaying' ? 'text-replaying' :
                'text-completed'
              }>{entry.status.replace('_', ' ').toUpperCase()}</span>
              <span> · {entry.year}</span>
              {entry.status === 'completed' && entry.completedAt && (
                <span> · {entry.completedAt}</span>
              )}
            </>
          )}
        </div>
      </div>
      {onDeleteEntry && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDeleteEntry(entry)
          }}
          className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover/entry:opacity-100 text-dim hover:text-dropped text-xs px-1.5 py-0.5 bg-bg border border-border hover:border-dropped/50 transition-opacity z-10"
          title="Delete entry"
        >
          ×
        </button>
      )}
    </div>
  )
})

const MediaColumnsInner = function MediaColumnsInner({ entries, onEntryClick, currentList, onAddEntry, onDeleteEntry, onUpdateEntry }: MediaColumnsProps) {
  const [items, setItems] = useState<MediaEntry[]>(entries)
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeEntry = activeId ? items.find((e) => e.id === activeId) : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Update local state when entries prop changes
  useEffect(() => {
    setItems(entries)
  }, [entries])

  const getEntriesByType = (type: MediaType) =>
    items.filter((e) => e.type === type)

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeEntry = items.find((e) => e.id === activeId)
    if (!activeEntry) return

    // Check if dropped on a column header (type change)
    const targetType = columns.find((col) => col.type === overId)?.type
    if (targetType && activeEntry.type !== targetType) {
      // Update the entry type
      onUpdateEntry?.(activeId, { type: targetType })
      setActiveId(null)
      return
    }

    // Check if dropped on another entry
    const overEntry = items.find((e) => e.id === overId)
    if (overEntry) {
      if (activeEntry.type !== overEntry.type) {
        // Different types - update the active entry's type to match the column
        onUpdateEntry?.(activeId, { type: overEntry.type })
      } else {
        // Same type - reorder within the column
        const oldIndex = items.findIndex((e) => e.id === activeId)
        const newIndex = items.findIndex((e) => e.id === overId)
        setItems((items) => arrayMove(items, oldIndex, newIndex))
      }
    }

    setActiveId(null)
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 grid grid-cols-4 gap-px bg-border h-full overflow-hidden">
          {columns.map(({ type, label, color }) => (
            <DroppableColumn
              key={type}
              type={type}
              label={label}
              color={color}
              entries={getEntriesByType(type)}
              currentList={currentList}
              onEntryClick={onEntryClick}
              onAddEntry={onAddEntry}
              onDeleteEntry={onDeleteEntry}
            />
          ))}
        </div>

        {activeEntry && (
          <DragOverlay>
            <div className="w-60 px-4 py-2 border border-border bg-panel shadow-lg rounded">
              <div className="flex items-center gap-2">
                <span className="text-text text-sm truncate">
                  {activeEntry.title}
                </span>
              </div>
            </div>
          </DragOverlay>
        )}
      </DndContext>
    </div>
  )
}

export const MediaColumns = memo(MediaColumnsInner)
