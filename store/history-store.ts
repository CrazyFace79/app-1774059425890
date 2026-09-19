import { create } from "zustand"
import { db, type HistoryEntry } from "@/lib/database"

interface HistoryState {
  entries: HistoryEntry[]
  isLoading: boolean
  searchQuery: string
  filterPinned: boolean
  loadHistory: () => Promise<void>
  addEntry: (entry: Omit<HistoryEntry, "id" | "timestamp">) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  setSearchQuery: (query: string) => void
  setFilterPinned: (filter: boolean) => void
  getFilteredEntries: () => HistoryEntry[]
  exportHistoryCSV: () => string
  exportHistoryJSON: () => string
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  isLoading: false,
  searchQuery: "",
  filterPinned: false,

  loadHistory: async () => {
    set({ isLoading: true })
    try {
      const entries = await db.history.orderBy("timestamp").reverse().toArray()
      set({ entries, isLoading: false })
    } catch (error) {
      console.error("Failed to load history:", error)
      set({ isLoading: false })
    }
  },

  addEntry: async (entryData) => {
    const entry: HistoryEntry = {
      ...entryData,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }

    await db.history.add(entry)
    set((state) => ({ entries: [entry, ...state.entries].slice(0, 1000) }))
  },

  removeEntry: async (id) => {
    await db.history.delete(id)
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }))
  },

  togglePin: async (id) => {
    const entry = await db.history.get(id)
    if (entry) {
      const pinned = !entry.pinned
      await db.history.update(id, { pinned })
      set((state) => ({
        entries: state.entries.map((e) => (e.id === id ? { ...e, pinned } : e)),
      }))
    }
  },

  clearHistory: async () => {
    await db.history.clear()
    set({ entries: [] })
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilterPinned: (filter) => set({ filterPinned: filter }),

  getFilteredEntries: () => {
    const { entries, searchQuery, filterPinned } = get()
    let filtered = entries

    if (filterPinned) {
      filtered = filtered.filter((entry) => entry.pinned)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (entry) =>
          entry.style.toLowerCase().includes(query) ||
          entry.lyrics.toLowerCase().includes(query) ||
          entry.key.toLowerCase().includes(query) ||
          entry.presetId.toLowerCase().includes(query),
      )
    }

    return filtered
  },

  exportHistoryCSV: () => {
    const { entries } = get()
    const headers = ["id", "timestamp", "bpm", "key", "presetId", "lengthChars"]
    const rows = entries.map((entry) => [
      entry.id,
      entry.timestamp,
      entry.bpm.toString(),
      entry.key,
      entry.presetId,
      (entry.style.length + entry.lyrics.length).toString(),
    ])

    return [headers, ...rows].map((row) => row.join(",")).join("\n")
  },

  exportHistoryJSON: () => {
    const { entries } = get()
    return JSON.stringify(entries, null, 2)
  },
}))
