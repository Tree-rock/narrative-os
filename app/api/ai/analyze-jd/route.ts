// anti-patterns-lint-allow
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { extractJSON, friendlyError } from "@/lib/ai-utils"
import { PROVIDER_CONFIG } from "@/lib/settings"
import type { AIProvider } from "@/types/experience"

const SYSTEM = `你是职业求职顾问，擅长解析招聘 JD。

严格按以下 JSON 格式输出，不添加 JSON 以外的文字。

{
  "title": "职位名称",
  "company": "公司名称（如未明确写 unknown）",
  "summary": "职位核心概述（50字以内，突出最关键的一句话）",
  "key_requirements": ["核心要求1（20字以内，动词开头）", "核心要求2"],
  "keywords": ["技能/工具标签1", "标签2"],
  "culture_signals": ["公司文化线索1（从JD语言中提炼）"],
  "red_flags": ["潜在注意项（如要求苛刻/描述模糊等；如无则空数组）"]
}`

export async function POST(req: NextRequest) {
  const { jd_text, provider = "anthropic", apiKey } = (await req.json()) as {
    jd_text: string
    provider?: AIProvider
    apiKey?: string
  }

  if (!jd_text?.trim()) {
    return NextResponse.json({ error: "请提供 JD 内容" }, { status: 400 })
  }

  const cfg = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.anthropic
  const key = apiKey || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : "")
  if (!key) {
    return NextResponse.json(
      { error: `请在设置中配置 ${cfg.name} API Key` },
      { status: 400 }
    )
  }

  const userMsg = `分析以下招聘 JD：\n\n${jd_text}`

  try {
    let responseText: string

    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey: key })
      const msg = await client.messages.create({
        model: cfg.defaultModel,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      })
      responseText = msg.content[0].type === "text" ? msg.content[0].text : ""
    } else {
      if (!cfg.baseUrl) throw new Error("Provider 配置错误")
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: cfg.defaultModel,
          max_tokens: 1500,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userMsg },
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

    return NextResponse.json(extractJSON(responseText))
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 })
  }
}
