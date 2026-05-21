// ─── 经历条目（核心数据结构）────────────────────────────────
export type InputType = "text" | "voice" | "resume" | "upload"

export interface ExperienceEntry {
  id: string
  user_id?: string

  // 原始输入
  raw_input: string
  input_type: InputType

  // AI 结构化提取
  project_name?: string
  role?: string
  time_period?: string
  actions?: string[]
  skills?: string[]
  results?: string[]
  metrics?: string
  emotions?: string
  values?: string
  turning_pt?: string

  // 多版本叙事
  v_summary?: string
  v_star?: string
  v_concise?: string
  v_chat?: string
  v_pressure?: string

  // 求职元数据
  suitable_roles?: string[]
  potential_qs?: string[]

  // 用户控制
  locked?: boolean   // 锁定后不再被自动覆盖，手动编辑有效
  archived?: boolean

  created_at: string
  updated_at: string
}

// AI 提取 API 的返回结构（部分字段，不含 id / user_id 等）
export type ExtractedExperience = Omit<
  ExperienceEntry,
  "id" | "user_id" | "raw_input" | "input_type" | "created_at" | "updated_at"
>

// ─── AI 设置 ─────────────────────────────────────────────────
export type AIProvider =
  | "anthropic"   // Claude (Anthropic SDK)
  | "openai"      // GPT-4.1 / GPT-4o
  | "gemini"      // Gemini 2.0 Flash (OpenAI-compat endpoint)
  | "deepseek"    // DeepSeek Chat
  | "groq"        // Llama 3.3 (free tier, fast)
  | "moonshot"    // Kimi / Moonshot
  | "siliconflow" // 硅基流动 (aggregator)

export interface AISettings {
  provider: AIProvider
  // @anchor: per-provider-key-map — one key stored per provider, switching never loses keys
  apiKeys: Partial<Record<AIProvider, string>>
  profile?: {
    name?: string
    targetRole?: string
  }
}

// ─── 聊天消息 ────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  experienceDetected?: boolean // AI 在回复中检测到经历描述
  createdAt: Date
}
