import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

export async function createClient() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOptions = { 
                ...options, 
                secure: !isLocalhost && process.env.NODE_ENV === 'production',
                sameSite: 'lax' as const
              }
              cookieStore.set(name, value, cookieOptions)
            })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  let result = await supabase.auth.getUser()

  if (result.error && (result.error.name === 'AuthRefreshDiscardedError' || result.error.message?.includes('mid-flight'))) {
    // Se houve colisão de refresh, tentamos pegar o usuário pela sessão (que apenas decodifica o JWT local)
    // para não quebrar as Server Actions que precisam do user.id
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session?.user) {
      result = { data: { user: sessionData.session.user }, error: null } as any
    }
  }

  return { ...result, supabase }
})
