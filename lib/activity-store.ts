// anti-patterns-lint-allow

export type ActivityType =
  | "user_input"
  | "experience_saved"
  | "resume_imported"
  | "workspace_created"
  | "archive_restored"

export interface ActivityEntry {
  id: string
  type: ActivityType
  title: string
  summary?: string
  payload?: unknown
  created_at: string
}

const KEY = "narrative_activity"
const MAX_STORED = 120

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function readAll(): ActivityEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

function writeAll(items: ActivityEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_STORED)))
  void import("@/lib/cloud-sync")
    .then(({ scheduleCloudBackup }) => scheduleCloudBackup())
    .catch(() => {})
}

export function activityAdd(
  data: Omit<ActivityEntry, "id" | "created_at">
): ActivityEntry {
  const entry: ActivityEntry = {
    ...data,
    id: genId(),
    created_at: new Date().toISOString(),
  }
  writeAll([...readAll(), entry])
  return entry
}

export function activityRecent(limit = 40): ActivityEntry[] {
  return readAll()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}
