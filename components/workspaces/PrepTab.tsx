// anti-patterns-lint-allow
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Send,
  Sparkles,
  ChevronRight,
  Pin,
  Trash2,
  BookOpen,
  Eye,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { getSettings } from "@/lib/settings"
import {
  prepGetByWorkspace,
  prepCreate,
  prepTogglePin,
  prepDelete,
} from "@/lib/prep-store"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import type { JDWorkspace } from "@/types/workspace"
import type { ExperienceEntry } from "@/types/experience"
import type { PrepNote, PrepCategory } from "@/types/prep"

// ─── Types ────────────────────────────────────────────────────
type ChatMsg = { id: string; role: "user" | "assistant"; content: string }
type PendingNote = { question: string; answer: string; category: PrepCategory }

function genId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

// ─── Helpers ──────────────────────────────────────────────────
const CATEGORY_LABELS: Record<PrepCategory, string> = {
  behavioral:  "行为类",
  situational: "情景类",
  technical:   "技术类",
  company:     "动机类",
  general:     "通用",
}

const CATEGORY_COLORS: Record<PrepCategory, string> = {
  behavioral:  "bg-violet-50 text-violet-700 border-violet-200",
  situational: "bg-amber-50 text-amber-700 border-amber-200",
  technical:   "bg-sky-50 text-sky-700 border-sky-200",
  company:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  general:     "bg-muted text-muted-foreground border-border/40",
}

function detectCategory(question: string, answer: string): PrepCategory {
  const t = (question + " " + answer).toLowerCase()
  if (/(技术|代码|架构|算法|框架|工具|实现|方案|技术栈|系统设计)/.test(t)) return "technical"
  if (/(为什么|动机|兴趣|了解|文化|团队|公司|选择这家|加入|吸引)/.test(t)) return "company"
  if (/(如果|假设|遇到|处理|解决|情况|场景|面对|当.*发生)/.test(t)) return "situational"
  if (/(讲一|说说|描述|经历|经验|曾经|做过|负责|那次|STAR|举例)/.test(t)) return "behavioral"
  return "general"
}

// ─── Sub-components ───────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user"
  const text = msg.content.replace(/\[PREP_NOTE_DETECTED\]/g, "").trim()
  return (
    <motion.div
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-medium mt-0.5",
          isUser
            ? "bg-foreground text-background"
            : "bg-accent text-accent-foreground border border-border/60"
        )}
      >
        {isUser ? "我" : "教"}
      </div>
      <div
        className={cn(
          "max-w-[82%] px-4 py-3 rounded-2xl text-sm",
          isUser
            ? "bg-foreground text-background rounded-tr-sm"
            : "bg-card border border-border/50 text-foreground rounded-tl-sm shadow-sm"
        )}
      >
        {isUser ? (
          <span className="leading-relaxed whitespace-pre-wrap">{text}</span>
        ) : (
          <MarkdownContent compact>{text}</MarkdownContent>
        )}
      </div>
    </motion.div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-medium bg-accent text-accent-foreground border border-border/60">
        教
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border/50 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PrepNote Card ────────────────────────────────────────────
function NoteCard({
  note,
  onPin,
  onDelete,
}: {
  note: PrepNote
  onPin: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border bg-card transition-colors duration-150",
        note.pinned ? "border-primary/30 bg-primary/[0.02]" : "border-border/50"
      )}
    >
      <div
        className="px-4 pt-4 pb-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-foreground leading-snug flex-1">
            {note.question}
          </span>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onPin(note.id) }}
              className={cn(
                "p-1 rounded-md transition-colors",
                note.pinned
                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/60"
              )}
              title={note.pinned ? "取消置顶" : "置顶"}
            >
              <Pin className="w-3 h-3" strokeWidth={note.pinned ? 2 : 1.5} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="删除"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border",
              CATEGORY_COLORS[note.category]
            )}
          >
            {CATEGORY_LABELS[note.category]}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {expanded ? "收起" : "展开答案"}
          </span>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border/30">
              <div className="text-sm text-foreground/90 leading-relaxed">
                <MarkdownContent compact>{note.answer}</MarkdownContent>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Review Mode Overlay ──────────────────────────────────────
