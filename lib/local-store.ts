// anti-patterns-lint-allow
// 本地 localStorage 经历存储（无需 Supabase 即可使用）
import type { ExperienceEntry, ExperienceSourceMessage } from "@/types/experience"

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
  void import("@/lib/cloud-sync")
    .then(({ scheduleCloudBackup }) => scheduleCloudBackup())
    .catch(() => {})
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

// ─── 补充已有经历（联合数组、追加来源、更新叙事版本）──────────
type EnrichData = {
  skills?: string[]
  results?: string[]
  actions?: string[]
  metrics?: string
  source_excerpt?: string
  source_messages?: ExperienceSourceMessage[]
  source_chat_message_ids?: string[]
  v_summary?: string
  v_star?: string
  v_concise?: string
  v_chat?: string
  raw_input?: string
  emotions?: string
  values?: string
  turning_pt?: string
}

export function localEnrichExperience(
  id: string,
  data: EnrichData
): ExperienceEntry | null {
  const all = readAll()
  const idx = all.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const ex = all[idx]

  function unionArr(a: string[] | undefined, b: string[] | undefined): string[] {
    return Array.from(new Set([...(a ?? []), ...(b ?? [])]))
  }

  const dateLabel = new Date().toLocaleDateString("zh-CN")

  all[idx] = {
    ...ex,
    // 数组字段取并集去重
    skills:  unionArr(ex.skills,  data.skills),
    results: unionArr(ex.results, data.results),
    actions: unionArr(ex.actions, data.actions),
    // 来源消息追加
    source_messages: [
      ...(ex.source_messages ?? []),
      ...(data.source_messages ?? []),
    ],
    source_chat_message_ids: Array.from(new Set([
      ...(ex.source_chat_message_ids ?? []),
      ...(data.source_chat_message_ids ?? []),
    ])),
    // source_excerpt 追加（带日期分隔）
    source_excerpt: data.source_excerpt
      ? [ex.source_excerpt, `[补充于 ${dateLabel}]\n${data.source_excerpt}`]
          .filter(Boolean).join("\n---\n")
      : ex.source_excerpt,
    // 原始输入追加
    raw_input: data.raw_input
      ? [ex.raw_input, data.raw_input].filter(Boolean).join("\n\n---\n\n")
      : ex.raw_input,
    // 叙事版本：有新值则覆盖（对话整理通常更精炼）
    v_summary:  data.v_summary  ?? ex.v_summary,
    v_star:     data.v_star     ?? ex.v_star,
    v_concise:  data.v_concise  ?? ex.v_concise,
    v_chat:     data.v_chat     ?? ex.v_chat,
    // metrics 取更长的（信息更丰富）
    metrics: data.metrics
      ? (data.metrics.length >= (ex.metrics?.length ?? 0) ? data.metrics : ex.metrics)
      : ex.metrics,
    // 空字段才填入
    emotions:   ex.emotions   ?? data.emotions,
    values:     ex.values     ?? data.values,
    turning_pt: ex.turning_pt ?? data.turning_pt,
    updated_at: new Date().toISOString(),
  }
  writeAll(all)
  return all[idx]
}
