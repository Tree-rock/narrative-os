// anti-patterns-lint-allow
import { createClient } from "@/lib/supabase/client"

type CloudKey =
  | "narrative_experiences"
  | "narrative_workspaces"
  | "narrative_chat"
  | "narrative_activity"

type CloudBlob = {
  key: CloudKey
  payload: unknown
  updated_at?: string
}

const CLOUD_KEYS: CloudKey[] = [
  "narrative_experiences",
  "narrative_workspaces",
  "narrative_chat",
  "narrative_activity",
]

let backupTimer: ReturnType<typeof setTimeout> | null = null

function readJson(key: CloudKey): unknown {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]")
  } catch {
    return []
  }
}

function writeJson(key: CloudKey, value: unknown) {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

function getItemTime(item: Record<string, unknown>) {
  const raw = item.updated_at ?? item.created_at ?? item.createdAt
  const time = typeof raw === "string" ? new Date(raw).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function mergeArrays(localValue: unknown, cloudValue: unknown) {
  const local = Array.isArray(localValue) ? localValue : []
  const cloud = Array.isArray(cloudValue) ? cloudValue : []
  const byId = new Map<string, Record<string, unknown>>()
  const anonymous: unknown[] = []

  for (const item of [...cloud, ...local]) {
    if (!item || typeof item !== "object") {
      anonymous.push(item)
      continue
    }
    const record = item as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id : ""
    if (!id) {
      anonymous.push(item)
      continue
    }
    const existing = byId.get(id)
    if (!existing || getItemTime(record) >= getItemTime(existing)) {
      byId.set(id, record)
    }
  }

  return [...byId.values(), ...anonymous].sort((a, b) => {
    if (!a || typeof a !== "object" || !b || typeof b !== "object") return 0
    return getItemTime(b as Record<string, unknown>) - getItemTime(a as Record<string, unknown>)
  })
}

function mergeValue(localValue: unknown, cloudValue: unknown) {
  if (Array.isArray(localValue) || Array.isArray(cloudValue)) {
    return mergeArrays(localValue, cloudValue)
  }
  return localValue ?? cloudValue ?? []
}

export async function getCurrentUserEmail() {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? null
}

export async function pullAndMergeCloudData() {
  const supabase = createClient()
  if (!supabase) return { ok: false, reason: "missing-env" as const }

  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return { ok: false, reason: "signed-out" as const }

  const { data, error } = await supabase
    .from("user_data_blobs")
    .select("key,payload,updated_at")
    .in("key", CLOUD_KEYS)

  if (error) return { ok: false, reason: "select-error" as const, error }

  const remote = new Map((data as CloudBlob[] | null ?? []).map((row) => [row.key, row.payload]))
  for (const key of CLOUD_KEYS) {
    const merged = mergeValue(readJson(key), remote.get(key))
    writeJson(key, merged)
  }

  await cloudBackupNow()
  window.dispatchEvent(new CustomEvent("narrative-cloud-synced"))
  return { ok: true as const }
}

export async function cloudBackupNow() {
  const supabase = createClient()
  if (!supabase) return { ok: false, reason: "missing-env" as const }

  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return { ok: false, reason: "signed-out" as const }

  const rows = CLOUD_KEYS.map((key) => ({
    user_id: user.id,
    key,
    payload: readJson(key),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from("user_data_blobs")
    .upsert(rows, { onConflict: "user_id,key" })

  if (error) return { ok: false, reason: "upsert-error" as const, error }
  return { ok: true as const }
}

export function scheduleCloudBackup(delay = 900) {
  if (typeof window === "undefined") return
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(() => {
    backupTimer = null
    void cloudBackupNow()
  }, delay)
}
