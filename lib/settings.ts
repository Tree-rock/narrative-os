// anti-patterns-lint-allow
import type { AISettings, AIProvider } from "@/types/experience"

const SETTINGS_KEY = "narrative_settings"

// ─── Provider metadata ────────────────────────────────────────
export interface ProviderMeta {
  name: string
  description: string    // 显示在卡片上的模型/能力说明
  defaultModel: string
  baseUrl: string | null // null = use Anthropic SDK
  keyUrl: string         // 去哪里获取 API Key
  freeTier?: string      // 免费额度说明（有则显示绿色徽章）
}

export const PROVIDER_CONFIG: Record<AIProvider, ProviderMeta> = {
  anthropic: {
    name: "Claude",
    description: "claude-sonnet-4-6 · 推理强 · 支持图片",
    defaultModel: "claude-sonnet-4-6",
    baseUrl: null,
    keyUrl: "https://console.anthropic.com",
  },
  openai: {
    name: "ChatGPT / OpenAI",
    description: "gpt-4.1 · 全能 · 最广泛",
    defaultModel: "gpt-4.1",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  gemini: {
    name: "Google Gemini",
    description: "gemini-2.0-flash · 快速 · 有免费额度",
    defaultModel: "gemini-2.0-flash",
    // @anchor: gemini-openai-compat — Google 提供 OpenAI 兼容端点
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/app/apikey",
    freeTier: "每天免费",
  },
  deepseek: {
    name: "DeepSeek",
    description: "deepseek-chat · 极便宜 · 中文优秀",
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com",
  },
  groq: {
    name: "Groq",
    description: "llama-3.3-70b · 极速 · 有免费额度",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    freeTier: "有免费额度",
  },
  moonshot: {
    name: "Moonshot (Kimi)",
    description: "moonshot-v1-8k · 长文本 · 中文",
    defaultModel: "moonshot-v1-8k",
    baseUrl: "https://api.moonshot.cn/v1",
    keyUrl: "https://platform.moonshot.cn",
  },
  siliconflow: {
    name: "硅基流动",
    description: "聚合多模型 · 国内访问快",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    baseUrl: "https://api.siliconflow.cn/v1",
    keyUrl: "https://cloud.siliconflow.cn",
    freeTier: "注册赠额度",
  },
}

// ─── Read / write ─────────────────────────────────────────────
export function getSettings(): AISettings {
  if (typeof window === "undefined")
    return { provider: "anthropic", apiKeys: {} }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { provider: "anthropic", apiKeys: {} }
    const parsed = JSON.parse(raw)
    // @anchor: back-compat — migrate old { provider, apiKey: string } shape
    if (typeof parsed.apiKey === "string") {
      return {
        provider: parsed.provider ?? "anthropic",
        apiKeys: { [parsed.provider ?? "anthropic"]: parsed.apiKey },
      }
    }
    return parsed
  } catch {
    return { provider: "anthropic", apiKeys: {} }
  }
}

export function saveSettings(settings: AISettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/** 返回当前激活的 API Key（用于 API 调用） */
export function getActiveKey(): string {
  const s = getSettings()
  return s.apiKeys[s.provider] ?? ""
}

export function getProvider(): AIProvider {
  return getSettings().provider
}
