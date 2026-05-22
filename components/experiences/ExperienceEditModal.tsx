// anti-patterns-lint-allow
"use client"

import { useState, useRef } from "react"
import { X, Plus, Trash2, Lock, Unlock, MessageSquare } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { localUpdateExperience } from "@/lib/local-store"
import type { ExperienceEntry } from "@/types/experience"

interface Props {
  exp: ExperienceEntry
  onClose: () => void
  onSaved: (updated: ExperienceEntry) => void
}

// ─── Tag editor ───────────────────────────────────────────────
function TagEditor({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const val = input.trim()
    if (!val || tags.includes(val)) { setInput(""); return }
    onChange([...tags, val])
    setInput("")
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/30 border border-border/60 min-h-[44px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(tag) }}
            className="hover:text-destructive transition-colors"
          >
            <X className="w-2.5 h-2.5" strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add() }
          if (e.key === "Backspace" && !input && tags.length) {
            remove(tags[tags.length - 1])
          }
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="bg-transparent text-xs outline-none flex-1 min-w-[80px] placeholder:text-muted-foreground/40"
      />
    </div>
  )
}

// ─── Results list editor ──────────────────────────────────────
function ResultsList({
  results,
  onChange,
}: {
  results: string[]
  onChange: (next: string[]) => void
}) {
  function update(i: number, val: string) {
    const next = [...results]
    next[i] = val
    onChange(next)
  }
  function remove(i: number) {
    onChange(results.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-1.5">
      {results.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-primary mt-2 shrink-0 text-xs">·</span>
          <input
            value={r}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 text-sm bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-1.5 p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...results, ""])}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
        添加成果
      </button>
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">
      {children}
    </div>
  )
}

function SourceRoleLabel({ role }: { role: "user" | "assistant" }) {
  return (
    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
      {role === "user" ? "用户原话" : "AI 总结"}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export function ExperienceEditModal({ exp, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    project_name: exp.project_name ?? "",
    role: exp.role ?? "",
    time_period: exp.time_period ?? "",
    skills: exp.skills ?? [],
    results: exp.results ?? [],
    metrics: exp.metrics ?? "",
    v_summary: exp.v_summary ?? "",
    v_concise: exp.v_concise ?? "",
    v_star: exp.v_star ?? "",
    suitable_roles: exp.suitable_roles ?? [],
  })
  const [locked, setLocked] = useState(exp.locked ?? false)
  const [showStar, setShowStar] = useState(false)

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function handleSave() {
    const updated = localUpdateExperience(exp.id, { ...form, locked })
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
        className="relative z-10 w-full max-w-lg bg-card rounded-2xl border border-border/60 shadow-2xl shadow-foreground/5 flex flex-col max-h-[90vh]"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <div>
            <h2 className="font-serif text-lg text-foreground font-normal">编辑经历</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              原始输入：{exp.raw_input.slice(0, 60)}{exp.raw_input.length > 60 ? "…" : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
          {/* 基本信息 */}
          <div>
            <SectionLabel>基本信息</SectionLabel>
            <div className="space-y-2">
              <input
                value={form.project_name}
                onChange={(e) => set("project_name", e.target.value)}
                placeholder="经历名称"
                className="w-full text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all font-medium"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="角色 / 职位"
                  className="text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
                />
                <input
                  value={form.time_period}
                  onChange={(e) => set("time_period", e.target.value)}
                  placeholder="时间段"
                  className="text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 技能标签 */}
          <div>
            <SectionLabel>技能标签</SectionLabel>
            <TagEditor
              tags={form.skills}
              onChange={(v) => set("skills", v)}
              placeholder="输入标签，Enter 确认…"
            />
          </div>

          {/* 成果 */}
          <div>
            <SectionLabel>量化成果</SectionLabel>
            <ResultsList results={form.results} onChange={(v) => set("results", v)} />
          </div>

          {/* 数字指标 */}
          <div>
            <SectionLabel>核心指标</SectionLabel>
            <input
              value={form.metrics}
              onChange={(e) => set("metrics", e.target.value)}
              placeholder="如：转化率提升 30%、DAU 增长 5 万…"
              className="w-full text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
            />
          </div>

          {/* 入库总结版 */}
          <div>
            <SectionLabel>入库总结版</SectionLabel>
            <textarea
              value={form.v_summary}
              onChange={(e) => set("v_summary", e.target.value)}
              placeholder="最完整、可独立理解的一段经历总结。包含背景、角色、行动、方法、结果和价值…"
              rows={4}
              className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
            />
          </div>

          {(exp.source_excerpt || (exp.source_messages ?? []).length > 0) && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                  来源片段
                </div>
              </div>
              {(exp.source_messages ?? []).length > 0 ? (
                <div className="space-y-2 max-h-44 overflow-y-auto scrollbar-thin pr-1">
                  {(exp.source_messages ?? []).map((message, index) => (
                    <div key={`${message.id ?? message.role}-${index}`} className="rounded-lg bg-card/70 border border-border/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <SourceRoleLabel role={message.role} />
                        {message.createdAt && (
                          <span className="text-[10px] text-muted-foreground/40">
                            {new Date(message.createdAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/75 leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-foreground/75 leading-relaxed whitespace-pre-wrap">
                  {exp.source_excerpt}
                </p>
              )}
            </div>
          )}

          {/* 简历 Bullet */}
          <div>
            <SectionLabel>简历 Bullet（20字以内）</SectionLabel>
            <div className="relative">
              <textarea
                value={form.v_concise}
                onChange={(e) => set("v_concise", e.target.value)}
                placeholder="强动词开头，包含数字成果…"
                rows={2}
                className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 pr-12 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
              />
              <span className={cn(
                "absolute right-3 bottom-2.5 text-[11px] tabular-nums",
                form.v_concise.length > 20 ? "text-destructive" : "text-muted-foreground/40"
              )}>
                {form.v_concise.length}
              </span>
            </div>
          </div>

          {/* STAR（折叠） */}
          <div>
            <button
              type="button"
              onClick={() => setShowStar((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-2"
            >
              <SectionLabel>STAR 叙事</SectionLabel>
              <span className="ml-auto">{showStar ? "收起 ↑" : "展开 ↓"}</span>
            </button>
            {showStar && (
              <textarea
                value={form.v_star}
                onChange={(e) => set("v_star", e.target.value)}
                placeholder="背景 / 任务 / 行动 / 结果…"
                rows={5}
                className="w-full resize-none text-sm bg-muted/30 border border-border/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
              />
            )}
          </div>

          {/* 适配岗位 */}
          <div>
            <SectionLabel>适配求职方向</SectionLabel>
            <TagEditor
              tags={form.suitable_roles}
              onChange={(v) => set("suitable_roles", v)}
              placeholder="如：内容运营、增长运营…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 shrink-0">
          {/* Lock toggle */}
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
            {locked ? "已锁定" : "锁定此条目"}
          </button>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
