// anti-patterns-lint-allow
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, Check, Loader2, Copy, RotateCcw, LayoutGrid, BookMarked } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { wsGet, wsToggleExperience, wsUpsertArtifact } from "@/lib/workspace-store"
import { localGetExperiences } from "@/lib/local-store"
import { appGetAll } from "@/lib/application-store"
import { getSettings } from "@/lib/settings"
import { LinkApplicationModal } from "@/components/applications/LinkApplicationModal"
import { PrepTab } from "@/components/workspaces/PrepTab"
import type { JDWorkspace, ArtifactType, WorkspaceStatus } from "@/types/workspace"
import type { ExperienceEntry } from "@/types/experience"
import type { ApplicationEntry } from "@/types/application"

// ─── Tab types ────────────────────────────────────────────────
type Tab = "overview" | "experiences" | "artifacts" | "prep"

const STATUS_META: Record<WorkspaceStatus, { label: string; className: string }> = {
  active: {
    label: "进行中",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  opportunity: {
    label: "等机会",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  learning: {
    label: "学习中",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  archived: {
    label: "已归档",
    className: "bg-muted text-muted-foreground border-border/60",
  },
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-medium text-muted-foreground/60 tracking-[0.08em] mb-4">
      {children}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────
function OverviewTab({ ws }: { ws: JDWorkspace }) {
  const jd = ws.parsed_jd
  if (!jd) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground/60">
        JD 解析数据缺失
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-10">
      {/* ① 精准 JD 要求（原文级，置顶） */}
      <section>
        <SectionTitle>关键要求</SectionTitle>
        <div className="space-y-3">
          {jd.key_requirements.map((req, i) => (
            <div key={i} className="grid grid-cols-[28px_1fr] gap-3 items-start text-[16px] leading-7 text-foreground">
              <span className="text-primary font-medium tabular-nums text-right">
                {i + 1}
              </span>
              <span>{req}</span>
            </div>
          ))}
        </div>
        {/* 关键词标签紧跟要求之后 */}
        {jd.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {jd.keywords.map((k) => (
              <span
                key={k}
                className="text-xs px-3 py-1 rounded-full bg-muted/70 text-muted-foreground border border-border/30"
              >
                {k}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ② AI 对 JD 的解读（概述、文化、注意事项） */}
      <section>
        <SectionTitle>AI 解读</SectionTitle>
        <p className="text-[16px] text-muted-foreground leading-8 max-w-2xl">
          {jd.summary}
        </p>
      </section>

      {jd.culture_signals.length > 0 && (
        <section>
          <SectionTitle>文化信号</SectionTitle>
          <div className="space-y-3">
            {jd.culture_signals.map((s, i) => (
              <div key={i} className="grid grid-cols-[28px_1fr] gap-3 items-start text-[15px] leading-7 text-muted-foreground">
                <span className="text-right text-muted-foreground/60">·</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {jd.red_flags.length > 0 && (
        <section>
          <SectionTitle>注意事项</SectionTitle>
          <div className="space-y-3">
            {jd.red_flags.map((f, i) => (
              <div key={i} className="grid grid-cols-[28px_1fr] gap-3 items-start text-[15px] leading-7 text-muted-foreground">
                <span className="text-right text-amber-500">!</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <details className="group pt-1">
        <summary className="text-sm text-muted-foreground/50 hover:text-muted-foreground cursor-pointer select-none transition-colors">
          查看原始 JD
        </summary>
        <pre className="mt-4 text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap font-sans bg-muted/30 rounded-xl border border-border/40 p-4 max-h-60 overflow-y-auto">
          {ws.jd_text}
        </pre>
      </details>
    </div>
  )
}

// ─── Experiences Tab ──────────────────────────────────────────
function ExperiencesTab({
  ws,
  experiences,
  onToggle,
}: {
  ws: JDWorkspace
  experiences: ExperienceEntry[]
  onToggle: (expId: string) => void
}) {
  const activated = new Set(ws.activated_experience_ids)

  if (experiences.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground/60 mb-2">经历库还是空的</p>
        <a href="/experiences" className="text-sm text-primary hover:underline">
          去经历库添加经历 →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-xs text-muted-foreground/60 mb-4">
        选择与该职位匹配的经历，激活后才能用于生成打招呼语和面试材料。
        已激活：{activated.size} 条
      </p>
      {experiences.map((exp) => {
        const isActive = activated.has(exp.id)
        return (
          <motion.div
            key={exp.id}
            layout
            className={cn(
              "narrative-card p-4 cursor-pointer transition-all duration-150 select-none",
              isActive
                ? "border-primary/40 bg-accent ring-1 ring-primary/15"
                : "hover:border-border"
            )}
            onClick={() => onToggle(exp.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground leading-snug">
                    {exp.project_name ?? exp.raw_input.slice(0, 40) + "…"}
                  </span>
                  {exp.time_period && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {exp.time_period}
                    </span>
                  )}
                </div>
                {exp.v_concise && (
                  <p className="text-xs text-muted-foreground/80 leading-relaxed mb-2">
                    {exp.v_concise}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(exp.skills ?? []).slice(0, 4).map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                      {s}
                    </span>
                  ))}
                  {exp.metrics && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                      ✦ {exp.metrics}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all",
                  isActive
                    ? "bg-primary border-primary"
                    : "border-border/60"
                )}
              >
                {isActive && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Artifact block ───────────────────────────────────────────
const ARTIFACT_META: Record<ArtifactType, { label: string; desc: string }> = {
  greeting:       { label: "打招呼语",   desc: "给 HR / 猎头 / 内推人的第一封消息" },
  interview_prep: { label: "面试准备",   desc: "基于 JD 要求的 STAR 回答框架" },
  resume_bullets: { label: "简历 Bullets", desc: "与该 JD 高度匹配的简历条目" },
}

function ArtifactBlock({
  type,
  ws,
  activatedExps,
  onSaved,
}: {
  type: ArtifactType
  ws: JDWorkspace
  activatedExps: ExperienceEntry[]
  onSaved: (type: ArtifactType, content: string) => void
}) {
  const existing = ws.artifacts.find((a) => a.type === type)
  const [content, setContent] = useState(existing?.content ?? "")
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const meta = ARTIFACT_META[type]

  // Sync when ws.artifacts changes externally
  useEffect(() => {
    const found = ws.artifacts.find((a) => a.type === type)
    if (found && !streaming) setContent(found.content)
  }, [ws.artifacts, type, streaming])

  const handleGenerate = useCallback(async () => {
    if (!ws.parsed_jd || activatedExps.length === 0) return
    setError("")
    setContent("")
    setStreaming(true)
    abortRef.current = new AbortController()

    const s = getSettings()
    let fullText = ""

    try {
      const res = await fetch("/api/ai/artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          type,
          jd: ws.parsed_jd,
          experiences: activatedExps,
          provider: s.provider,
          apiKey: s.apiKeys[s.provider] ?? "",
        }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? "生成失败")
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue
          const raw = part.slice(6).trim()
          if (raw === "[DONE]") continue
          try {
            const chunk = JSON.parse(raw) as { text?: string; error?: string }
            if (chunk.error) throw new Error(chunk.error)
            if (chunk.text) {
              fullText += chunk.text
              setContent(fullText)
            }
          } catch (parseErr) {
            if ((parseErr as Error).message !== "Unexpected token") throw parseErr
          }
        }
      }

      // Save to workspace store
      const saved = wsUpsertArtifact(ws.id, type, fullText)
      if (saved) onSaved(type, fullText)
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "生成失败，请重试")
      }
    } finally {
      setStreaming(false)
    }
  }, [ws, type, activatedExps, onSaved])

  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canGenerate = !!ws.parsed_jd && activatedExps.length > 0

  return (
    <div className="narrative-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
        <div>
          <div className="text-sm font-medium text-foreground">{meta.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{meta.desc}</div>
        </div>
        <div className="flex items-center gap-2">
          {content && !streaming && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
                {copied ? "已复制" : "复制"}
              </button>
              <button
                onClick={handleGenerate}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="重新生成"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </>
          )}
          {!content && !streaming && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all",
                canGenerate
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              生成
            </button>
          )}
          {streaming && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              停止
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {error && (
          <p className="text-xs text-destructive mb-3">{error}</p>
        )}
        {!content && !streaming && !error && (
          <p className="text-sm text-muted-foreground/40 py-4">
            {canGenerate
              ? "点击「生成」按钮开始…"
              : activatedExps.length === 0
                ? "请先在「经历激活」中选择匹配的经历"
                : "JD 解析数据缺失"}
          </p>
        )}
        {(content || streaming) && (
          <MarkdownContent streaming={streaming}>
            {content}
          </MarkdownContent>
        )}
      </div>
    </div>
  )
}

// ─── Artifacts Tab ────────────────────────────────────────────
function ArtifactsTab({
  ws,
  activatedExps,
  onArtifactSaved,
}: {
  ws: JDWorkspace
  activatedExps: ExperienceEntry[]
  onArtifactSaved: (type: ArtifactType, content: string) => void
}) {
  const TYPES: ArtifactType[] = ["greeting", "interview_prep", "resume_bullets"]

  return (
    <div className="space-y-4 max-w-2xl">
      {activatedExps.length === 0 && (
        <div className="narrative-card p-4 bg-accent/40">
          <p className="text-xs text-muted-foreground">
            还没有激活任何经历。切换到「经历激活」标签，选择与该职位匹配的经历，才能生成内容。
          </p>
        </div>
      )}
      {TYPES.map((type) => (
        <ArtifactBlock
          key={type}
          type={type}
          ws={ws}
          activatedExps={activatedExps}
          onSaved={onArtifactSaved}
        />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ws, setWs] = useState<JDWorkspace | null>(null)
  const [allExps, setAllExps] = useState<ExperienceEntry[]>([])
  const [tab, setTab] = useState<Tab>("overview")
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkedApp, setLinkedApp] = useState<ApplicationEntry | null>(null)

  useEffect(() => {
    const found = wsGet(id)
    if (!found) { router.replace("/workspaces"); return }
    setWs(found)
    setAllExps(localGetExperiences())
    setLinkedApp(appGetAll().find((a) => a.workspace_id === id) ?? null)
  }, [id, router])

  function handleToggleExp(expId: string) {
    const updated = wsToggleExperience(id, expId)
    if (updated) setWs(updated)
  }

  function handleArtifactSaved(type: ArtifactType, content: string) {
    setWs((prev) => {
      if (!prev) return prev
      const artifacts = prev.artifacts.filter((a) => a.type !== type)
      return {
        ...prev,
        artifacts: [...artifacts, { type, content, generated_at: new Date().toISOString() }],
      }
    })
  }

  if (!ws) return null

  const activatedExps = allExps.filter((e) => ws.activated_experience_ids.includes(e.id))
  const statusMeta = STATUS_META[ws.status] ?? STATUS_META.active

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview",     label: "概览" },
    { id: "experiences",  label: "经历激活", badge: ws.activated_experience_ids.length || undefined },
    { id: "artifacts",    label: "生成产物", badge: ws.artifacts.length || undefined },
    { id: "prep",         label: "叙事准备" },
  ]

  return (
    <div className={cn("mx-auto px-8 py-8", tab === "prep" ? "max-w-6xl" : "max-w-4xl")}>
      {/* Back + Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/workspaces")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Workspaces
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-foreground font-normal leading-none">
              {ws.title}
            </h1>
            {ws.company && (
              <p className="text-sm text-muted-foreground mt-1">{ws.company}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <span className={cn("text-[11px] px-2.5 py-1 rounded-full border", statusMeta.className)}>
              {statusMeta.label}
            </span>
            {linkedApp ? (
              <Link
                href="/applications"
                className="flex items-center gap-1.5 text-xs text-primary hover:opacity-70 transition-opacity px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5"
              >
                <LayoutGrid className="w-3 h-3" strokeWidth={1.5} />
                查看追踪
              </Link>
            ) : (
              <button
                onClick={() => setShowLinkModal(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full border border-border/60 hover:border-border transition-all"
              >
                <LayoutGrid className="w-3 h-3" strokeWidth={1.5} />
                追踪投递
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 border-b border-border/40 pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm transition-colors duration-150",
              tab === t.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-1.5">
              {t.label}
              {t.badge !== undefined && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {t.badge}
                </span>
              )}
            </span>
            {tab === t.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary rounded-full"
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Link Application Modal */}
      <AnimatePresence>
        {showLinkModal && (
          <LinkApplicationModal
            workspace={ws}
            onClose={() => setShowLinkModal(false)}
            onSaved={() => {
              setLinkedApp(appGetAll().find((a) => a.workspace_id === id) ?? null)
            }}
          />
        )}
      </AnimatePresence>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className={tab === "prep" ? "h-[calc(100vh-260px)] min-h-[520px]" : undefined}
        >
          {tab === "overview" && <OverviewTab ws={ws} />}
          {tab === "experiences" && (
            <ExperiencesTab ws={ws} experiences={allExps} onToggle={handleToggleExp} />
          )}
          {tab === "artifacts" && (
            <ArtifactsTab
              ws={ws}
              activatedExps={activatedExps}
              onArtifactSaved={handleArtifactSaved}
            />
          )}
          {tab === "prep" && (
            <div className="h-full border border-border/40 rounded-2xl overflow-hidden bg-card">
              <PrepTab ws={ws} activatedExps={activatedExps} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
