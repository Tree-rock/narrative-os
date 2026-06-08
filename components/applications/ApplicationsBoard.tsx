// anti-patterns-lint-allow
"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApplicationEntry, ApplicationStatus } from "@/types/application"
import { appGetAll, appCreate, appUpdate, appDelete } from "@/lib/application-store"
import { wsGetVisible } from "@/lib/workspace-store"
import type { JDWorkspace } from "@/types/workspace"

// @anchor: status-config — single source of truth for labels/colors/order
const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string }> = {
  drafting:     { label: "草稿",   color: "bg-muted text-muted-foreground" },
  applied:      { label: "已投递", color: "bg-secondary text-secondary-foreground" },
  phone_screen: { label: "电话面", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  interview:    { label: "面试中", color: "bg-primary/10 text-primary" },
  offer:        { label: "Offer",  color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
  rejected:     { label: "已拒",   color: "bg-destructive/10 text-destructive" },
}

const STATUS_ORDER: ApplicationStatus[] = [
  "drafting", "applied", "phone_screen", "interview", "offer", "rejected",
]

const BLANK_FORM = {
  company: "",
  position: "",
  status: "drafting" as ApplicationStatus,
  applied_at: "",
  next_action: "",
  next_action_date: "",
  notes: "",
  workspace_id: "",
}

type FilterStatus = "all" | ApplicationStatus

export function ApplicationsBoard() {
  const [apps, setApps] = useState<ApplicationEntry[]>([])
  const [workspaces, setWorkspaces] = useState<JDWorkspace[]>([])
  const [filter, setFilter] = useState<FilterStatus>("all")
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ApplicationEntry | null>(null)
  const [form, setForm] = useState(BLANK_FORM)

  const reload = useCallback(() => {
    setApps(appGetAll())
    setWorkspaces(wsGetVisible())
  }, [])

  useEffect(() => { reload() }, [reload])

  function openAdd() {
    setEditing(null)
    setForm(BLANK_FORM)
    setShowModal(true)
  }

  function openEdit(app: ApplicationEntry) {
    setEditing(app)
    setForm({
      company: app.company,
      position: app.position,
      status: app.status,
      applied_at: app.applied_at ?? "",
      next_action: app.next_action ?? "",
      next_action_date: app.next_action_date ?? "",
      notes: app.notes ?? "",
      workspace_id: app.workspace_id ?? "",
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(BLANK_FORM)
  }

  function handleSave() {
    if (!form.company.trim() || !form.position.trim()) return
    const payload = {
      company: form.company.trim(),
      position: form.position.trim(),
      status: form.status,
      applied_at: form.applied_at || null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
      notes: form.notes || null,
      workspace_id: form.workspace_id || null,
    }
    if (editing) {
      appUpdate(editing.id, payload)
    } else {
      appCreate(payload)
    }
    reload()
    closeModal()
  }

  function handleDelete(id: string) {
    appDelete(id)
    reload()
    closeModal()
  }

  function cycleStatus(e: React.MouseEvent, app: ApplicationEntry) {
    e.stopPropagation()
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(app.status) + 1) % STATUS_ORDER.length]
    appUpdate(app.id, { status: next })
    reload()
  }

  const filtered = filter === "all" ? apps : apps.filter((a) => a.status === filter)
  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, apps.filter((a) => a.status === s).length])
  ) as Record<ApplicationStatus, number>

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* 页头 */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground font-normal leading-none">
            求职追踪
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            每一步都值得被记录。
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          新建投递
        </button>
      </div>

      {/* 状态概览 + 筛选 */}
      <div className="grid grid-cols-6 gap-2 mb-8">
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "all" : s)}
              className={cn(
                "narrative-card p-3 text-center transition-all duration-150 hover:border-border",
                filter === s && "ring-1 ring-primary"
              )}
            >
              <div className="text-xl font-light text-foreground mb-1.5">
                {counts[s]}
              </div>
              <div className={cn("text-[11px] px-2 py-0.5 rounded-full inline-block", cfg.color)}>
                {cfg.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* 投递列表 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-muted-foreground/50">
            {filter === "all"
              ? "还没有投递记录，点击右上角新建"
              : `没有「${STATUS_CONFIG[filter as ApplicationStatus]?.label}」状态的投递`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((app) => {
            const cfg = STATUS_CONFIG[app.status]
            const ws = workspaces.find((w) => w.id === app.workspace_id)
            return (
              <div
                key={app.id}
                onClick={() => openEdit(app)}
                className="narrative-card p-5 cursor-pointer hover:border-border transition-all duration-150 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {app.company}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {app.position}
                      </span>
                      <button
                        onClick={(e) => cycleStatus(e, app)}
                        title="点击切换下一状态"
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-70",
                          cfg.color
                        )}
                      >
                        {cfg.label}
                      </button>
                      {ws && (
                        <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                          <Link2 className="w-3 h-3" strokeWidth={1.5} />
                          {ws.title || `${ws.company} · ${ws.position}`}
                        </span>
                      )}
                    </div>
                    {app.next_action && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        → {app.next_action}
                        {app.next_action_date && (
                          <span className="ml-2 text-muted-foreground/40">
                            {app.next_action_date}
                          </span>
                        )}
                      </p>
                    )}
                    {app.notes && (
                      <p className="text-xs text-muted-foreground/50 mt-1 line-clamp-1">
                        {app.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground/40 shrink-0 mt-0.5">
                    {app.applied_at ?? "未投递"}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新建 / 编辑 弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-lg font-normal mb-5 text-foreground">
              {editing ? "编辑投递" : "新建投递"}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">公司名称 *</label>
                  <input
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="字节跳动"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">岗位名称 *</label>
                  <input
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                    placeholder="AI 产品经理"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">当前状态</label>
                  <select
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ApplicationStatus }))}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">投递日期</label>
                  <input
                    type="date"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.applied_at}
                    onChange={(e) => setForm((f) => ({ ...f, applied_at: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">下一步行动</label>
                  <input
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.next_action}
                    onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
                    placeholder="准备二面案例"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">截止日期</label>
                  <input
                    type="date"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.next_action_date}
                    onChange={(e) => setForm((f) => ({ ...f, next_action_date: e.target.value }))}
                  />
                </div>
              </div>

              {workspaces.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">关联 JD Workspace</label>
                  <select
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.workspace_id}
                    onChange={(e) => setForm((f) => ({ ...f, workspace_id: e.target.value }))}
                  >
                    <option value="">不关联</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.company} · {w.position}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">备注与感受</label>
                <textarea
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="聊得还不错，面试官主要关注数据分析能力..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              {editing ? (
                <button
                  onClick={() => handleDelete(editing.id)}
                  className="text-xs text-destructive hover:opacity-70 transition-opacity flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  删除
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.company.trim() || !form.position.trim()}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
