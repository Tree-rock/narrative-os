// anti-patterns-lint-allow
"use client"

import { useState, useEffect } from "react"
import { Plus, BookOpen, Pencil, Archive, Lock, Unlock } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { localArchiveExperience, localGetExperiences, localUpdateExperience } from "@/lib/local-store"
import { AddExperienceModal } from "@/components/experiences/AddExperienceModal"
import { ExperienceEditModal } from "@/components/experiences/ExperienceEditModal"
import { ArchiveConfirmModal } from "@/components/ui/ArchiveConfirmModal"
import type { ExperienceEntry } from "@/types/experience"

// ─── Skill chip ───────────────────────────────────────────────
function Chip({ label, variant = "muted" }: { label: string; variant?: "accent" | "muted" | "secondary" }) {
  const cls = {
    accent: "bg-accent text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  }[variant]
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

// ─── Experience card ──────────────────────────────────────────
function ExperienceCard({
  exp,
  onArchive,
  onEdit,
  onToggleLock,
}: {
  exp: ExperienceEntry
  onArchive: (id: string) => void
  onEdit: (exp: ExperienceEntry) => void
  onToggleLock: (id: string) => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "narrative-card p-5 group transition-all",
        exp.locked && "border-primary/20 bg-accent/20"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* 标题行 */}
          <div className="flex items-center gap-2 mb-1.5">
            {exp.locked && (
              <Lock className="w-3 h-3 text-primary/60 shrink-0" strokeWidth={1.5} />
            )}
            <h3 className="text-sm font-medium text-foreground leading-snug">
              {exp.project_name ?? exp.raw_input.slice(0, 40) + "…"}
            </h3>
            {exp.time_period && (
              <span className="text-xs text-muted-foreground shrink-0">{exp.time_period}</span>
            )}
          </div>

          {/* 角色 */}
          {exp.role && (
            <p className="text-xs text-muted-foreground mb-2">{exp.role}</p>
          )}

          {/* 简洁版 */}
          {exp.v_concise && (
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">{exp.v_concise}</p>
          )}

          {/* 标签行 */}
          <div className="flex flex-wrap items-center gap-2">
            {(exp.skills ?? []).slice(0, 4).map((s) => (
              <Chip key={s} label={s} variant="accent" />
            ))}
            {exp.metrics && <Chip label={`✦ ${exp.metrics}`} variant="secondary" />}
          </div>

          {/* 适配岗位 */}
          {(exp.suitable_roles ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(exp.suitable_roles ?? []).slice(0, 3).map((r) => (
                <span key={r} className="text-[11px] text-muted-foreground">→ {r}</span>
              ))}
            </div>
          )}
        </div>

        {/* 操作按钮（hover 显示） */}
        <div className={cn(
          "flex flex-col gap-1 shrink-0 transition-opacity duration-150",
          showActions ? "opacity-100" : "opacity-0"
        )}>
          <button
            onClick={() => onEdit(exp)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="编辑"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => onToggleLock(exp.id)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              exp.locked
                ? "text-primary hover:text-foreground hover:bg-muted"
                : "text-muted-foreground hover:text-primary hover:bg-muted"
            )}
            title={exp.locked ? "解锁" : "锁定"}
          >
            {exp.locked
              ? <Unlock className="w-3.5 h-3.5" strokeWidth={1.5} />
              : <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />}
          </button>
          <button
            onClick={() => onArchive(exp.id)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="归档"
          >
            <Archive className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingExp, setEditingExp] = useState<ExperienceEntry | null>(null)
  const [archivingExp, setArchivingExp] = useState<ExperienceEntry | null>(null)
  const [activeSkill, setActiveSkill] = useState<string | null>(null)

  useEffect(() => {
    setExperiences(localGetExperiences())
  }, [])

  function confirmArchive() {
    const exp = archivingExp
    if (!exp) return
    const id = exp.id
    const archived = localArchiveExperience(id)
    if (!archived) return
    localStorage.setItem("narrative_last_archive", JSON.stringify({ type: "experience", id, previous: exp }))
    setExperiences((prev) => prev.filter((e) => e.id !== id))
    setArchivingExp(null)
  }

  function handleToggleLock(id: string) {
    const exp = experiences.find((e) => e.id === id)
    if (!exp) return
    const updated = localUpdateExperience(id, { locked: !exp.locked })
    if (updated) setExperiences((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }

  function handleSaveEdit(updated: ExperienceEntry) {
    setExperiences((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingExp(null)
  }

  function handleSavedNew(entry: ExperienceEntry) {
    setExperiences((prev) => [entry, ...prev])
    setAddModalOpen(false)
  }

  const allSkills = Array.from(
    new Set(experiences.flatMap((e) => e.skills ?? []))
  ).slice(0, 12)

  const filtered = activeSkill
    ? experiences.filter((e) => (e.skills ?? []).includes(activeSkill))
    : experiences

  // Counts for header
  const lockedCount = experiences.filter((e) => e.locked).length

  return (
    <>
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl text-foreground font-normal leading-none">
              经历库
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              你积累的每一段经历，都是叙事的原材料。
              {lockedCount > 0 && (
                <span className="ml-2 text-[11px] text-primary">
                  {lockedCount} 条已锁定
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            添加经历
          </button>
        </div>

        {/* 能力标签云 */}
        {allSkills.length > 0 && (
          <div className="mb-8">
            <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest mb-3">
              能力标签
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveSkill(null)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  !activeSkill
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                全部
              </button>
              {allSkills.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveSkill(tag === activeSkill ? null : tag)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    activeSkill === tag
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 经历卡片列表 */}
        {filtered.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((exp) => (
                <ExperienceCard
                  key={exp.id}
                  exp={exp}
                  onArchive={(id) => setArchivingExp(experiences.find((e) => e.id === id) ?? null)}
                  onEdit={setEditingExp}
                  onToggleLock={handleToggleLock}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <BookOpen className="w-10 h-10 text-muted-foreground/25 mx-auto mb-4" strokeWidth={1} />
            <p className="text-sm text-muted-foreground/60 mb-2">
              {activeSkill ? `没有包含「${activeSkill}」标签的经历` : "经历库还是空的"}
            </p>
            {!activeSkill && (
              <button
                onClick={() => setAddModalOpen(true)}
                className="text-sm text-primary hover:underline"
              >
                添加第一段经历 →
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <AddExperienceModal
            onClose={() => setAddModalOpen(false)}
            onSaved={handleSavedNew}
          />
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingExp && (
          <ExperienceEditModal
            exp={editingExp}
            onClose={() => setEditingExp(null)}
            onSaved={handleSaveEdit}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {archivingExp && (
          <ArchiveConfirmModal
            title={`归档「${archivingExp.project_name ?? archivingExp.raw_input.slice(0, 24)}」？`}
            description="归档后会从经历库列表中隐藏。误操作时，可以回到首页对话里输入「撤回归档」恢复最近一次归档。"
            onCancel={() => setArchivingExp(null)}
            onConfirm={confirmArchive}
          />
        )}
      </AnimatePresence>
    </>
  )
}
