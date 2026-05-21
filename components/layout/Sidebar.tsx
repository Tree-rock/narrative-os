"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  BookOpen,
  Briefcase,
  LayoutGrid,
  Settings,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/",             label: "主工作台", icon: MessageSquare },
  { href: "/experiences",  label: "经历库",   icon: BookOpen },
  { href: "/workspaces",   label: "Workspaces", icon: Briefcase },
  { href: "/applications", label: "求职追踪", icon: LayoutGrid },
]

export function Sidebar() {
  const pathname = usePathname()

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
