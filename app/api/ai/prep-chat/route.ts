// anti-patterns-lint-allow
import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { friendlyError } from "@/lib/ai-utils"
import { PROVIDER_CONFIG } from "@/lib/settings"
import type { AIProvider, ExperienceEntry } from "@/types/experience"
import type { ParsedJD } from "@/types/workspace"
import type { PrepNote } from "@/types/prep"

// ─── 面试教练系统提示 ─────────────────────────────────────────
const PREP_COACH_SYSTEM = `你是用户的专属面试准备教练，针对特定职位和 JD 进行深度备考辅导。

角色定位：像一位既熟悉面试套路、又真正了解用户经历的朋友。不是模板生产机器，是帮用户找到最真实、最有说服力的表达方式。

对话原则：
- 每次聚焦一个问题，引导用户完整思考后再进入下一个
- 适度追问细节：结果如何？当时你的具体判断是什么？有没有数字？
- 不替用户背答案，而是帮用户找到自己故事里的亮点
- 不要使用 emoji 或表情符号；如需强调，使用 Markdown 加粗或列表
- 开场时主动从 JD 的关键要求出发，提问用户感觉最需要准备的方向

【标记规则】满足以下全部条件时，在回复末尾添加 [PREP_NOTE_DETECTED]：
1. 本轮回复整理出了一个完整的面试问题 + 准备答案（含情景/行动/结果，或完整观点）
2. 答案具体、可直接用于面试（不是泛泛的建议）
3. 本轮对话还未对此问题添加过标记

不在以下情况添加：纯粹追问阶段、用户还没给出完整回答、泛泛讨论方向。`

type ChatMsg = { role: "user" | "assistant"; content: string }

function sanitizeModelText(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, "")
}

function buildContext(
  jd: ParsedJD,
  experiences: ExperienceEntry[],
  prepNotes: PrepNote[]
): string {
  const jdBlock = [
    `职位：${jd.title}（${jd.company}）`,
    `概述：${jd.summary}`,
    `关键要求：\n${jd.key_requirements.map((r) => `• ${r}`).join("\n")}`,
    jd.culture_signals.length ? `文化信号：${jd.culture_signals.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const expBlock = experiences
    .map((e) =>
      [
        `【${e.project_name ?? "经历"}】${e.time_period ? ` ${e.time_period}` : ""}`,
        e.role ? `角色：${e.role}` : "",
        e.v_concise ?? e.v_summary ?? "",
        e.metrics ? `数据：${e.metrics}` : "",
        e.skills?.length ? `技能：${e.skills.join("、")}` : "",
        e.v_star ? `STAR：${e.v_star}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n")

  const notesBlock =
    prepNotes.length > 0
      ? `已准备的问题（避免重复）：\n${prepNotes.map((n) => `• ${n.question}`).join("\n")}`
      : "尚未准备任何问题，从最重要的开始。"

  return `\n\n【当前职位 JD】\n${jdBlock}\n\n【候选人激活的经历】\n${expBlock || "（暂无激活经历）"}\n\n【${notesBlock}】`
}

// ─── OpenAI-compat streaming（复用 chat/route.ts 相同逻辑）────
// @anchor: prep-openai-stream
function openAICompatStream(upstreamRes: Response, encoder: TextEncoder): ReadableStream {
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
            } catch { /* skip malformed */ }
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
  const { messages, jd, experiences, prepNotes, provider = "anthropic", apiKey } =
    (await req.json()) as {
      messages: ChatMsg[]
      jd: ParsedJD
      experiences: ExperienceEntry[]
      prepNotes: PrepNote[]
      provider?: AIProvider
      apiKey?: string
    }

  const cfg = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.anthropic
  const key = apiKey || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : "")
  if (!key) {
    return Response.json({ error: `请在设置中配置 ${cfg.name} API Key` }, { status: 400 })
  }

  const systemPrompt = PREP_COACH_SYSTEM + buildContext(jd, experiences ?? [], prepNotes ?? [])
  const encoder = new TextEncoder()
  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  }

  // ── Anthropic ─────────────────────────────────────────────
  if (provider === "anthropic") {
    try {
      const client = new Anthropic({ apiKey: key })
      const upstream = await client.messages.create({
        model: cfg.defaultModel,
        max_tokens: 2000,
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

  // ── OpenAI-compatible ─────────────────────────────────────
  if (!cfg.baseUrl) return Response.json({ error: "Provider 配置错误" }, { status: 500 })
  try {
    const upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: cfg.defaultModel,
        max_tokens: 2000,
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    })
    if (!upstream.ok) {
      const err = (await upstream.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      throw new Error(err.error?.message ?? `${cfg.name} API 错误 (${upstream.status})`)
    }
    return new Response(openAICompatStream(upstream, encoder), { headers: sseHeaders })
  } catch (e) {
    return Response.json({ error: friendlyError(e) }, { status: 500 })
  }
}
