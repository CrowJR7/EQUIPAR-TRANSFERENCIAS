'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // Instanciate the client exactly once per session
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.refresh()
      } else if (event === 'TOKEN_REFRESHED') {
        // Refresh the router to keep server components in sync
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  return <>{children}</>
}
