// anti-patterns-lint-allow
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { friendlyError } from "@/lib/ai-utils"
import { PROVIDER_CONFIG } from "@/lib/settings"
import type { AIProvider } from "@/types/experience"

const SYSTEM = `你是简历解析专家。从简历中提取所有工作经历、实习经历、项目经历。

每段经历按以下格式，返回 JSON 数组。只输出数组，不添加任何额外文字。
JSON 字符串值中若需换行使用 \\n，不得包含实际换行符。

[
  {
    "project_name": "经历名称（公司+职位，10字以内）",
    "role": "职位或角色",
    "time_period": "时间段（如：2023.06-2024.03，无则null）",
    "actions": ["主要行动1（动词开头）", "行动2"],
    "skills": ["技能1", "技能2"],
    "results": ["量化成果1", "成果2"],
    "metrics": "核心数字指标（无则null）",
    "v_concise": "简历bullet（20字以内，强动词开头）",
    "v_star": "STAR叙事（100-150字，背景/任务/行动/结果）",
    "suitable_roles": ["适配求职方向1", "方向2"]
  }
]

注意：教育经历不纳入提取范围，只提取工作和项目经历。`

// ─── Parse raw JSON array from model response ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseArray(text: string): any[] {
  const stripped = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim()
  try {
    const parsed = JSON.parse(stripped)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed.experiences)) return parsed.experiences
    return [parsed]
  } catch {
    const match = stripped.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    throw new Error("无法解析提取结果，请重试")
  }
}

export async function POST(req: NextRequest) {
  const { text, pdf_base64, provider = "anthropic", apiKey } = (await req.json()) as {
    text?: string
    pdf_base64?: string   // base64-encoded PDF, Anthropic only
    provider?: AIProvider
    apiKey?: string
  }

  if (!text?.trim() && !pdf_base64) {
    return NextResponse.json({ error: "请提供简历内容" }, { status: 400 })
  }

  const cfg = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.anthropic
  const key = apiKey || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : "")
  if (!key) {
    return NextResponse.json(
      { error: `请在设置中配置 ${cfg.name} API Key` },
      { status: 400 }
    )
  }

  try {
    let responseText: string

    // ── Anthropic ─────────────────────────────────────────────
    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey: key })

      // @anchor: anthropic-pdf-document — Claude supports inline PDF via base64 document block
      const userContent: Anthropic.MessageParam["content"] = pdf_base64
        ? [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf_base64,
              },
            } as unknown as Anthropic.TextBlockParam,
            { type: "text", text: "请提取以上简历中的所有工作和项目经历。" },
          ]
        : `提取以下简历的所有工作和项目经历：\n\n${text}`

      const msg = await client.messages.create({
        model: cfg.defaultModel,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      })
      responseText = msg.content[0].type === "text" ? msg.content[0].text : ""
    } else {
      // ── OpenAI-compatible ──────────────────────────────────
      if (!cfg.baseUrl) throw new Error("Provider 配置错误")
      if (pdf_base64) {
        return NextResponse.json(
          { error: "PDF 直接上传仅支持 Claude（Anthropic）提供商，请切换提供商或粘贴简历文本。" },
          { status: 400 }
        )
      }
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: cfg.defaultModel,
          max_tokens: 4000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `提取以下简历的所有工作和项目经历：\n\n${text}` },
          ],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err.error?.message ?? `${cfg.name} API 错误 (${res.status})`)
      }
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      responseText = data.choices[0].message.content
    }

    const experiences = parseArray(responseText)
    return NextResponse.json({ experiences })
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 })
  }
}
