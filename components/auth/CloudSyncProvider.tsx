"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { pullAndMergeCloudData } from "@/lib/cloud-sync"

type CloudStatus = "local" | "syncing" | "synced" | "error"

type CloudSyncContextValue = {
  user: User | null
  status: CloudStatus
  error: string | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null)

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<CloudStatus>("local")
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const supabase = createClient()
    if (!supabase) {
      setStatus("local")
      setUser(null)
      return
    }

    const { data } = await supabase.auth.getUser()
    setUser(data.user)
    if (!data.user) {
      setStatus("local")
      return
    }

    setStatus("syncing")
    setError(null)
    const result = await pullAndMergeCloudData()
    if (result.ok) {
      setStatus("synced")
    } else {
      setStatus("error")
      setError(result.reason)
    }
  }

  async function signOut() {
    const supabase = createClient()
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setStatus("local")
  }

  useEffect(() => {
    const supabase = createClient()
    void refresh()
    if (!supabase) return

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({ user, status, error, refresh, signOut }),
    [user, status, error]
  )

  return (
    <CloudSyncContext.Provider value={value}>
      {children}
    </CloudSyncContext.Provider>
  )
}

export function useCloudSync() {
  const value = useContext(CloudSyncContext)
  if (!value) {
    return {
      user: null,
      status: "local" as CloudStatus,
      error: null,
      refresh: async () => {},
      signOut: async () => {},
    }
  }
  return value
}
