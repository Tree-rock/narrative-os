"use client"

import { Archive, X } from "lucide-react"
import { motion } from "framer-motion"

type ArchiveConfirmModalProps = {
  title: string
  description: string
  onCancel: () => void
  onConfirm: () => void
}

export function ArchiveConfirmModal({
  title,
  description,
  onCancel,
  onConfirm,
}: ArchiveConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        className="absolute inset-0 bg-foreground/[0.06] backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-border/50 bg-card/85 shadow-2xl shadow-foreground/[0.06] backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary">
            <Archive className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-normal leading-tight text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
            title="关闭"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/35 bg-background/25 px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg border border-primary/20 bg-primary/90 px-3 py-2 text-sm text-primary-foreground shadow-sm shadow-primary/10 transition-opacity hover:opacity-90"
          >
            确认归档
          </button>
        </div>
      </motion.div>
    </div>
  )
}
