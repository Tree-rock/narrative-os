// anti-patterns-lint-allow
"use client"

import { useState, useEffect } from "react"
import { Plus, Briefcase, Loader2, X, ChevronRight, Archive, Pencil, Lock, Unlock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { wsCreate, wsGetVisible, wsUpdate } from "@/lib/workspace-store"
import { getSettings } from "@/lib/settings"
import type { JDWorkspace, ParsedJD, WorkspaceStatus } from "@/types/workspace"

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

function linesToList(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean)
}

function listToLines(value?: string[]): string {
  return (value ?? []).join("\n")
}

// ─── Create Modal ─────────────────────────────────────────────
function CreateWorkspaceModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (ws: JDWorkspace) => void
}) {
  const [jdText, setJdText] = useState("")
  const [step, setStep] = useState<"input" | "analyzing">("input")
  const [error, setError] = useState("")

  async function handleAnalyze() {
    if (!jdText.trim()) return
    setError("")
    setStep("analyzing")

    const s = getSettings()
    try {
      const res = await fetch("/api/ai/analyze-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd_text: jdText,
          provider: s.provider,
          apiKey: s.apiKeys[s.provider] ?? "",
        }),
      })
      const data = await res.json() as ParsedJD & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? "解析失败")

      const ws = wsCreate({
        title: data.title ?? "未命名职位",
        company: data.company,
        position: data.title,
        jd_text: jdText,
        parsed_jd: data,
      })
      onCreated(ws)
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败，请重试")
      setStep("input")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="absolute inset-0 bg-foreground/10 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative z-10 w-full max-w-xl bg-card rounded-2xl border border-border/60 shadow-2xl shadow-foreground/5 overflow-hidden"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="font-serif text-lg text-foreground font-normal">新建 Workspace</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "input" ? "粘贴目标 JD，AI 会自动解析职位信息。" : "AI 正在解析 JD……"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            {step === "input" ? (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <textarea
                  autoFocus
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder={"粘贴完整的 JD 内容……\n\n支持中英文、任意格式。"}
                  rows={10}
                  className="w-full resize-none bg-muted/30 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
                />
                {error && <p className="text-xs text-destructive mt-2">{error}</p>}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={!jdText.trim()}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all",
                      jdText.trim()
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    AI 解析 JD →
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <Loader2 className="w-7 h-7 text-primary animate-spin" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">正在提取 JD 结构……</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────
function EditWorkspaceModal({
  ws,
  onClose,
  onSaved,
}: {
  ws: JDWorkspace
  onClose: () => void
  onSaved: (ws: JDWorkspace) => void
}) {
  const [form, setForm] = useState({
    title: ws.title,
    company: ws.company ?? "",
    position: ws.position ?? "",
    status: ws.status,
    jd_text: ws.jd_text,
    summary: ws.parsed_jd?.summary ?? "",
    keywords: (ws.parsed_jd?.keywords ?? []).join(", "),
    key_requirements: listToLines(ws.parsed_jd?.key_requirements),
    culture_signals: listToLines(ws.parsed_jd?.culture_signals),
    red_flags: listToLines(ws.parsed_jd?.red_flags),
  })
  const [locked, setLocked] = useState(ws.locked ?? false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    const parsed_jd: ParsedJD = {
      title: form.position || form.title,
      company: form.company,
      summary: form.summary,
      keywords: form.keywords.split(",").map((item) => item.trim()).filter(Boolean),
      key_requirements: linesToList(form.key_requirements),
      culture_signals: linesToList(form.culture_signals),
      red_flags: linesToList(form.red_flags),
    }
    const updated = wsUpdate(ws.id, {
      title: form.title || "未命名职位",
      company: form.company,
      position: form.position,
      status: form.status,
      jd_text: form.jd_text,
      parsed_jd,
      locked,
    })
    if (updated) onSaved(updated)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="absolute inset-0 bg-foreground/10 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative z-10 w-full max-w-2xl bg-card rounded-2xl border border-border/60 shadow-2xl shadow-foreground/5 flex flex-col max-h-[90vh]"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <div>
            <h2 className="font-serif text-lg text-foreground font-normal">编辑 JD</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              手动调整后可锁定，避免后续被自动流程覆盖。
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">基本信息</div>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="职位标题"
              className="w-full text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all font-medium"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="公司"
                className="text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
              />
              <input
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
                placeholder="岗位"
                className="text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["active", "opportunity", "learning"] as WorkspaceStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => set("status", status)}
                  className={cn(
                    "h-9 rounded-xl border text-xs transition-all",
                    form.status === status
                      ? STATUS_META[status].className
                      : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30"
                  )}
                >
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">职位概述</div>
            <textarea
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={3}
              placeholder="一句话概括这个 JD"
              className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
            />
          </div>

          <div>
            <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">关键词</div>
            <input
              value={form.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="用逗号分隔，如：增长, SQL, 用户研究"
              className="w-full text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
            />
          </div>

          <div>
            <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">关键要求</div>
            <textarea
              value={form.key_requirements}
              onChange={(e) => set("key_requirements", e.target.value)}
              rows={5}
              placeholder="每行一条要求"
              className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">文化信号</div>
              <textarea
                value={form.culture_signals}
                onChange={(e) => set("culture_signals", e.target.value)}
                rows={4}
                placeholder="每行一条"
                className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
              />
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">注意事项</div>
              <textarea
                value={form.red_flags}
                onChange={(e) => set("red_flags", e.target.value)}
                rows={4}
                placeholder="每行一条"
                className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">原始 JD</div>
            <textarea
              value={form.jd_text}
              onChange={(e) => set("jd_text", e.target.value)}
              rows={8}
              className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 shrink-0">
          <button
            type="button"
            onClick={() => setLocked((v) => !v)}
            className={cn(
              "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all duration-150",
              locked
                ? "border-primary/40 text-primary bg-primary/5"
                : "border-border/60 text-muted-foreground hover:border-border"
            )}
          >
            {locked
              ? <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
              : <Unlock className="w-3.5 h-3.5" strokeWidth={1.5} />}
            {locked ? "已锁定" : "锁定此 JD"}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              取消
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity">
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Workspace card ───────────────────────────────────────────
function WorkspaceCard({
  ws,
  onArchive,
  onEdit,
  onToggleLock,
}: {
  ws: JDWorkspace
  onArchive: (id: string) => void
  onEdit: (ws: JDWorkspace) => void
  onToggleLock: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const keywords = ws.parsed_jd?.keywords ?? []
  const statusMeta = STATUS_META[ws.status] ?? STATUS_META.active

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "narrative-card p-5 group transition-all",
        ws.locked && "border-primary/20 bg-accent/20"
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-start justify-between gap-4">
        <Link href={`/workspaces/${ws.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1">
            {ws.locked && (
              <Lock className="w-3 h-3 text-primary/60 shrink-0" strokeWidth={1.5} />
            )}
            <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {ws.title}
            </h3>
            <span className={cn("text-[11px] px-2 py-0.5 rounded-full border shrink-0", statusMeta.className)}>
              {statusMeta.label}
            </span>
          </div>
          {ws.company && (
            <p className="text-xs text-muted-foreground mb-3">{ws.company}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {keywords.slice(0, 4).map((k) => (
                <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {k}
                </span>
              ))}
            </div>
            {ws.activated_experience_ids.length > 0 && (
              <span className="text-[11px] text-muted-foreground/60 shrink-0">
                {ws.activated_experience_ids.length} 条经历已激活
              </span>
            )}
          </div>
          {ws.parsed_jd?.summary && (
            <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed line-clamp-1">
              {ws.parsed_jd.summary}
            </p>
          )}
        </Link>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity duration-150",
              hover ? "opacity-100" : "opacity-0"
            )}
          >
            <button
              onClick={() => onEdit(ws)}
              title="编辑"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onToggleLock(ws.id)}
              title={ws.locked ? "解锁" : "锁定"}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                ws.locked
                  ? "text-primary hover:text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:text-primary hover:bg-muted"
              )}
            >
              {ws.locked
                ? <Unlock className="w-3.5 h-3.5" strokeWidth={1.5} />
                : <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
            <button
              onClick={() => onArchive(ws.id)}
              title="归档"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Archive className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
          <Link
            href={`/workspaces/${ws.id}`}
            className="p-1 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
          <span className="text-[11px] text-muted-foreground/40">
            {ws.created_at.slice(0, 10)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<JDWorkspace[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWs, setEditingWs] = useState<JDWorkspace | null>(null)

  useEffect(() => {
    setWorkspaces(wsGetVisible())
  }, [])

  function handleCreated(ws: JDWorkspace) {
    setWorkspaces((prev) => [ws, ...prev])
    setModalOpen(false)
    // Navigate to the new workspace detail
    window.location.href = `/workspaces/${ws.id}`
  }

  function handleArchive(id: string) {
    const ws = workspaces.find((item) => item.id === id)
    if (!ws) return
    const confirmed = window.confirm(`确认归档「${ws.title}」吗？\n\n归档后会从 Workspace 列表中隐藏。如需恢复，可以在首页对话里输入「撤回归档」。`)
    if (!confirmed) return
    const updated = wsUpdate(id, { status: "archived" })
    if (!updated) return
    localStorage.setItem("narrative_last_archive", JSON.stringify({ type: "workspace", id, previous: ws }))
    setWorkspaces((prev) => prev.filter((w) => w.id !== id))
  }

  function handleToggleLock(id: string) {
    const ws = workspaces.find((item) => item.id === id)
    if (!ws) return
    const updated = wsUpdate(id, { locked: !ws.locked })
    if (updated) setWorkspaces((prev) => prev.map((item) => (item.id === id ? updated : item)))
  }

  function handleSaveEdit(updated: JDWorkspace) {
    setWorkspaces((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setEditingWs(null)
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl text-foreground font-normal leading-none">
              Workspaces
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              每个 JD 都是一个独立工作空间，共享同一份经历库。
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            上传 JD
          </button>
        </div>

        {/* List */}
        {workspaces.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {workspaces.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  ws={ws}
                  onArchive={handleArchive}
                  onEdit={setEditingWs}
                  onToggleLock={handleToggleLock}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Briefcase className="w-10 h-10 text-muted-foreground/25 mx-auto mb-4" strokeWidth={1} />
            <p className="text-sm text-muted-foreground/60 mb-3">还没有 Workspace</p>
            <button
              onClick={() => setModalOpen(true)}
              className="text-sm text-primary hover:underline"
            >
              粘贴第一个 JD →
            </button>
          </motion.div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {modalOpen && (
          <CreateWorkspaceModal
            onClose={() => setModalOpen(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingWs && (
          <EditWorkspaceModal
            ws={editingWs}
            onClose={() => setEditingWs(null)}
            onSaved={handleSaveEdit}
          />
        )}
      </AnimatePresence>
    </>
  )
}
