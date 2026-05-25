// anti-patterns-lint-allow
"use client"

import { useState, useEffect } from "react"
import { Pencil, Trash2, BookOpen, Eye, X, Check, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { narrativeGetAll, narrativeUpdate, narrativeDelete } from "@/lib/narrative-store"
import { wsToggleNarrative } from "@/lib/workspace-store"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import type { JDWorkspace } from "@/types/workspace"
import type { ExperienceEntry } from "@/types/experience"
import type { NarrativeEntry, NarrativeCategory } from "@/types/narrative"

// ─── Constants ────────────────────────────────────────────────
const CATEGORY_LABELS: Record<NarrativeCategory, string> = {
  behavioral:  "行为类",
  situational: "情景类",
  technical:   "技术类",
  company:     "动机类",
  general:     "通用",
}

const CATEGORY_COLORS: Record<NarrativeCategory, string> = {
  behavioral:  "bg-violet-50 text-violet-700 border-violet-200",
  situational: "bg-amber-50  text-amber-700  border-amber-200",
  technical:   "bg-sky-50    text-sky-700    border-sky-200",
  company:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  general:     "bg-muted text-muted-foreground border-border/40",
}

// ─── Review Mode Overlay ──────────────────────────────────────
function ReviewOverlay({
  narratives,
  ws,
  onClose,
}: {
  narratives: NarrativeEntry[]
  ws: JDWorkspace
  onClose: () => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-8 py-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground/50 tracking-wide mb-0.5">面试前复习</div>
          <h2 className="font-serif text-xl text-foreground font-normal">
            {ws.company} · {ws.position ?? ws.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
          退出复习
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-10 space-y-12">
        {narratives.length === 0 ? (
          <p className="text-center text-muted-foreground/50 py-20 text-sm">还没有激活任何叙事</p>
        ) : (
          narratives.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", CATEGORY_COLORS[n.category])}>
                  {CATEGORY_LABELS[n.category]}
                </span>
                {n.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[10px] text-muted-foreground/60">#{tag}</span>
                ))}
              </div>
              <h3 className="text-[18px] font-medium text-foreground leading-7">{n.title}</h3>
              <div className="text-[15px] text-foreground/80 leading-[1.9]">
                <MarkdownContent>{n.story}</MarkdownContent>
              </div>
              {i < narratives.length - 1 && (
                <div className="pt-4 border-b border-border/30" />
              )}
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  )
}

// ─── Single Narrative Card ────────────────────────────────────
function NarrativeCard({
  narrative,
  activated,
  onToggle,
  onSaved,
  onDelete,
}: {
  narrative: NarrativeEntry
  activated: boolean
  onToggle: () => void
  onSaved: (updated: NarrativeEntry) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(narrative.title)
  const [editStory, setEditStory] = useState(narrative.story)

  function handleSave() {
    const updated = narrativeUpdate(narrative.id, {
      title: editTitle.trim() || narrative.title,
      story: editStory.trim() || narrative.story,
    })
    if (updated) onSaved(updated)
    setEditing(false)
  }

  function handleCancelEdit() {
    setEditTitle(narrative.title)
    setEditStory(narrative.story)
    setEditing(false)
  }

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border transition-colors duration-150",
        activated
          ? "border-violet-400/40 bg-violet-500/[0.025]"
          : "border-border/50 bg-card"
      )}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Activate toggle */}
          <button
            onClick={onToggle}
            className={cn(
              "mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
              activated
                ? "bg-violet-600 border-violet-600"
                : "border-border/60 hover:border-violet-400"
            )}
            title={activated ? "取消激活" : "激活用于本次面试"}
          >
            {activated && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {editing ? (
              /* ── 编辑模式 ── */
              <div className="space-y-2">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-sm font-medium bg-muted/40 border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring/30"
                  placeholder="叙事标题"
                />
                <textarea
                  value={editStory}
                  onChange={(e) => setEditStory(e.target.value)}
                  rows={6}
                  className="w-full text-sm bg-muted/40 border border-border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-ring/30 leading-relaxed"
                  placeholder="叙事正文（支持 Markdown）"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-80 transition-opacity"
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              /* ── 阅读模式 ── */
              <>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-sm font-medium text-foreground leading-snug cursor-pointer flex-1"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {narrative.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditing(true); setExpanded(true) }}
                      className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={onDelete}
                      className="p-1 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 mt-1.5 cursor-pointer"
                  onClick={() => setExpanded((v) => !v)}
                >
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", CATEGORY_COLORS[narrative.category])}>
                    {CATEGORY_LABELS[narrative.category]}
                  </span>
                  {narrative.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] text-muted-foreground/50">#{tag}</span>
                  ))}
                  <span className="text-[10px] text-muted-foreground/40 ml-auto">
                    {expanded ? "收起" : "展开"}
                  </span>
                </div>

                {/* Expandable story */}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      key="story"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border/30 text-sm text-foreground/85 leading-relaxed">
                        <MarkdownContent compact>{narrative.story}</MarkdownContent>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main PrepTab ─────────────────────────────────────────────
export function PrepTab({
  ws,
  activatedExps: _activatedExps,
}: {
  ws: JDWorkspace
  activatedExps: ExperienceEntry[]
}) {
  const [narratives, setNarratives] = useState<NarrativeEntry[]>([])
  const [wsState, setWsState] = useState(ws)
  const [filterCat, setFilterCat] = useState<NarrativeCategory | "all">("all")
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => {
    setNarratives(narrativeGetAll())
  }, [])

  // Sync ws prop changes (e.g. after toggle)
  useEffect(() => { setWsState(ws) }, [ws])

  const activatedIds = new Set(wsState.activated_narrative_ids ?? [])

  function handleToggle(narrativeId: string) {
    const updated = wsToggleNarrative(wsState.id, narrativeId)
    if (updated) setWsState(updated)
  }

  function handleSaved(updated: NarrativeEntry) {
    setNarratives((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
  }

  function handleDelete(narrativeId: string) {
    narrativeDelete(narrativeId)
    setNarratives(narrativeGetAll())
  }

  const usedCategories = Array.from(new Set(narratives.map((n) => n.category)))
  const filtered = filterCat === "all" ? narratives : narratives.filter((n) => n.category === filterCat)
  const activatedNarratives = narratives.filter((n) => activatedIds.has(n.id))

  return (
    <>
      <AnimatePresence>
        {reviewing && (
          <ReviewOverlay
            narratives={activatedNarratives}
            ws={wsState}
            onClose={() => setReviewing(false)}
          />
        )}
      </AnimatePresence>

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[11px] text-muted-foreground/50 tracking-[0.08em] mb-0.5">叙事准备库</div>
            <div className="text-sm text-foreground">
              {narratives.length === 0
                ? "叙事库还是空的"
                : `共 ${narratives.length} 条 · ${activatedIds.size > 0 ? `${activatedIds.size} 条已激活用于本次面试` : "勾选叙事用于本次面试"}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activatedIds.size > 0 && (
              <button
                onClick={() => setReviewing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                进入复习
              </button>
            )}
          </div>
        </div>

        {/* Category filter */}
        {usedCategories.length > 1 && (
          <div className="px-6 pt-3 pb-1 flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              onClick={() => setFilterCat("all")}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                filterCat === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border/50 hover:border-border"
              )}
            >
              全部
            </button>
            {usedCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  filterCat === cat
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border/50 hover:border-border"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
              <div className="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-muted-foreground/40" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground/60">叙事库还是空的</p>
                <p className="text-xs text-muted-foreground/40 max-w-[220px] leading-relaxed">
                  在首页和 AI 教练整理面试故事，AI 检测到完整叙事后会提示存入叙事库
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity mt-1"
                >
                  去首页对话
                  <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((n) => (
                <NarrativeCard
                  key={n.id}
                  narrative={n}
                  activated={activatedIds.has(n.id)}
                  onToggle={() => handleToggle(n.id)}
                  onSaved={handleSaved}
                  onDelete={() => handleDelete(n.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  )
}
