import { createBrowserClient } from "@supabase/ssr"
import { hasSupabaseEnv } from "@/lib/supabase/config"

export function createClient() {
  if (!hasSupabaseEnv()) return null

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  )
}