function ReviewOverlay({
  notes,
  ws,
  onClose,
}: {
  notes: PrepNote[]
  ws: JDWorkspace
  onClose: () => void
}) {
  const pinned = notes.filter((n) => n.pinned)
  const rest = notes.filter((n) => !n.pinned)
  const ordered = [...pinned, ...rest]

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-8 py-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground/60 mb-0.5 tracking-wide">面试前复习</div>
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

      {/* Notes */}
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-8">
        {ordered.length === 0 ? (
          <div className="text-center text-muted-foreground/60 py-20 text-sm">
            还没有准备好的内容
          </div>
        ) : (
          ordered.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              {/* 分隔：置顶 → 普通 */}
              {i === pinned.length && pinned.length > 0 && rest.length > 0 && (
                <div className="flex items-center gap-3 mb-8 text-xs text-muted-foreground/40">
                  <div className="flex-1 h-px bg-border/40" />
                  其他准备
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {note.pinned && (
                    <Pin className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={2} />
                  )}
                  <span
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      CATEGORY_COLORS[note.category]
                    )}
                  >
                    {CATEGORY_LABELS[note.category]}
                  </span>
                </div>
                <h3 className="text-[17px] font-medium text-foreground leading-7">
                  {note.question}
                </h3>
                <div className="text-[15px] text-foreground/80 leading-8">
                  <MarkdownContent>{note.answer}</MarkdownContent>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  )
}

// ─── Main PrepTab ─────────────────────────────────────────────
export function PrepTab({
  ws,
  activatedExps,
}: {
  ws: JDWorkspace
  activatedExps: ExperienceEntry[]
}) {
  // Chat state
  const openingMsg: ChatMsg = {
    id: "prep-opening",
    role: "assistant",
    content: ws.parsed_jd
      ? `我们针对 **${ws.company ?? ws.title}** 的 **${ws.position ?? ws.parsed_jd.title}** 职位来做面试准备。\n\nJD 的关键要求里，你感觉哪条最需要深度备考？`
      : `我们开始针对这个职位的面试准备。你目前最担心哪类问题——行为类、情景类，还是技术类？`,
  }

  const [messages, setMessages] = useState<ChatMsg[]>([openingMsg])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Pending note detection
  const [pendingNote, setPendingNote] = useState<PendingNote | null>(null)
  const [saving, setSaving] = useState(false)

  // Prep library
  const [notes, setNotes] = useState<PrepNote[]>([])

  // Review mode
  const [reviewing, setReviewing] = useState(false)

  // Category filter
  const [filterCat, setFilterCat] = useState<PrepCategory | "all">("all")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)

  // Load prep notes on mount
  useEffect(() => {
    setNotes(prepGetByWorkspace(ws.id))
  }, [ws.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px"
  }, [input])

  // Save pending note to library
  const confirmSaveNote = useCallback(() => {
    if (!pendingNote) return
    setSaving(true)
    try {
      prepCreate({
        workspace_id: ws.id,
        question: pendingNote.question,
        answer: pendingNote.answer,
        category: pendingNote.category,
      })
      setNotes(prepGetByWorkspace(ws.id))
    } finally {
      setSaving(false)
      setPendingNote(null)
    }
  }, [pendingNote, ws.id])

  // Pin / delete handlers
  function handlePin(id: string) {
    prepTogglePin(id)
    setNotes(prepGetByWorkspace(ws.id))
  }
  function handleDelete(id: string) {
    prepDelete(id)
    setNotes(prepGetByWorkspace(ws.id))
  }

  // Send message
  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading || !ws.parsed_jd) return

    const userMsg: ChatMsg = { id: genId(), role: "user", content: text }
    const assistantId = genId()
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ])
    setInput("")
    setIsLoading(true)

    const s = getSettings()
    const apiMessages = [...messages, userMsg].map(({ role, content }) => ({ role, content }))

    try {
      const res = await fetch("/api/ai/prep-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          jd: ws.parsed_jd,
          experiences: activatedExps,
          prepNotes: notes,
          provider: s.provider,
          apiKey: s.apiKeys[s.provider] ?? "",
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "请求失败")
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""

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
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
              )
            }
          } catch { /* skip */ }
        }
      }

      // Detect prep note
      if (fullText.includes("[PREP_NOTE_DETECTED]")) {
        const cleanAnswer = fullText.replace(/\[PREP_NOTE_DETECTED\]/g, "").trim()
        const question = text // The user's last message is the question context
        setPendingNote({
          question,
          answer: cleanAnswer,
          category: detectCategory(question, cleanAnswer),
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请求失败"
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: msg } : m))
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isComposingRef.current) {
      e.preventDefault()
      handleSend()
    }
  }

  const filteredNotes =
    filterCat === "all" ? notes : notes.filter((n) => n.category === filterCat)

  const usedCategories = Array.from(new Set(notes.map((n) => n.category)))

  return (
    <>
      {/* Review Mode Overlay */}
      <AnimatePresence>
        {reviewing && (
          <ReviewOverlay
            notes={notes}
            ws={ws}
            onClose={() => setReviewing(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex h-full min-h-0">
        {/* ── 左：对话区 ──────────────────────────────── */}
        <div className="flex flex-col flex-[0_0_55%] min-w-0 border-r border-border/40">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {isLoading && messages[messages.length - 1]?.content === "" && <TypingDots />}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending note banner */}
          <AnimatePresence>
            {pendingNote && (
              <motion.div
                className="mx-6 mb-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-violet-500/5 border border-violet-500/20">
                  <div className="flex items-center gap-2 text-xs text-foreground/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 text-violet-600">
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </span>
                    整理出一条准备答案
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full border",
                      CATEGORY_COLORS[pendingNote.category]
                    )}>
                      {CATEGORY_LABELS[pendingNote.category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPendingNote(null)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      忽略
                    </button>
                    <button
                      onClick={confirmSaveNote}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {saving ? "存入中…" : (
                        <>存入叙事库<ChevronRight className="h-3 w-3" strokeWidth={1.8} /></>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 无 JD 提示 */}
          {!ws.parsed_jd && (
            <div className="mx-6 mb-2 px-4 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700">
              当前 workspace 未解析 JD，教练将基于对话上下文辅导。
            </div>
          )}

          {/* 输入框 */}
          <div className="px-6 pb-6 pt-3">
            <div className="relative bg-card rounded-2xl border border-border/60 shadow-sm focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20 transition-all duration-200">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onCompositionStart={() => { isComposingRef.current = true }}
                onCompositionEnd={() => { isComposingRef.current = false }}
                onKeyDown={handleKeyDown}
                placeholder={
                  ws.parsed_jd
                    ? "描述一段经历，或直接问「哪类问题我最可能被问到」…"
                    : "告诉我你对这个面试的担忧…"
                }
                rows={1}
                className="w-full resize-none bg-transparent px-4 pt-3.5 pb-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
                style={{ maxHeight: "140px" }}
              />
              <div className="absolute right-3 bottom-3">
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150",
                    input.trim() && !isLoading
                      ? "bg-foreground text-background hover:opacity-80"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 右：叙事准备库 ───────────────────────────── */}
        <div className="flex flex-col flex-[0_0_45%] min-w-0">
          {/* 库 Header */}
          <div className="px-5 pt-5 pb-4 border-b border-border/40 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground/50 tracking-[0.08em] mb-0.5">
                叙事准备库
              </div>
              <div className="text-sm text-foreground font-medium">
                {notes.length === 0
                  ? "还没有准备内容"
                  : `${notes.length} 条准备好的答案`}
              </div>
            </div>
            {notes.length > 0 && (
              <button
                onClick={() => setReviewing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-border/60"
              >
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                进入复习
              </button>
            )}
          </div>

          {/* Category filter */}
          {usedCategories.length > 1 && (
            <div className="px-5 pt-3 pb-0 flex items-center gap-1.5 flex-wrap">
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

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
            {filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
                <div className="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-muted-foreground/40" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground/60">叙事库还是空的</p>
                  <p className="text-xs text-muted-foreground/40">
                    和左边的教练聊面试准备，整理好的问答会存到这里
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onPin={handlePin}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

