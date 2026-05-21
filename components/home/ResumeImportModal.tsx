// anti-patterns-lint-allow
"use client"

import { useState, useRef } from "react"
import { X, Upload, FileText, Loader2, Check, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { getSettings } from "@/lib/settings"
import { localCreateExperience } from "@/lib/local-store"
import type { ExtractedExperience, ExperienceEntry } from "@/types/experience"

interface Props {
  onClose: () => void
  onSaved: (entries: ExperienceEntry[]) => void
}

type Step = "input" | "extracting" | "preview"
type InputMode = "paste" | "upload"

// ─── File helpers ─────────────────────────────────────────────
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsText(file, "utf-8")
  })
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // strip the data:...;base64, prefix
      resolve(result.split(",")[1] ?? "")
    }
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsDataURL(file)
  })
}

// ─── Main ─────────────────────────────────────────────────────
export function ResumeImportModal({ onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>("input")
  const [mode, setMode] = useState<InputMode>("paste")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<ExtractedExperience[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File selection ──────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError("")
    setFile(f)

    // For plain text files: read immediately and show in paste tab
    if (f.type === "text/plain" || f.name.endsWith(".md")) {
      try {
        const content = await readFileAsText(f)
        setText(content)
        setMode("paste")
      } catch {
        setError("文本文件读取失败，请手动粘贴内容。")
      }
    }
    // PDF: keep as file, stay in upload mode
  }

  // ── Extract ─────────────────────────────────────────────────
  async function handleExtract() {
    const s = getSettings()
    setError("")
    setStep("extracting")

    try {
      let body: Record<string, unknown>

      if (file && file.type === "application/pdf") {
        if (s.provider !== "anthropic") {
          throw new Error(
            "PDF 直接解析仅支持 Claude（Anthropic）提供商。请在设置中切换提供商，或将简历内容粘贴为文本。"
          )
        }
        const pdf_base64 = await readFileAsBase64(file)
        body = { pdf_base64, provider: s.provider, apiKey: s.apiKeys[s.provider] ?? "" }
      } else {
        const content = text.trim()
        if (!content) throw new Error("请粘贴简历内容或上传文件")
        body = { text: content, provider: s.provider, apiKey: s.apiKeys[s.provider] ?? "" }
      }

      const res = await fetch("/api/ai/import-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { experiences?: ExtractedExperience[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? "提取失败")
      if (!data.experiences?.length) throw new Error("未找到可提取的工作或项目经历")

      setExtracted(data.experiences)
      setStep("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失败，请重试")
      setStep("input")
    }
  }

  // ── Save all ────────────────────────────────────────────────
  function handleSaveAll() {
    setSaving(true)
    const entries = extracted.map((exp) =>
      localCreateExperience({
        raw_input: text || `（从简历导入：${exp.project_name}）`,
        input_type: "resume",
        ...exp,
      })
    )
    onSaved(entries)
  }

  const canExtract =
    (mode === "paste" && text.trim().length > 50) ||
    (file !== null && (file.type === "application/pdf" || mode === "paste"))

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
            <h2 className="font-serif text-lg text-foreground font-normal">导入简历</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "input" && "AI 自动提取所有工作和项目经历，批量存入经历库。"}
              {step === "extracting" && "AI 正在解析简历，提取结构化经历……"}
              {step === "preview" && `共提取到 ${extracted.length} 段经历，确认后存入经历库。`}
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
            {/* ── 输入步骤 ──────────────────────────── */}
            {step === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Mode tabs */}
                <div className="flex gap-1 p-1 bg-muted/40 rounded-xl mb-4">
                  {([["paste", "粘贴文本"], ["upload", "上传文件"]] as const).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                        mode === m
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {mode === "paste" ? (
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={"将简历全文粘贴到这里……\n\n支持任意格式，中英文均可。AI 会自动识别所有工作经历和项目经历。"}
                    rows={9}
                    className="w-full resize-none bg-muted/30 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all leading-relaxed"
                  />
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                      file
                        ? "border-primary/40 bg-accent/30"
                        : "border-border/60 hover:border-border"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {file ? (
                      <>
                        <FileText className="w-8 h-8 text-primary" strokeWidth={1.5} />
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFile(null) }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          重新选择
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
                        <div className="text-center">
                          <p className="text-sm text-foreground">点击上传简历文件</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            支持 PDF · TXT · MD
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-2">
                            PDF 解析需使用 Claude（Anthropic）提供商
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {error && <p className="text-xs text-destructive mt-3">{error}</p>}

                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleExtract}
                    disabled={!canExtract}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all",
                      canExtract
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    AI 提取经历 →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── 提取中 ────────────────────────────── */}
            {step === "extracting" && (
              <motion.div
                key="extracting"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <Loader2 className="w-7 h-7 text-primary animate-spin" strokeWidth={1.5} />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">正在分析简历结构……</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">通常需要 10-20 秒</p>
                </div>
              </motion.div>
            )}

            {/* ── 预览步骤 ──────────────────────────── */}
            {step === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1 mb-4">
                  {extracted.map((exp, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground/60 w-5 shrink-0 pt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground leading-snug">
                            {exp.project_name ?? "（未命名）"}
                          </span>
                          {exp.time_period && (
                            <span className="text-[11px] text-muted-foreground">{exp.time_period}</span>
                          )}
                        </div>
                        {exp.v_concise && (
                          <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed">
                            {exp.v_concise}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(exp.skills ?? []).slice(0, 3).map((s) => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-0.5" strokeWidth={1.5} />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <button
                    onClick={() => { setStep("input"); setExtracted([]) }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    重新提取
                  </button>
                  <button
                    onClick={handleSaveAll}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    全部存入经历库（{extracted.length} 条）
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
