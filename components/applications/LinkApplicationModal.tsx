// anti-patterns-lint-allow
"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { JDWorkspace } from "@/types/workspace"
import type { ApplicationStatus } from "@/types/application"
import { appCreate, appGetAll, appUpdate } from "@/lib/application-store"

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "drafting",     label: "草稿" },
  { value: "applied",      label: "已投递" },
  { value: "phone_screen", label: "电话面" },
  { value: "interview",    label: "面试中" },
  { value: "offer",        label: "Offer" },
  { value: "rejected",     label: "已拒" },
]

export function LinkApplicationModal({
  workspace,
  onClose,
  onSaved,
}: {
  workspace: JDWorkspace
  onClose: () => void
  onSaved?: () => void
}) {
  // Reuse existing linked application if one exists
  const existing = appGetAll().find((a) => a.workspace_id === workspace.id)

  const [status, setStatus] = useState<ApplicationStatus>(existing?.status ?? "drafting")
  const [appliedAt, setAppliedAt] = useState(existing?.applied_at ?? "")
  const [nextAction, setNextAction] = useState(existing?.next_action ?? "")
  const [notes, setNotes] = useState(existing?.notes ?? "")

  function handleSave() {
    if (existing) {
      appUpdate(existing.id, {
        status,
        applied_at: appliedAt || null,
        next_action: nextAction || null,
        notes: notes || null,
      })
    } else {
      appCreate({
        company: workspace.company ?? "",
        position: workspace.position ?? "",
        status,
        applied_at: appliedAt || null,
        next_action: nextAction || null,
        next_action_date: null,
        notes: notes || null,
        workspace_id: workspace.id,
      })
    }
    onSaved?.()
    onClose()
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
        className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border/60 shadow-2xl p-6"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-serif text-lg text-foreground font-normal">
            {existing ? "更新投递进度" : "追踪此投递"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          {workspace.company} · {workspace.position}
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">当前状态</label>
              <select
                className={cn(
                  "w-full text-sm border border-border rounded-lg px-3 py-2 bg-background",
                  "focus:outline-none focus:ring-1 focus:ring-primary"
                )}
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">投递日期</label>
              <input
                type="date"
                className={cn(
                  "w-full text-sm border border-border rounded-lg px-3 py-2 bg-background",
                  "focus:outline-none focus:ring-1 focus:ring-primary"
                )}
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">下一步行动</label>
            <input
              autoFocus
              className={cn(
                "w-full text-sm border border-border rounded-lg px-3 py-2 bg-background",
                "focus:outline-none focus:ring-1 focus:ring-primary"
              )}
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="准备材料、等 HR 回复……"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">备注与感受</label>
            <textarea
              className={cn(
                "w-full text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none",
                "focus:outline-none focus:ring-1 focus:ring-primary"
              )}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="对这个职位的第一印象……"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            {existing ? "保存更新" : "创建追踪"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
