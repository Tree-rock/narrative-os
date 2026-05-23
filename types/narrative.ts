// ─── 面试叙事条目（从对话提炼，可用于面试作答）────────────────

export type NarrativeCategory =
  | "behavioral"   // 行为类：讲一段……
  | "situational"  // 情景类：如果遇到……
  | "technical"    // 技术类
  | "company"      // 动机类：为什么选择……
  | "general"      // 通用叙事

export interface NarrativeEntry {
  id: string
  title: string               // 短标题，如「推动跨团队协作」
  story: string               // 完整叙事正文（Markdown，可直接讲述）
  category: NarrativeCategory
  tags: string[]              // 关键词，用于匹配 JD 要求
  experience_id?: string      // 关联的经历条目（可选）
  source_excerpt?: string     // 用户发送的原始描述
  created_at: string
  updated_at: string
}
