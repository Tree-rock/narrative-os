// anti-patterns-lint-allow
// @anchor: json-unescaped-newline-repair
function fixLiteralNewlines(str: string): string {
  let result = ""
  let inString = false
  let escaped = false
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (escaped) { result += ch; escaped = false; continue }
    if (ch === "\\" && inString) { escaped = true; result += ch; continue }
    if (ch === '"') { inString = !inString; result += ch; continue }
    if (inString && ch === "\n") { result += "\\n"; continue }
    if (inString && ch === "\r") { result += "\\r"; continue }
    result += ch
  }
  return result
}

export function extractJSON(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("AI 未能返回有效的结构化结果，请重试")
  const raw = match[0]
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(fixLiteralNewlines(raw))
  }
}

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes("authentication") || msg.includes("API key") || msg.includes("Incorrect"))
    return "API Key 无效，请在设置中检查"
  if (msg.includes("rate") || msg.includes("429"))
    return "请求过于频繁，请稍后重试"
  if (msg.includes("overloaded") || msg.includes("529"))
    return "AI 服务繁忙，请稍后重试"
  if (msg.includes("timeout") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
    return "网络连接失败，请检查网络"
  if (msg.includes("quota") || msg.includes("insufficient"))
    return "API 余额不足，请充值后重试"
  return msg
}
