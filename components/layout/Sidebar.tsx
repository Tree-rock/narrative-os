"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCloudSync } from "@/components/auth/CloudSyncProvider"
import {
  MessageSquare,
  BookOpen,
  Briefcase,
  LayoutGrid,
  Settings,
  Cloud,
  LogIn,
  LogOut,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/",             label: "主工作台", icon: MessageSquare },
  { href: "/experiences",  label: "经历库",   icon: BookOpen },
  { href: "/workspaces",   label: "Workspaces", icon: Briefcase },
  { href: "/applications", label: "求职追踪", icon: LayoutGrid },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, status, signOut } = useCloudSync()
  const statusCopy = {
    local: "本地模式",
    syncing: "同步中",
    synced: "已云同步",
    error: "同步异常",
  }[status]

  return (
    <aside className="w-[220px] h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 sticky top-0">
      {/* 品牌 */}
      <div className="px-5 pt-6 pb-5">
        <div className="font-serif text-[18px] leading-none text-foreground tracking-tight">
          叙事
        </div>
        <div className="text-[11px] text-muted-foreground/70 tracking-widest mt-1.5 uppercase">
          Narrative OS
        </div>
      </div>

      {/* 主导航 */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon
                className="w-[15px] h-[15px] shrink-0"
                strokeWidth={isActive ? 2 : 1.5}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 底部：设置 */}
      <div className="px-3 pb-4 pt-3 border-t border-sidebar-border">
        <div className="mb-2 rounded-lg border border-border/50 bg-muted/25 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cloud className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{statusCopy}</span>
          </div>
          {user?.email ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] text-foreground/70">{user.email}</span>
              <button
                onClick={() => void signOut()}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
                title="退出登录"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
            >
              <LogIn className="w-3 h-3" strokeWidth={1.5} />
              登录后云端保存
            </Link>
          )}
        </div>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          <Settings
            className="w-[15px] h-[15px] shrink-0"
            strokeWidth={pathname.startsWith("/settings") ? 2 : 1.5}
          />
          设置
        </Link>
      </div>
    </aside>
  )
}
