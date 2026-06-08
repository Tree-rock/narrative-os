// anti-patterns-lint-allow
import type { JDWorkspace, WorkspaceArtifact, ArtifactType } from "@/types/workspace"

const KEY = "narrative_workspaces"

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function readAll(): JDWorkspace[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

function writeAll(items: JDWorkspace[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
  void import("@/lib/cloud-sync")
    .then(({ scheduleCloudBackup }) => scheduleCloudBackup())
    .catch(() => {})
}

export function wsGetAll(): JDWorkspace[] {
  return readAll().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function wsGetVisible(): JDWorkspace[] {
  return wsGetAll().filter((w) => w.status !== "archived")
}

export function wsGet(id: string): JDWorkspace | null {
  return readAll().find((w) => w.id === id) ?? null
}

export function wsCreate(
  data: Pick<JDWorkspace, "title" | "company" | "position" | "jd_text" | "parsed_jd">
): JDWorkspace {
  const now = new Date().toISOString()
  const ws: JDWorkspace = {
    ...data,
    id: genId(),
    activated_experience_ids: [],
    artifacts: [],
    status: "active",
    locked: false,
    created_at: now,
    updated_at: now,
  }
  writeAll([...readAll(), ws])
  return ws
}

export function wsUpdate(id: string, patch: Partial<JDWorkspace>): JDWorkspace | null {
  const all = readAll()
  const idx = all.findIndex((w) => w.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
  writeAll(all)
  return all[idx]
}

export function wsDelete(id: string): void {
  writeAll(readAll().filter((w) => w.id !== id))
}

export function wsToggleExperience(id: string, expId: string): JDWorkspace | null {
  const ws = wsGet(id)
  if (!ws) return null
  const ids = ws.activated_experience_ids
  const next = ids.includes(expId)
    ? ids.filter((x) => x !== expId)
    : [...ids, expId]
  return wsUpdate(id, { activated_experience_ids: next })
}

export function wsUpsertArtifact(
  id: string,
  type: ArtifactType,
  content: string
): JDWorkspace | null {
  const ws = wsGet(id)
  if (!ws) return null
  const artifact: WorkspaceArtifact = { type, content, generated_at: new Date().toISOString() }
  const artifacts = ws.artifacts.filter((a) => a.type !== type)
  return wsUpdate(id, { artifacts: [...artifacts, artifact] })
}
