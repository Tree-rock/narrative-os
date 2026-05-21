// anti-patterns-lint-allow
import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { friendlyError } from "@/lib/ai-utils"
import { PROVIDER_CONFIG } from "@/lib/settings"
import type { AIProvider } from "@/types/experience"

const COACH_SYSTEM = `你是用户的长期职业叙事教练，风格像一位聪明、有温度、善于倾听的朋友。

核心任务：帮助用户梳理职业经历，通过对话挖掘有价值的细节。

对话原则：
- 每次回复聚焦一件事，不做信息堆砌
- 语气温和、好奇、真诚
- 适度追问：结果是什么？你在其中的角色？有没有具体数字？
- 不替用户定义价值观，不强行给建议
- 不要使用 emoji 或表情符号；如需强调，使用清晰短句、Markdown 列表或系统内已有的文字标签

【标记规则】满足以下全部条件时，在回复末尾添加 [EXPERIENCE_DETECTED]：
1. 用户描述了真实的工作/项目/实践经历（非泛泛提问）
2. 内容足够结构化（至少包含：做了什么 + 结果或背景之一）
3. 本轮对话还未对此经历添加过标记
4. 如果你已经把用户的经历整理成总结、STAR、简历 bullet、面试回答素材，也视为满足标记条件

不在以下情况添加：纯粹提问、过于简短（如「我做过运营」）、已添加过标记。`

type ChatMsg = { role: "user" | "assistant"; content: string }
type MentionContext = {
  experiences?: unknown[]
  jds?: unknown[]
  library?: {
    experiences?: unknown[]
    jds?: unknown[]
  }
  activity?: unknown[]
}

function sanitizeModelText(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, "")
}

// ─── OpenAI-compatible streaming ─────────────────────────────
// @anchor: openai-compat-stream — translates OpenAI SSE format to our { text } SSE format
function openAICompatStream(
  upstreamRes: Response,
  encoder: TextEncoder
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const reader = upstreamRes.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split("\n\n")
          buffer = parts.pop() ?? ""
          for (const part of parts) {
            if (!part.startsWith("data: ")) continue
            const raw = part.slice(6).trim()
            if (raw === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
              continue
            }
            try {
              const chunk = JSON.parse(raw)
              const text: string | undefined = chunk.choices?.[0]?.delta?.content
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: sanitizeModelText(text) })}\n\n`)
                )
              }
            } catch { /* skip malformed chunk */ }
          }
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: friendlyError(e) })}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })
}

// ─── Route handler ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { messages, apiKey, provider = "anthropic", context } = (await req.json()) as {
    messages: ChatMsg[]
    apiKey?: string
    provider?: AIProvider
    context?: MentionContext
  }

  const cfg = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.anthropic
  const key = apiKey || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : "")
  if (!key) {
    return Response.json({ error: `请在设置中配置 ${cfg.name} API Key` }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const experienceCount = context?.experiences?.length ?? 0
  const jdCount = context?.jds?.length ?? 0
  const libraryExperienceCount = context?.library?.experiences?.length ?? 0
  const libraryJdCount = context?.library?.jds?.length ?? 0
  const activityCount = context?.activity?.length ?? 0
  const contextBlock =
    experienceCount > 0 || jdCount > 0 || libraryExperienceCount > 0 || libraryJdCount > 0 || activityCount > 0
      ? `\n\n系统内当前上下文如下。用户显式 @ 的材料优先级最高；系统库快照代表当前可用的经历库和 JD 库；activity 是最近输入、简历解析、入库、恢复等系统事件。归档内容不在当前可用库快照中时，视为已从当前工作系统删除，不要主动作为可用经历或 JD 使用。不要声称库里有未列出的内容；如果材料不足，提出一个具体追问。\n\n${JSON.stringify(context, null, 2)}`
      : ""
  const systemPrompt = `${COACH_SYSTEM}${contextBlock}`
  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  }

  // ── Anthropic (native SDK streaming) ─────────────────────
  if (provider === "anthropic") {
    try {
      const client = new Anthropic({ apiKey: key })
      const upstream = await client.messages.create({
        model: cfg.defaultModel,
        max_tokens: 1000,
        system: systemPrompt,
        messages,
        stream: true,
      })
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of upstream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: sanitizeModelText(event.delta.text) })}\n\n`
                  )
                )
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          } catch (e) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: friendlyError(e) })}\n\n`)
            )
          } finally {
            controller.close()
          }
        },
      })
      return new Response(readable, { headers: sseHeaders })
    } catch (e) {
      return Response.json({ error: friendlyError(e) }, { status: 500 })
    }
  }

  // ── OpenAI-compatible (all other providers) ───────────────
  // @anchor: openai-compat-providers — deepseek / openai / gemini / groq / moonshot / siliconflow
  if (!cfg.baseUrl) {
    return Response.json({ error: "Provider 配置错误" }, { status: 500 })
  }
  try {
    const upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: cfg.defaultModel,
        max_tokens: 1000,
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    })
    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({})) as {
        error?: { message?: string }
      }
      throw new Error(err.error?.message ?? `${cfg.name} API 错误 (${upstream.status})`)
    }
    return new Response(openAICompatStream(upstream, encoder), { headers: sseHeaders })
  } catch (e) {
    return Response.json({ error: friendlyError(e) }, { status: 500 })
  }
}
