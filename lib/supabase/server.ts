import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { hasSupabaseEnv } from "@/lib/supabase/config"

// anti-patterns-lint-allow
export async function createClient() {
  if (!hasSupabaseEnv()) return null

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components 中忽略 set 错误
          }
        },
      },
    }
  )
}
