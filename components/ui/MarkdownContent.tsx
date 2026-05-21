// anti-patterns-lint-allow
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import type { Components } from "react-markdown"

interface Props {
  children: string
  className?: string
  /** Show a blinking cursor at the end — use during streaming */
  streaming?: boolean
  /** Compact variant: tighter spacing, smaller headings */
  compact?: boolean
}

// ─── Shared component map ─────────────────────────────────────
function makeComponents(compact: boolean): Components {
  return {
    p: ({ children }) => (
      <p className={cn("leading-relaxed", compact ? "mb-1 last:mb-0" : "mb-2.5 last:mb-0")}>
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    h1: ({ children }) => (
      <h1 className={cn("font-semibold text-foreground", compact ? "text-sm mt-3 mb-1" : "text-base mt-5 mb-2")}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={cn("font-semibold text-foreground", compact ? "text-[13px] mt-3 mb-1" : "text-sm mt-4 mb-1.5")}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={cn("font-medium text-foreground", compact ? "text-xs mt-2 mb-0.5" : "text-sm mt-3 mb-1")}>
        {children}
      </h3>
    ),
    ul: ({ children }) => (
      <ul className={cn("list-disc list-outside pl-4 marker:text-primary", compact ? "space-y-0.5 my-1" : "space-y-1 my-2")}>
        {children}
      </ul>
    ),
    // Ordered list
    ol: ({ children }) => (
      <ol className={cn("list-decimal list-outside pl-4 marker:text-primary", compact ? "space-y-0.5 my-1" : "space-y-1 my-2")}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="pl-0.5 leading-relaxed">{children}</li>
    ),
    code: ({ className, children }) => {
      const isBlock = Boolean(className?.startsWith("language-"))
      if (isBlock) {
        return <code className={cn("font-mono text-xs", className)}>{children}</code>
      }
      return (
        <code className="bg-muted/70 px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className={cn(
        "bg-muted/50 rounded-xl overflow-x-auto font-mono text-xs leading-relaxed",
        compact ? "p-2.5 my-1.5" : "p-3.5 my-3"
      )}>
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-primary/30 pl-3 text-muted-foreground my-2 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-border/40 my-3" />,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline underline-offset-2"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-2">
        <table className="text-sm border-collapse w-full">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="text-left font-medium text-foreground px-3 py-1.5 border-b border-border/60 bg-muted/30">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-1.5 border-b border-border/30 text-muted-foreground">{children}</td>
    ),
  }
}

// ─── Component ────────────────────────────────────────────────
export function MarkdownContent({ children, className, streaming = false, compact = false }: Props) {
  return (
    <div className={cn("min-w-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={makeComponents(compact)}
      >
        {children}
      </ReactMarkdown>
      {streaming && (
        <span
          aria-hidden
          className="inline-block w-0.5 h-[0.9em] bg-current opacity-60 animate-pulse align-middle ml-0.5 rounded-full"
        />
      )}
    </div>
  )
}
