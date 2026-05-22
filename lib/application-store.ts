// anti-patterns-lint-allow
import type { ApplicationEntry } from "@/types/application"

const KEY = "narrative_applications"

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function readAll(): ApplicationEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

function writeAll(items: ApplicationEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function appGetAll(): ApplicationEntry[] {
  return readAll().sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
}

export function appCreate(
  data: Omit<ApplicationEntry, "id" | "created_at" | "updated_at">
): ApplicationEntry {
  const now = new Date().toISOString()
  const entry: ApplicationEntry = { ...data, id: genId(), created_at: now, updated_at: now }
  writeAll([...readAll(), entry])
  return entry
}

export function appUpdate(
  id: string,
  patch: Partial<Omit<ApplicationEntry, "id" | "created_at">>
): ApplicationEntry | null {
  const all = readAll()
  const idx = all.findIndex((a) => a.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
  writeAll(all)
  return all[idx]
}

export function appDelete(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id))
}
