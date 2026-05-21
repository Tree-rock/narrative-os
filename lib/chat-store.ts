// anti-patterns-lint-allow
import type { ChatMessage } from "@/types/experience"

const KEY = "narrative_chat"
const MAX_STORED = 80   // 保留最近 80 条，避免 localStorage 过大

// Serialization: ChatMessage.createdAt is a Date object; JSON stores it as string
interface StoredMessage {
  id: string
  role: "user" | "assistant"
  content: string
  experienceDetected?: boolean
  createdAt: string   // ISO string
}

export function chatLoad(): ChatMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const stored: StoredMessage[] = JSON.parse(raw)
    return stored.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }))
  } catch {
    return []
  }
}

export function chatSave(messages: ChatMessage[]): void {
  // Never persist the static welcome message (id="welcome")
  const toStore: StoredMessage[] = messages
    .filter((m) => m.id !== "welcome")
    .slice(-MAX_STORED)
    .map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
  localStorage.setItem(KEY, JSON.stringify(toStore))
}

export function chatClear(): void {
  localStorage.removeItem(KEY)
}
