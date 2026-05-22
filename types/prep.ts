// ─── 面试叙事准备（PrepNote）数据结构 ────────────────────────

export type PrepCategory =
  | "behavioral"   // 行为类：讲一个……
  | "situational"  // 情景类：如果遇到……
  | "technical"    // 技术类
  | "company"      // 动机类：为什么选择……
  | "general"      // 通用

export interface PrepNote {
  id: string
  workspace_id: string
  question: string           // 面试问题
  answer: string             // 准备好的回答（Markdown）
  category: PrepCategory
  experience_ids?: string[]  // 关联的经历条目
  pinned?: boolean
  created_at: string
  updated_at: string
}
