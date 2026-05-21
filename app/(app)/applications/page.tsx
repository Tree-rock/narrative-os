// anti-patterns-lint-allow
import { LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

type AppStatus =
  | "drafting"
  | "applied"
  | "phone_screen"
  | "interview"
  | "offer"
  | "rejected"

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string }> = {
  drafting:     { label: "草稿",   color: "bg-muted text-muted-foreground" },
  applied:      { label: "已投递", color: "bg-secondary text-secondary-foreground" },
  phone_screen: { label: "电话面", color: "bg-accent text-accent-foreground" },
  interview:    { label: "面试中", color: "bg-primary/10 text-primary" },
  offer:        { label: "Offer",  color: "bg-green-50 text-green-700" },
  rejected:     { label: "已拒",   color: "bg-destructive/10 text-destructive" },
}

const MOCK_APPLICATIONS = [
  {
    id: "1",
    company: "字节跳动",
    position: "AI 增长运营",
    status: "interview" as AppStatus,
    appliedAt: "2026-05-15",
    nextAction: "准备二面案例",
    nextActionDate: "2026-05-23",
  },
  {
    id: "2",
    company: "小红书",
    position: "内容产品经理",
    status: "applied" as AppStatus,
    appliedAt: "2026-05-18",
    nextAction: "等待 HR 回复",
    nextActionDate: null,
  },
  {
    id: "3",
    company: "得到 APP",
    position: "用户运营",
    status: "drafting" as AppStatus,
    appliedAt: null,
    nextAction: "完善打招呼语",
    nextActionDate: null,
  },
]

export default function ApplicationsPage() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground font-normal leading-none">
            求职追踪
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            每一步都值得被记录。
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity">
          + 新建
        </button>
      </div>

      {/* 状态概览 */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {(["applied", "phone_screen", "interview", "offer", "rejected"] as AppStatus[]).map(
          (s) => {
            const count = MOCK_APPLICATIONS.filter((a) => a.status === s).length
            const cfg = STATUS_CONFIG[s]
            return (
              <div
                key={s}
                className="narrative-card p-3 text-center"
              >
                <div className="text-xl font-light text-foreground mb-1">
                  {count}
                </div>
                <div
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full inline-block",
                    cfg.color
                  )}
                >
                  {cfg.label}
                </div>
              </div>
            )
          }
        )}
      </div>

      {/* 应用列表 */}
      <div className="space-y-3">
        {MOCK_APPLICATIONS.map((app) => {
          const cfg = STATUS_CONFIG[app.status]
          return (
            <div
              key={app.id}
              className="narrative-card p-5 cursor-pointer hover:border-border transition-all duration-150 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {app.company}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {app.position}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full",
                        cfg.color
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  {app.nextAction && (
                    <p className="text-xs text-muted-foreground mt-2">
                      → {app.nextAction}
                      {app.nextActionDate && (
                        <span className="ml-2 text-muted-foreground/60">
                          {app.nextActionDate}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground/50 shrink-0">
                  {app.appliedAt ?? "未投递"}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-center py-4">
        <LayoutGrid
          className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3"
          strokeWidth={1}
        />
        <p className="text-sm text-muted-foreground/60">
          连接飞书多维表格后，进度将自动同步。
        </p>
      </div>
    </div>
  )
}
