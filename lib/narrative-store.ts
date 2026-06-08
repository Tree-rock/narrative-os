// anti-patterns-lint-allow
import type { NarrativeEntry, NarrativeCategory } from "@/types/narrative"

const KEY = "narrative_narratives"

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function readAll(): NarrativeEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

function writeAll(items: NarrativeEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function narrativeGetAll(): NarrativeEntry[] {
  return readAll().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function narrativeCreate(data: {
  title: string
  story: string
  category: NarrativeCategory
  tags?: string[]
  experience_id?: string
  source_excerpt?: string
}): NarrativeEntry {
  const now = new Date().toISOString()
  const entry: NarrativeEntry = {
    ...data,
    tags: data.tags ?? [],
    id: genId(),
    created_at: now,
    updated_at: now,
  }
  writeAll([...readAll(), entry])
  return entry
}

export function narrativeUpdate(id: string, patch: Partial<NarrativeEntry>): NarrativeEntry | null {
  const all = readAll()
  const idx = all.findIndex((n) => n.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
  writeAll(all)
  return all[idx]
}

export function narrativeDelete(id: string): void {
  writeAll(readAll().filter((n) => n.id !== id))
}
