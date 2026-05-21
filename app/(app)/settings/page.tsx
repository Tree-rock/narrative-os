// anti-patterns-lint-allow
"use client"

import { useState, useEffect } from "react"
import { Check, ExternalLink, ShieldCheck } from "lucide-react"
import { getSettings, saveSettings, PROVIDER_CONFIG } from "@/lib/settings"
import type { AIProvider, AISettings } from "@/types/experience"

const PROVIDER_ORDER: AIProvider[] = [
  "anthropic",
  "openai",
  "gemini",
  "deepseek",
  "groq",
  "moonshot",
  "siliconflow",
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<AISettings>({
    provider: "anthropic",
    apiKeys: {},
  })
  // Track whether initial localStorage load is complete.
  // Using state (not ref) so the auto-save effect sees hasLoaded=false
  // during the same render cycle in which we call setSettings(getSettings()).
  const [hasLoaded, setHasLoaded] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)

  // ── Load from localStorage once on mount ───────────────────
  useEffect(() => {
    setSettings(getSettings())
    setHasLoaded(true)
  }, [])

  // ── Auto-save whenever settings change (skip before load) ──
  useEffect(() => {
    if (!hasLoaded) return
    saveSettings(settings)
    setSaveFlash(true)
    const t = setTimeout(() => setSaveFlash(false), 1500)
    return () => clearTimeout(t)
  }, [settings, hasLoaded])

  const activeProvider = settings.provider
  const activeCfg = PROVIDER_CONFIG[activeProvider]
  const activeKey = settings.apiKeys[activeProvider] ?? ""

  function selectProvider(p: AIProvider) {
    setSettings((s) => ({ ...s, provider: p }))
    setKeyVisible(false)
  }

  function setKey(val: string) {
    setSettings((s) => ({
      ...s,
      apiKeys: { ...s.apiKeys, [s.provider]: val },
    }))
  }

  function setProfileField(field: "name" | "targetRole", val: string) {
    setSettings((s) => ({
      ...s,
      profile: { ...s.profile, [field]: val },
    }))
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground font-normal leading-none">
          设置
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          配置 AI 提供商和个人信息。所有内容仅存储在本地浏览器。
        </p>
      </div>

      <div className="space-y-4">
        {/* ── AI 配置 ─────────────────────────────────────── */}
        <div className="narrative-card p-5">
          <h2 className="text-sm font-medium text-foreground mb-1">AI 提供商</h2>
          <p className="text-xs text-muted-foreground mb-4">
            每个提供商单独保存 API Key，随时切换，互不影响。
          </p>

          {/* Provider 网格 */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {PROVIDER_ORDER.map((p) => {
              const cfg = PROVIDER_CONFIG[p]
              const isActive = p === activeProvider
              const hasKey = !!(settings.apiKeys[p])

              return (
                <button
                  key={p}
                  onClick={() => selectProvider(p)}
                  className={[
                    "relative p-3 rounded-xl border text-left transition-all duration-150",
                    isActive
                      ? "border-primary/50 bg-accent ring-1 ring-primary/20"
                      : "border-border/60 bg-card hover:border-border",
                  ].join(" ")}
                >
                  {hasKey && (
                    <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  <div className="text-sm font-medium text-foreground pr-3">
                    {cfg.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {cfg.description}
                  </div>
                  {cfg.freeTier && (
                    <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {cfg.freeTier}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 当前 provider 的 Key 输入 */}
          <div className="border-t border-border/40 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">
                {activeCfg.name} API Key
              </label>
              <a
                href={activeCfg.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                获取 Key
                <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
              </a>
            </div>

            <div className="relative">
              <input
                type={keyVisible ? "text" : "password"}
                value={activeKey}
                onChange={(e) => setKey(e.target.value)}
                placeholder={`粘贴 ${activeCfg.name} API Key…`}
                className="w-full px-3 py-2.5 pr-16 text-sm bg-muted/30 border border-border/60 rounded-xl placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all font-mono"
              />
              {activeKey && (
                <button
                  type="button"
                  onClick={() => setKeyVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {keyVisible ? "隐藏" : "显示"}
                </button>
              )}
            </div>

            {/* Save status */}
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground/60">
                {activeKey
                  ? "Key 仅存储在本地浏览器，不上传任何服务器。"
                  : activeCfg.freeTier
                    ? `${activeCfg.name} ${activeCfg.freeTier}，注册即可使用。`
                    : `需要 ${activeCfg.name} API Key，与消费者订阅独立计费。`}
              </p>
              {activeKey && (
                <span className="flex items-center gap-1 text-[11px] text-primary shrink-0">
                  <ShieldCheck className="w-3 h-3" strokeWidth={1.5} />
                  已保存
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── 说明卡片 ─────────────────────────────────────── */}
        <div className="narrative-card p-4 bg-accent/40">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">关于 API Key 和会员订阅</span>
            <br />
            Claude.ai Pro、ChatGPT Plus 等消费者订阅仅用于网页产品，
            不包含 API 调用权限。API Key 需在各平台开发者控制台单独获取，
            按实际使用量计费。对于个人求职用途，总花费通常在几元以内。
          </p>
        </div>

        {/* ── 飞书集成 ─────────────────────────────────────── */}
        <div className="narrative-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">飞书多维表格</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                将求职进度同步到飞书 · 开发中
              </p>
            </div>
            <button
              disabled
              className="px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground cursor-not-allowed"
            >
              即将上线
            </button>
          </div>
        </div>

        {/* ── 个人信息 ─────────────────────────────────────── */}
        <div className="narrative-card p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">个人信息</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">称呼</label>
              <input
                type="text"
                value={settings.profile?.name ?? ""}
                onChange={(e) => setProfileField("name", e.target.value)}
                placeholder="你希望 AI 怎么称呼你？"
                className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/60 rounded-xl placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                目标岗位方向
              </label>
              <input
                type="text"
                value={settings.profile?.targetRole ?? ""}
                onChange={(e) => setProfileField("targetRole", e.target.value)}
                placeholder="如：内容运营、AI 产品、增长运营…"
                className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/60 rounded-xl placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 底部状态 */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground/60">
          已配置：{PROVIDER_ORDER.filter((p) => settings.apiKeys[p]).length} / {PROVIDER_ORDER.length} 个提供商
        </p>
        <span
          className={[
            "flex items-center gap-1.5 text-xs transition-all duration-300",
            saveFlash ? "text-primary" : "text-muted-foreground/40",
          ].join(" ")}
        >
          <Check className="w-3 h-3" strokeWidth={2} />
          已自动保存
        </span>
      </div>
    </div>
  )
}
