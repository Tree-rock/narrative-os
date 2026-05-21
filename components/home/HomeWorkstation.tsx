"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Mic, Plus, ChevronRight, Settings, FileUp, Trash2, BookOpen, Briefcase, X, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getSettings } from "@/lib/settings"
import { localCreateExperience, localGetExperiences, localUpdateExperience } from "@/lib/local-store"
import { wsGetVisible, wsUpdate } from "@/lib/workspace-store"
import { activityAdd, activityRecent } from "@/lib/activity-store"
import { chatLoad, chatSave, chatClear } from "@/lib/chat-store"
import { AddExperienceModal } from "@/components/experiences/AddExperienceModal"
import { ResumeImportModal } from "@/components/home/ResumeImportModal"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import type { ChatMessage, ExperienceEntry, AISettings } from "@/types/experience"
import type { JDWorkspace, WorkspaceStatus } from "@/types/workspace"

const STATUS_META: Record<WorkspaceStatus, { label: string; dot: string; className: string }> = {
  active: {
    label: "进行中",
    dot: "bg-primary",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  opportunity: {
    label: "等机会",
    dot: "bg-amber-500",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  learning: {
    label: "学习中",
    dot: "bg-sky-500",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  archived: {
    label: "已归档",
    dot: "bg-muted-foreground/40",
    className: "bg-muted text-muted-foreground border-border/60",
  },
}

type MentionTarget =
  | { kind: "experience"; id: string; label: string; description: string; entry: ExperienceEntry }
  | { kind: "jd"; id: string; label: string; description: string; workspace: JDWorkspace }

type LastArchive =
  | { type: "experience"; id: string; previous: ExperienceEntry; archivedAt?: string; expiresAt?: string }
  | { type: "workspace"; id: string; previous: JDWorkspace; archivedAt?: string; expiresAt?: string }

type PendingExtract = {
  sourceText: string
  assistantSummary?: string
  conversation: Array<{ role: "user" | "assistant"; content: string }>
}

// ─── Helpers ─────────────────────────────────────────────────
function genId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "你好。我在这里帮你整理和表达自己的职业经历。\n\n直接告诉我任何经历——哪怕是碎片化的描述，我会帮你结构化并存入经历库。也可以上传简历或 JD，我们一起开始。",
  createdAt: new Date(),
}

function isArchiveUndoIntent(text: string) {
  return /(撤回|恢复|取消|还原).{0,8}(归档|存档)|归档.{0,8}(撤回|恢复|取消|还原)/.test(text)
}

function shouldPromptExperienceSave(userText: string, assistantText: string) {
  if (assistantText.includes("[EXPERIENCE_DETECTED]")) return true
  if (userText.trim().length < 18) return false
  const summarySignals = /(总结|整理|STAR|简历|bullet|经历库|项目|背景|行动|结果|成果|负责|提升|优化|落地|复盘)/
  const assistantSignals = /(可以存入|建议存入|加入经历库|这段经历|这段项目|总结|STAR|简历|成果|行动|结果)/
  return summarySignals.test(userText) && assistantSignals.test(assistantText)
}

// ─── Sub-components ──────────────────────────────────────────
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  // Strip [EXPERIENCE_DETECTED] from display
  const text = message.content.replace(/\[EXPERIENCE_DETECTED\]/g, "").trim()

  return (
    <motion.div
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-medium mt-0.5",
          isUser
            ? "bg-foreground text-background"
            : "bg-accent text-accent-foreground border border-border/60"
        )}
      >
        {isUser ? "我" : "叙"}
      </div>
      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl text-sm",
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
        叙
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

// ─── Main ─────────────────────────────────────────────────────
export function HomeWorkstation() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [chatLoaded, setChatLoaded] = useState(false)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<AISettings>({ provider: "anthropic", apiKeys: {} })
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([])
  const [allExperiences, setAllExperiences] = useState<ExperienceEntry[]>([])
  const [workspaces, setWorkspaces] = useState<JDWorkspace[]>([])
  const [selectedMentions, setSelectedMentions] = useState<MentionTarget[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  // Pending experience detection — user must confirm before entry is created
  const [pendingExtract, setPendingExtract] = useState<PendingExtract | null>(null)
  const [extracting, setExtracting] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Init: load settings, experiences, and chat history ─────
  useEffect(() => {
    setSettings(getSettings())
    const loadedExperiences = localGetExperiences()
    setAllExperiences(loadedExperiences)
    setExperiences(loadedExperiences.slice(0, 5))
    setWorkspaces(wsGetVisible())
    const saved = chatLoad()
    if (saved.length > 0) setMessages([WELCOME, ...saved])
    setChatLoaded(true)
  }, [])

  // ── Persist chat whenever messages change (after initial load)
  useEffect(() => {
    if (!chatLoaded) return
    chatSave(messages)
  }, [messages, chatLoaded])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
  }, [input])

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const atIndex = input.lastIndexOf("@")
  const mentionQuery =
    atIndex >= 0 && !/\s/.test(input.slice(atIndex + 1))
      ? input.slice(atIndex + 1).toLowerCase()
      : null
  const mentionTargets: MentionTarget[] = [
    ...allExperiences.map((entry) => ({
      kind: "experience" as const,
      id: entry.id,
      label: entry.project_name ?? entry.raw_input.slice(0, 24),
      description: [entry.role, entry.time_period, (entry.skills ?? []).slice(0, 2).join(" / ")]
        .filter(Boolean)
        .join(" · "),
      entry,
    })),
    ...workspaces.map((workspace) => ({
      kind: "jd" as const,
      id: workspace.id,
      label: workspace.title,
      description: [workspace.company, workspace.parsed_jd?.keywords?.slice(0, 2).join(" / ")]
        .filter(Boolean)
        .join(" · "),
      workspace,
    })),
  ]
  const mentionSuggestions = mentionQuery === null
    ? []
    : mentionTargets
        .filter((target) => {
          const haystack = `${target.label} ${target.description}`.toLowerCase()
          return haystack.includes(mentionQuery)
        })
        .slice(0, 8)

  function pickMention(target: MentionTarget) {
    const prefix = target.kind === "experience" ? "经历" : "JD"
    const token = `@${prefix}:${target.label}`
    const before = atIndex >= 0 ? input.slice(0, atIndex) : input
    const after = atIndex >= 0 ? input.slice(atIndex).replace(/^@\S*/, "") : ""
    setInput(`${before}${token} ${after}`.replace(/\s{2,}/g, " "))
    setSelectedMentions((prev) => {
      if (prev.some((item) => item.kind === target.kind && item.id === target.id)) return prev
      return [...prev, target]
    })
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function removeMention(target: MentionTarget) {
    setSelectedMentions((prev) =>
      prev.filter((item) => !(item.kind === target.kind && item.id === target.id))
    )
  }

  function buildMentionContext() {
    const libraryExperiences = allExperiences.slice(0, 50).map((entry) => ({
      id: entry.id,
      name: entry.project_name ?? entry.raw_input.slice(0, 24),
      role: entry.role,
      time_period: entry.time_period,
      actions: entry.actions,
      skills: entry.skills,
      results: entry.results,
      metrics: entry.metrics,
      values: entry.values,
      concise: entry.v_concise,
      star: entry.v_star,
      chat_version: entry.v_chat,
      suitable_roles: entry.suitable_roles,
      locked: entry.locked,
    }))
    const libraryJds = workspaces.slice(0, 50).map((workspace) => ({
      id: workspace.id,
      title: workspace.title,
      company: workspace.company,
      position: workspace.position,
      status: workspace.status,
      summary: workspace.parsed_jd?.summary,
      keywords: workspace.parsed_jd?.keywords,
      key_requirements: workspace.parsed_jd?.key_requirements,
      culture_signals: workspace.parsed_jd?.culture_signals,
      red_flags: workspace.parsed_jd?.red_flags,
      locked: workspace.locked,
    }))
    const recentActivity = activityRecent(40).map((item) => ({
      type: item.type,
      title: item.title,
      summary: item.summary,
      created_at: item.created_at,
      payload: item.payload,
    }))

    return {
      experiences: selectedMentions
        .filter((item): item is Extract<MentionTarget, { kind: "experience" }> => item.kind === "experience")
        .map(({ entry }) => ({
          id: entry.id,
          project_name: entry.project_name,
          role: entry.role,
          time_period: entry.time_period,
          actions: entry.actions,
          skills: entry.skills,
          results: entry.results,
          metrics: entry.metrics,
          v_star: entry.v_star,
          v_concise: entry.v_concise,
          v_chat: entry.v_chat,
          suitable_roles: entry.suitable_roles,
          locked: entry.locked,
        })),
      jds: selectedMentions
        .filter((item): item is Extract<MentionTarget, { kind: "jd" }> => item.kind === "jd")
        .map(({ workspace }) => ({
          id: workspace.id,
          title: workspace.title,
          company: workspace.company,
          position: workspace.position,
          jd_text: workspace.jd_text,
          parsed_jd: workspace.parsed_jd,
          status: workspace.status,
          locked: workspace.locked,
        })),
      library: {
        experiences: libraryExperiences,
        jds: libraryJds,
      },
      activity: recentActivity,
    }
  }

  function restoreLastArchive(userText: string) {
    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: userText,
      createdAt: new Date(),
    }
    const raw = localStorage.getItem("narrative_last_archive")
    if (!raw) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: genId(),
          role: "assistant",
          content: "我没有找到最近可撤回的归档记录。之后你在经历库或 JD 库点归档，我会记住最近一次，方便你在这里说「撤回归档」。",
          createdAt: new Date(),
        },
      ])
      return
    }

    try {
      const last = JSON.parse(raw) as LastArchive
      if (last.expiresAt && Date.now() > new Date(last.expiresAt).getTime()) {
        localStorage.removeItem("narrative_last_archive")
        setMessages((prev) => [
          ...prev,
          userMsg,
          {
            id: genId(),
            role: "assistant",
            content: "这次归档已经超过 5 分钟撤回窗口，不能再通过对话恢复。",
            createdAt: new Date(),
          },
        ])
        return
      }

      if (last.type === "experience") {
        const restored = localUpdateExperience(last.id, { archived: false })
        if (!restored) throw new Error("经历记录不存在")
        setAllExperiences((prev) => [restored, ...prev.filter((entry) => entry.id !== restored.id)])
        setExperiences((prev) => [restored, ...prev.filter((entry) => entry.id !== restored.id)].slice(0, 5))
        localStorage.removeItem("narrative_last_archive")
        activityAdd({
          type: "archive_restored",
          title: `恢复经历：${restored.project_name ?? restored.raw_input.slice(0, 24)}`,
          summary: restored.v_concise ?? restored.raw_input.slice(0, 80),
        })
        setMessages((prev) => [
          ...prev,
          userMsg,
          {
            id: genId(),
            role: "assistant",
            content: `已撤回归档，恢复经历「${restored.project_name ?? restored.raw_input.slice(0, 24)}」。`,
            createdAt: new Date(),
          },
        ])
        return
      }

      const restoredStatus = last.previous.status === "archived" ? "active" : last.previous.status
      const restored = wsUpdate(last.id, { status: restoredStatus })
      if (!restored) throw new Error("JD 记录不存在")
      setWorkspaces(wsGetVisible())
      localStorage.removeItem("narrative_last_archive")
      activityAdd({
        type: "archive_restored",
        title: `恢复 JD：${restored.title}`,
        summary: restored.parsed_jd?.summary ?? restored.jd_text.slice(0, 80),
      })
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: genId(),
          role: "assistant",
          content: `已撤回归档，恢复 JD「${restored.title}」。`,
          createdAt: new Date(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: genId(),
          role: "assistant",
          content: "撤回失败了：最近归档记录已经不存在或格式不完整。你可以去对应库里重新添加这条内容。",
          createdAt: new Date(),
        },
      ])
    }
  }

  // ── Confirm extract: user clicked "添加到库" on the pending chip
  const confirmExtract = useCallback(async () => {
    if (!pendingExtract) return
    setExtracting(true)
    try {
      const s = getSettings()
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pendingExtract.sourceText,
          assistantSummary: pendingExtract.assistantSummary,
          conversation: pendingExtract.conversation,
          provider: s.provider,
          apiKey: s.apiKeys[s.provider] ?? "",
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? "提取失败")
      const entry = localCreateExperience({
        raw_input: pendingExtract.assistantSummary ?? pendingExtract.sourceText,
        input_type: "text",
        ...data,
      })
      setAllExperiences((prev) => [entry, ...prev])
      setExperiences((prev) => [entry, ...prev].slice(0, 5))
      activityAdd({
        type: "experience_saved",
        title: `从对话入库：${entry.project_name ?? "经历"}`,
        summary: entry.v_concise ?? entry.v_chat ?? entry.raw_input.slice(0, 120),
        payload: {
          project_name: entry.project_name,
          role: entry.role,
          time_period: entry.time_period,
          skills: entry.skills,
          results: entry.results,
          metrics: entry.metrics,
        },
      })
      setToast(`✓ 「${data.project_name ?? "经历"}」已存入经历库`)
    } catch (e) {
      setToast(`提取失败：${e instanceof Error ? e.message : "请重试"}`)
    } finally {
      setExtracting(false)
      setPendingExtract(null)
    }
  }, [pendingExtract])

  // ── Send message ────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    activityAdd({
      type: "user_input",
      title: "首页对话输入",
      summary: text.slice(0, 240),
    })

    if (isArchiveUndoIntent(text)) {
      setInput("")
      restoreLastArchive(text)
      return
    }

    const activeKey = settings.apiKeys[settings.provider] ?? ""
    if (!activeKey) {
      setToast("请先在设置中配置 API Key")
      return
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: text,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    const apiMessages = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role,
        content: m.content.replace(/\[EXPERIENCE_DETECTED\]/g, "").trim(),
      }))

    const assistantId = genId()
    // Add placeholder assistant message for streaming
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", createdAt: new Date() },
    ])
    setIsLoading(false)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          apiKey: activeKey,
          provider: settings.provider,
          context: buildMentionContext(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: err.error ?? "请求失败，请重试" }
              : m
          )
        )
        return
      }

      // ── SSE streaming (all providers) ───────────────────
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
            const chunk = JSON.parse(raw)
            if (chunk.text) {
              fullText += chunk.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                )
              )
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      if (shouldPromptExperienceSave(text, fullText)) {
        const cleanSummary = fullText.replace(/\[EXPERIENCE_DETECTED\]/g, "").trim()
        setPendingExtract({
          sourceText: text,
          assistantSummary: cleanSummary,
          conversation: apiMessages
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请求失败"
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: msg } : m))
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentWorkspace =
    workspaces.find((workspace) => workspace.status === "active") ??
    workspaces.find((workspace) => workspace.status === "opportunity") ??
    workspaces.find((workspace) => workspace.status === "learning") ??
    workspaces[0]
  const currentStatus = currentWorkspace
    ? STATUS_META[currentWorkspace.status] ?? STATUS_META.active
    : null

  // ─── Render ─────────────────────────────────────────────────
  return (
    <>
      <div className="h-full flex">
        {/* ── 左：对话区 ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border/40">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-border/40 flex items-start justify-between">
            <div>
              <h1 className="font-serif text-2xl text-foreground font-normal leading-none">
                主工作台
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                说说你的经历，或者上传一个 JD 开始今天的工作。
              </p>
            </div>
            {/* 右侧操作区 */}
            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 1 && (
                <button
                  onClick={() => {
                    chatClear()
                    setMessages([WELCOME])
                    setSelectedMentions([])
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  title="清空对话"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  清空
                </button>
              )}
              {!settings.apiKeys[settings.provider] && (
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border/60 rounded-lg px-3 py-1.5 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Settings className="w-3 h-3" strokeWidth={1.5} />
                  配置 API Key
                </Link>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-8 py-6 space-y-5">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingDots />}
            <div ref={messagesEndRef} />
          </div>

          {/* Experience detection chip */}
          <AnimatePresence>
            {pendingExtract && (
              <motion.div
                className="mx-8 mb-2"
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 text-xs text-foreground/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </span>
                    AI 已基于聊天整理出一段可加入经历库的内容
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPendingExtract(null)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      忽略
                    </button>
                    <button
                      onClick={confirmExtract}
                      disabled={extracting}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {extracting ? (
                        <>
                          <span className="w-3 h-3 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                          提取中…
                        </>
                      ) : "按总结存入经历库 →"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="px-8 pb-8 pt-4">
            <div className="relative bg-card rounded-2xl border border-border/60 shadow-sm focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20 transition-all duration-200">
              {selectedMentions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                  {selectedMentions.map((target) => (
                    <button
                      key={`${target.kind}-${target.id}`}
                      onClick={() => removeMention(target)}
                      className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-accent text-accent-foreground hover:bg-muted transition-colors"
                      title="移除上下文"
                    >
                      {target.kind === "experience" ? (
                        <BookOpen className="w-3 h-3" strokeWidth={1.5} />
                      ) : (
                        <Briefcase className="w-3 h-3" strokeWidth={1.5} />
                      )}
                      <span className="max-w-[160px] truncate">{target.label}</span>
                      <X className="w-3 h-3 opacity-60" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  settings.apiKeys[settings.provider]
                    ? "告诉我你的经历，或者粘贴 JD……"
                    : "请先在设置中配置 API Key…"
                }
                rows={1}
                className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
                style={{ maxHeight: "160px" }}
              />
              {mentionSuggestions.length > 0 && (
                <div className="absolute left-3 right-3 bottom-[58px] z-20 overflow-hidden rounded-xl border border-border/70 bg-card shadow-xl shadow-foreground/5">
                  <div className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border/40">
                    选择要引用的经历或 JD
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-thin py-1">
                    {mentionSuggestions.map((target) => (
                      <button
                        key={`${target.kind}-${target.id}`}
                        onClick={() => pickMention(target)}
                        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                      >
                        <span className="mt-0.5 w-5 h-5 rounded-md bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                          {target.kind === "experience" ? (
                            <BookOpen className="w-3 h-3" strokeWidth={1.5} />
                          ) : (
                            <Briefcase className="w-3 h-3" strokeWidth={1.5} />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm text-foreground truncate">{target.label}</span>
                          {target.description && (
                            <span className="block text-xs text-muted-foreground/70 truncate">
                              {target.kind === "experience" ? "经历" : "JD"} · {target.description}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    title="添加经历"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => setImportModalOpen(true)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    title="导入简历"
                  >
                    <FileUp className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                    <Mic className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-150",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
              Enter 发送 · Shift+Enter 换行
            </p>
          </div>
        </div>

        {/* ── 右：Context Panel ─────────────────────────── */}
        <div className="w-[300px] shrink-0 flex flex-col overflow-y-auto scrollbar-thin">
          {/* 当前 Workspace */}
          <div className="px-6 pt-8 pb-4">
            <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest mb-3">
              当前 Workspace
            </div>
            <Link
              href="/workspaces"
              className="narrative-card p-4 block group hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {currentWorkspace?.title ?? "暂无激活的 Workspace"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {currentWorkspace?.company ?? "上传 JD 创建第一个"}
                  </div>
                  {currentWorkspace && currentStatus && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className={cn("w-1.5 h-1.5 rounded-full", currentStatus.dot)} />
                      <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", currentStatus.className)}>
                        {currentStatus.label}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-muted-foreground transition-colors" />
              </div>
            </Link>
          </div>

          <div className="mx-6 border-t border-border/40" />

          {/* 最近经历 */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
                最近经历
              </div>
              <Link href="/experiences" className="text-[11px] text-primary hover:underline">
                全部
              </Link>
            </div>

            {experiences.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">
                在对话中描述经历，AI 会自动提取并存入经历库。
              </p>
            ) : (
              <div className="space-y-2">
                {experiences.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="text-sm text-foreground font-medium leading-snug group-hover:text-primary transition-colors">
                      {exp.project_name ?? exp.raw_input.slice(0, 30) + "…"}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {exp.time_period && (
                        <span className="text-[11px] text-muted-foreground">
                          {exp.time_period}
                        </span>
                      )}
                      {(exp.skills ?? []).slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-6 border-t border-border/40" />

          {/* 今日状态 */}
          <div className="px-6 py-4">
            <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest mb-3">
              今日
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-border" />
                经历库 {localGetExperiences().length} 条记录
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-border" />
                JD 库 {workspaces.length} 条记录
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm px-4 py-2.5 rounded-full shadow-lg"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Experience Modal ────────────────────────────── */}
      <AnimatePresence>
        {addModalOpen && (
          <AddExperienceModal
            onClose={() => setAddModalOpen(false)}
            onSaved={(entry) => {
              setAllExperiences((prev) => [entry, ...prev])
              setExperiences((prev) => [entry, ...prev].slice(0, 5))
              activityAdd({
                type: "experience_saved",
                title: `手动入库：${entry.project_name ?? "经历"}`,
                summary: entry.v_concise ?? entry.v_chat ?? entry.raw_input.slice(0, 120),
                payload: {
                  project_name: entry.project_name,
                  role: entry.role,
                  time_period: entry.time_period,
                  skills: entry.skills,
                  results: entry.results,
                  metrics: entry.metrics,
                },
              })
              setAddModalOpen(false)
              setToast(`✓ 「${entry.project_name ?? "经历"}」已添加到经历库`)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Resume Import Modal ─────────────────────────────── */}
      <AnimatePresence>
        {importModalOpen && (
          <ResumeImportModal
            onClose={() => setImportModalOpen(false)}
            onSaved={(entries) => {
              setAllExperiences((prev) => [...entries, ...prev])
              setExperiences((prev) => [...entries, ...prev].slice(0, 5))
              activityAdd({
                type: "resume_imported",
                title: `简历导入：${entries.length} 段经历`,
                summary: entries
                  .map((entry) => entry.project_name ?? entry.v_concise ?? entry.raw_input.slice(0, 24))
                  .join("；")
                  .slice(0, 240),
                payload: entries.map((entry) => ({
                  project_name: entry.project_name,
                  role: entry.role,
                  time_period: entry.time_period,
                  skills: entry.skills,
                  results: entry.results,
                  metrics: entry.metrics,
                  concise: entry.v_concise,
                })),
              })
              setImportModalOpen(false)
              setToast(`✓ 已导入 ${entries.length} 段经历到经历库`)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
