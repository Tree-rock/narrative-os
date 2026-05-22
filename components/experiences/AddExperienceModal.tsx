"use client"

import { useState, useRef } from "react"
import { X, Sparkles, Loader2, Check, RotateCcw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { getSettings } from "@/lib/settings"
import { localCreateExperience } from "@/lib/local-store"
import type { ExtractedExperience, ExperienceEntry } from "@/types/experience"

// ─── Types ──────────────────────────────────────────────────
type Step = "input" | "extracting" | "preview"

interface Props {
  onClose: () => void
  onSaved: (entry: ExperienceEntry) => void
}

// ─── Helpers ─────────────────────────────────────────────────
function SkillChip({ label }: { label: string }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
      {label}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export function AddExperienceModal({ onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>("input")
  const [text, setText] = useState("")
  const [extracted, setExtracted] = useState<ExtractedExperience | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setError("")
    setStep("extracting")

    const s = getSettings()
    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, provider: s.provider, apiKey: s.apiKeys[s.provider] ?? "" }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? "提取失败")
      setExtracted(data as ExtractedExperience)
      setStep("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失败，请重试")
      setStep("input")
    }
  }

  function handleReset() {
    setExtracted(null)
    setStep("input")
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleSave() {
    if (!extracted) return
    setSaving(true)
    try {
      const entry = localCreateExperience({
        raw_input: extracted.v_summary ?? text,
        input_type: "text",
        source_type: "manual",
        source_excerpt: text,
        source_messages: [{
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        }],
        ...extracted,
      })
      onSaved(entry)
    } finally {
      setSaving(false)
    }
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="absolute inset-0 bg-foreground/10 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-lg bg-card rounded-2xl border border-border/60 shadow-2xl shadow-foreground/5 overflow-hidden"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="font-serif text-lg text-foreground font-normal">
              添加经历
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "input" && "用自己的话描述，AI 会帮你整理结构。"}
              {step === "extracting" && "AI 正在提取结构化信息……"}
              {step === "preview" && "确认 AI 提取的内容后保存。"}
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
            {/* ── 输入步骤 ─── */}
            {step === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="比如：「我在 2024 年帮 Robinson Podcast 做中文抖音切片，有一条视频破百万播放。」&#10;&#10;哪怕是碎片化的描述也没关系。"
                  rows={6}
                  className="w-full resize-none bg-muted/30 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
                />
                {error && (
                  <p className="text-xs text-destructive mt-2">{error}</p>
                )}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleExtract}
                    disabled={!text.trim()}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-150",
                      text.trim()
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI 提取
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── 提取中 ─── */}
            {step === "extracting" && (
              <motion.div
                key="extracting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <Loader2 className="w-7 h-7 text-primary animate-spin" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">正在分析经历结构……</p>
              </motion.div>
            )}

            {/* ── 预览步骤 ─── */}
            {step === "preview" && extracted && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* 项目名 + 角色 */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="font-medium text-foreground text-sm leading-snug">
                    {extracted.project_name ?? "（未命名经历）"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    {extracted.role && <span>{extracted.role}</span>}
                    {extracted.time_period && (
                      <>
                        <span className="text-border">·</span>
                        <span>{extracted.time_period}</span>
                      </>
                    )}
                  </div>

                  {/* 能力标签 */}
                  {extracted.skills && extracted.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {extracted.skills.map((s) => (
                        <SkillChip key={s} label={s} />
                      ))}
                    </div>
                  )}
                </div>

                {/* 入库总结版 */}
                {extracted.v_summary && (
                  <div className="border border-border/60 rounded-xl p-3">
                    <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-1.5">
                      入库总结版
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{extracted.v_summary}</p>
                  </div>
                )}

                {/* 成果 */}
                {extracted.results && extracted.results.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest mb-2">
                      成果
                    </div>
                    <div className="space-y-1">
                      {extracted.results.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-primary mt-0.5 shrink-0">·</span>
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 简洁版 */}
                {extracted.v_concise && (
                  <div className="border border-border/60 rounded-xl p-3">
                    <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-1.5">
                      简历 Bullet
                    </div>
                    <p className="text-sm text-foreground">{extracted.v_concise}</p>
                  </div>
                )}

                {/* 适配岗位 */}
                {extracted.suitable_roles && extracted.suitable_roles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {extracted.suitable_roles.map((r) => (
                      <span
                        key={r}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        → {r}
                      </span>
                    ))}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                    重新描述
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    保存到经历库
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
