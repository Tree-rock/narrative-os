import { redirect } from "next/navigation"
import { CloudSyncProvider } from "@/components/auth/CloudSyncProvider"
import { Sidebar } from "@/components/layout/Sidebar"
import { createClient } from "@/lib/supabase/server"
import { hasSupabaseEnv } from "@/lib/supabase/config"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (hasSupabaseEnv()) {
    const supabase = await createClient()
    const { data } = await supabase!.auth.getUser()
    if (!data.user) redirect("/login")
  }

  return (
    <CloudSyncProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto scrollbar-thin min-w-0">
          {children}
        </main>
      </div>
    </CloudSyncProvider>
  )
}
