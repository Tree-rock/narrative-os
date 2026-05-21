// anti-patterns-lint-allow
// 本地 localStorage 经历存储（无需 Supabase 即可使用）
import type { ExperienceEntry } from "@/types/experience"

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const KEY = "narrative_experiences"

function readAll(): ExperienceEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

function writeAll(entries: ExperienceEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

export function localGetExperiences(): ExperienceEntry[] {
  return readAll().filter((entry) => !entry.archived).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function localGetAllExperiences(): ExperienceEntry[] {
  return readAll().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function localCreateExperience(
  data: Omit<ExperienceEntry, "id" | "created_at" | "updated_at">
): ExperienceEntry {
  const now = new Date().toISOString()
  const entry: ExperienceEntry = {
    ...data,
    id: genId(),
    created_at: now,
    updated_at: now,
  }
  writeAll([...readAll(), entry])
  return entry
}

export function localDeleteExperience(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id))
}

export function localArchiveExperience(id: string): ExperienceEntry | null {
  return localUpdateExperience(id, { archived: true })
}

export function localUpdateExperience(
  id: string,
  patch: Partial<ExperienceEntry>
): ExperienceEntry | null {
  const all = readAll()
  const idx = all.findIndex((e) => e.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
  writeAll(all)
  return all[idx]
}
