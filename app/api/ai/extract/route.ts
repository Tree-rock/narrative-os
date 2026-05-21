// anti-patterns-lint-allow
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { extractJSON, friendlyError } from "@/lib/ai-utils"
import { PROVIDER_CONFIG } from "@/lib/settings"
import type { AIProvider } from "@/types/experience"

const SYSTEM = `你是职业叙事顾问，专注于从描述中提取结构化经历信息。

严格按以下 JSON 格式输出，不添加 JSON 以外的文字。
JSON 字符串值中若需换行使用 \\n，不得包含实际换行符。
所有字段都不要使用 emoji 或表情符号。

{
  "project_name": "项目或经历名称（10字以内）",
  "role": "担任的角色或职位",
  "time_period": "时间段（如无则null）",
  "actions": ["行动1（动词开头）", "行动2"],
  "skills": ["能力标签1", "能力标签2"],
  "results": ["具体成果1", "具体成果2"],
  "metrics": "核心数字指标（如无则null）",
  "emotions": "情绪感受（如无则null）",
  "values": "价值观或动机（如无则null）",
  "turning_pt": "关键转折点（如无则null）",
  "suitable_roles": ["适配求职方向1", "适配求职方向2"],
  "potential_qs": ["面试官可能追问的问题1", "问题2"],
  "v_summary": "入库总结版（最完整版本，120-220字。必须整合上下文中的背景、角色、行动、方法、结果、指标和价值。后续所有字段都必须基于这个版本提取，不得只基于零散原文）",
  "v_star": "STAR叙事版（100-150字：背景/任务/行动/结果）",
  "v_concise": "简洁版（20字以内，强动词开头，适合简历bullet）",
  "v_chat": "对话版（50-70字，语气自然有温度）",
  "v_pressure": "高压面试版（直接有力，70字以内）"
}`

export async function POST(req: NextRequest) {
  const {
    text,
    assistantSummary,
    conversation,
    provider = "anthropic",
    apiKey,
  } = (await req.json()) as {
    text: string
    assistantSummary?: string
    conversation?: Array<{ role: "user" | "assistant"; content: string }>
    provider?: AIProvider
    apiKey?: string
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: "请提供要分析的文字内容" }, { status: 400 })
  }

  const cfg = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.anthropic
  const key = apiKey || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : "")
  if (!key) {
    return NextResponse.json(
      { error: `请在设置中配置 ${cfg.name} API Key` },
      { status: 400 }
    )
  }

  const contextLines = (conversation ?? [])
    .slice(-10)
    .map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`)
    .join("\n\n")

  const userMsg = assistantSummary?.trim()
    ? `请先生成 v_summary，再基于 v_summary 提取结构化经历信息。

强制规则：
1. v_summary 是入库依据，必须是最完整、可独立理解的一段总结。
2. 优先依据 AI 总结生成 v_summary；原始输入和最近聊天记录只作为补充佐证。
3. 如果 AI 总结、原始输入、聊天记录信息冲突，以信息最完整且最具体的版本为准；不确定就保守表达。
4. 所有结构化字段必须从 v_summary 中抽取或改写，不要机械抽取原始聊天文字。
如果聊天里有多段无关内容，只提取本次总结对应的那一段经历。

【AI 已总结的经历】
${assistantSummary}

【用户原始输入】
${text}

【最近聊天记录】
${contextLines || "无"}`
    : `请先生成 v_summary，再基于 v_summary 提取结构化经历信息。

强制规则：
1. v_summary 是入库依据，必须是最完整、可独立理解的一段总结。
2. 先理解并重写下面的经历描述，不要机械抽取原文碎片。
3. 所有结构化字段必须从 v_summary 中抽取或改写。

【经历描述】
${text}`

  try {
    let responseText: string

    // ── Anthropic ──────────────────────────────────────────
    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey: key })
      const msg = await client.messages.create({
        model: cfg.defaultModel,
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      })
      responseText = msg.content[0].type === "text" ? msg.content[0].text : ""
    } else {
      // ── OpenAI-compatible (all other providers) ──────────
      if (!cfg.baseUrl) throw new Error("Provider 配置错误")
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: cfg.defaultModel,
          max_tokens: 2500,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userMsg },
          ],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as {
          error?: { message?: string }
        }
        throw new Error(err.error?.message ?? `${cfg.name} API 错误 (${res.status})`)
      }
      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>
      }
      responseText = data.choices[0].message.content
    }

    return NextResponse.json(extractJSON(responseText))
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 })
  }
}
