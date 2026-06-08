"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, Loader2, Cloud, MessageCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Mode = "magic" | "password"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("magic")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const supabase = createClient()
  const configured = Boolean(supabase)

  async function handleMagicLink() {
    if (!supabase) return
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (signInError) throw signInError
      setMessage("登录链接已发送到邮箱，请打开邮件完成登录。")
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSignIn() {
    if (!supabase) return
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
      router.replace("/")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSignUp() {
    if (!supabase) return
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (signUpError) throw signUpError
      setMessage("账号已创建。若 Supabase 开启了邮箱确认，请先打开邮箱完成确认。")
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <div className="font-serif text-3xl text-foreground">叙事</div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            登录后，你的经历库、JD 库和聊天记录会同步保存在云端。
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl shadow-foreground/5 p-5">
          {!configured && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed">
              当前还没有配置 Supabase 环境变量。你可以继续本地使用；配置后这里会启用真实登录。
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 mb-4">
            <button
              onClick={() => setMode("magic")}
              className={cn(
                "rounded-lg py-1.5 text-xs transition-all",
                mode === "magic" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              邮箱验证码
            </button>
            <button
              onClick={() => setMode("password")}
              className={cn(
                "rounded-lg py-1.5 text-xs transition-all",
                mode === "password" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              邮箱密码
            </button>
          </div>

          <label className="block text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest mb-2">
            邮箱
          </label>
          <div className="relative mb-3">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border/60 bg-muted/25 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-ring/50 focus:ring-1 focus:ring-ring/20"
            />
          </div>

          {mode === "password" && (
            <>
              <label className="block text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest mb-2">
                密码
              </label>
              <div className="relative mb-3">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="至少 6 位"
                  className="w-full rounded-xl border border-border/60 bg-muted/25 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-ring/50 focus:ring-1 focus:ring-ring/20"
                />
              </div>
            </>
          )}

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
          {message && <p className="mb-3 text-xs text-primary leading-relaxed">{message}</p>}

          {mode === "magic" ? (
            <button
              onClick={handleMagicLink}
              disabled={!configured || loading || !email}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" strokeWidth={1.5} />}
              发送登录链接
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePasswordSignIn}
                disabled={!configured || loading || !email || password.length < 6}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                登录
              </button>
              <button
                onClick={handlePasswordSignUp}
                disabled={!configured || loading || !email || password.length < 6}
                className="rounded-xl border border-border/70 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-45"
              >
                注册
              </button>
            </div>
          )}

          <div className="mt-4 border-t border-border/50 pt-4">
            <button
              disabled
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground/60"
            >
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
              微信登录待接入
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground/60 leading-relaxed">
              微信登录需要微信开放平台应用、回调域名和 OAuth 适配，后续可以在这个入口接入。
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
