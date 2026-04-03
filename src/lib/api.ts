import { invoke } from '@tauri-apps/api/core'
import type { MediaEntry, ListType } from '../types'

export interface FetchEntriesResponse {
  entries: MediaEntry[]
  error?: string
}

export interface CreateEntryResponse {
  entry?: MediaEntry
  error?: string
}

// Normalize entry from Rust backend format (snake_case timestamps as strings → Date objects)
function normalizeEntry(raw: any): MediaEntry {
  return {
    ...raw,
    // Rust sends mediaType but frontend expects type via the JSON rename
    type: raw.mediaType ?? raw.type ?? raw.media_type,
    list: raw.list ?? raw.listType ?? raw.list_type,
    createdAt: new Date(raw.createdAt ?? raw.created_at),
    updatedAt: new Date(raw.updatedAt ?? raw.updated_at),
  }
}

export async function fetchEntries(listType: ListType): Promise<FetchEntriesResponse> {
  try {
    const entries = await invoke<any[]>('get_entries', { listType })
    return { entries: entries.map(normalizeEntry) }
  } catch (error) {
    console.error('get_entries error:', error)
    return { entries: [], error: String(error) }
  }
}

export async function createEntry(
  entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId' | 'updatedAt'>
): Promise<CreateEntryResponse> {
  try {
    const raw = await invoke<any>('create_entry', {
      entry: {
        title: entry.title,
        type: entry.type,
        status: entry.status,
        year: entry.year,
        list: entry.list,
        seasonsCompleted: entry.seasonsCompleted ?? null,
        coverUrl: entry.coverUrl ?? null,
        releaseDate: entry.releaseDate ?? null,
        completedAt: entry.completedAt ?? null,
      },
    })
    return { entry: normalizeEntry(raw) }
  } catch (error) {
    console.error('create_entry error:', error)
    return { error: String(error) }
  }
}

export async function updateEntry(
  id: string,
  updates: Partial<MediaEntry>
): Promise<{ entry?: MediaEntry; error?: string }> {
  try {
    const raw = await invoke<any>('update_entry', {
      id,
      updates: {
        title: updates.title ?? null,
        type: updates.type ?? null,
        status: updates.status ?? null,
        year: updates.year ?? null,
        list: updates.list ?? null,
        seasonsCompleted: updates.seasonsCompleted ?? null,
        coverUrl: updates.coverUrl ?? null,
        releaseDate: updates.releaseDate ?? null,
        completedAt: updates.completedAt ?? null,
      },
    })
    return { entry: normalizeEntry(raw) }
  } catch (error) {
    console.error('update_entry error:', error)
    return { error: String(error) }
  }
}

export async function deleteEntry(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await invoke('delete_entry', { id })
    return { success: true }
  } catch (error) {
    console.error('delete_entry error:', error)
    return { error: String(error) }
  }
}
