// anti-patterns-lint-allow
import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { friendlyError } from "@/lib/ai-utils"
import { PROVIDER_CONFIG } from "@/lib/settings"
import type { AIProvider, ExperienceEntry } from "@/types/experience"
import type { ArtifactType, ParsedJD } from "@/types/workspace"

// ─── System prompts ───────────────────────────────────────────

const SYSTEMS: Record<ArtifactType, string> = {
  greeting: `你是求职写作专家。根据 JD 和候选人经历，写一封主动联系招聘方的打招呼消息。

要求：
- 150字以内，简洁有力
- 语气真诚自然，像人说的话，不像模板
- 第一句点明与该职位的契合点
- 提及1-2个最匹配的具体经历/数据
- 结尾用开放式邀请而非急切推销
- 不要用"您好，我叫XXX"等流水线开头
- 不要使用 emoji 或表情符号

直接输出消息正文，不要任何说明或标题。`,

  interview_prep: `你是面试教练。根据 JD 要求和候选人经历，生成结构化面试准备材料。

格式：
## 核心问题准备

### [问题1，对应JD某个关键要求]
**匹配经历：**[经历名称]
**STAR 回答框架：**
- 背景/任务：
- 行动：
- 结果：

（重复2-3个最重要的问题）

## 你可以问面试官的问题
- [2-3个有质量的反问]

直接输出 Markdown 格式，不要其他说明。不要使用 emoji 或表情符号。`,

  resume_bullets: `你是简历写作专家。将候选人经历改写为与目标 JD 高度匹配的简历条目。

要求：
- 每段经历输出1-2条 bullet
- 强动词开头（主导、推动、搭建、提升…）
- 包含具体数字/结果
- 关键词与 JD 匹配
- 不要使用 emoji 或表情符号

格式：
**[经历名称]**
• [bullet 1]
• [bullet 2（如有）]

直接输出，不要额外说明。`,
}

function sanitizeModelText(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, "")
}

// ─── Build user message ───────────────────────────────────────

function buildUserMsg(
  type: ArtifactType,
  jd: ParsedJD,
  experiences: ExperienceEntry[]
): string {
  const jdBlock = [
    `职位：${jd.title}（${jd.company}）`,
    `概述：${jd.summary}`,
    `关键要求：\n${jd.key_requirements.map((r) => `- ${r}`).join("\n")}`,
    `关键词：${jd.keywords.join("、")}`,
    jd.culture_signals.length
      ? `文化信号：${jd.culture_signals.join("、")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")

  const expBlock = experiences
    .map((e) =>
      [
        `【${e.project_name ?? "经历"}】`,
        e.role ? `角色：${e.role}` : "",
        e.v_concise ? `简洁版：${e.v_concise}` : "",
        e.metrics ? `数据：${e.metrics}` : "",
        e.results?.length ? `成果：${e.results.join("；")}` : "",
        e.skills?.length ? `技能：${e.skills.join("、")}` : "",
        e.v_star ? `STAR：${e.v_star}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n")

  const labels: Record<ArtifactType, string> = {
    greeting: "请为我写一封打招呼消息",
    interview_prep: "请为我生成面试准备材料",
    resume_bullets: "请将我的经历改写为匹配该 JD 的简历条目",
  }

  return `目标 JD：\n${jdBlock}\n\n候选人激活的经历：\n${expBlock}\n\n${labels[type]}`
}

// ─── OpenAI-compat streaming helper ──────────────────────────
// @anchor: artifact-openai-stream — same pattern as chat/route.ts openAICompatStream
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
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: sanitizeModelText(text) })}\n\n`))
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
  const { type, jd, experiences, provider = "anthropic", apiKey } = (await req.json()) as {
    type: ArtifactType
    jd: ParsedJD
    experiences: ExperienceEntry[]
    provider?: AIProvider
    apiKey?: string
  }

  if (!type || !jd || !experiences?.length) {
    return Response.json({ error: "缺少必要参数" }, { status: 400 })
  }

  const cfg = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.anthropic
  const key = apiKey || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : "")
  if (!key) {
    return Response.json({ error: `请在设置中配置 ${cfg.name} API Key` }, { status: 400 })
  }

  const system = SYSTEMS[type]
  const userMsg = buildUserMsg(type, jd, experiences)
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
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: userMsg }],
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
                  encoder.encode(`data: ${JSON.stringify({ text: sanitizeModelText(event.delta.text) })}\n\n`)
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: cfg.defaultModel,
        max_tokens: 1500,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    })
    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? `${cfg.name} API 错误 (${upstream.status})`)
    }
    return new Response(openAICompatStream(upstream, encoder), { headers: sseHeaders })
  } catch (e) {
    return Response.json({ error: friendlyError(e) }, { status: 500 })
  }
}
