// ─── JD Workspace 数据结构 ───────────────────────────────────

export interface ParsedJD {
  title: string
  company: string
  summary: string              // 50字内核心概述
  key_requirements: string[]   // 5-8 条关键要求
  keywords: string[]           // 搜索/匹配标签
  culture_signals: string[]    // 公司文化线索
  red_flags: string[]          // 潜在注意项（可空）
}

export type ArtifactType = "greeting" | "interview_prep" | "resume_bullets"

export interface WorkspaceArtifact {
  type: ArtifactType
  content: string
  generated_at: string
}

export interface JDWorkspace {
  id: string
  title: string
  company?: string
  position?: string
  jd_text: string
  parsed_jd?: ParsedJD
  activated_experience_ids: string[]
  artifacts: WorkspaceArtifact[]
  status: "active" | "archived"
  locked?: boolean
  created_at: string
  updated_at: string
}
