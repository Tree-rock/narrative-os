// anti-patterns-lint-allow
import type { PrepNote, PrepCategory } from "@/types/prep"

const KEY = "narrative_prep_notes"

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function readAll(): PrepNote[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

function writeAll(items: PrepNote[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function prepGetByWorkspace(workspaceId: string): PrepNote[] {
  return readAll()
    .filter((n) => n.workspace_id === workspaceId)
    .sort((a, b) => {
      // 置顶优先，其次按时间倒序
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
}

export function prepCreate(data: {
  workspace_id: string
  question: string
  answer: string
  category: PrepCategory
  experience_ids?: string[]
}): PrepNote {
  const now = new Date().toISOString()
  const note: PrepNote = {
    ...data,
    id: genId(),
    pinned: false,
    created_at: now,
    updated_at: now,
  }
  writeAll([...readAll(), note])
  return note
}

export function prepUpdate(id: string, patch: Partial<PrepNote>): PrepNote | null {
  const all = readAll()
  const idx = all.findIndex((n) => n.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
  writeAll(all)
  return all[idx]
}

export function prepTogglePin(id: string): PrepNote | null {
  const all = readAll()
  const idx = all.findIndex((n) => n.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], pinned: !all[idx].pinned, updated_at: new Date().toISOString() }
  writeAll(all)
  return all[idx]
}

export function prepDelete(id: string): void {
  writeAll(readAll().filter((n) => n.id !== id))
}
