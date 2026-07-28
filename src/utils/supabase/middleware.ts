import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          const isLocalhost = request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1'
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          
          // Atualiza o header 'cookie' para garantir que as Server Actions e Server Components 
          // recebam o token renovado e não tentem renovar de novo (evitando AuthRefreshDiscardedError)
          const newCookies = request.cookies.getAll().map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
          request.headers.set('cookie', newCookies)

          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { 
              ...options, 
              secure: !isLocalhost && process.env.NODE_ENV === 'production',
              sameSite: 'lax' as const
            }
            supabaseResponse.cookies.set(name, value, cookieOptions)
          })
        },
      },
    }
  )

  // Removido o block de if (request.method === 'POST') para permitir que o middleware
  // renove o token para Server Actions de forma segura e síncrona.

  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  // Se o erro for de concorrência (AuthRefreshDiscardedError), não vamos forçar o logout
  // porque sabemos que outra requisição já está cuidando do refresh do token.
  const isDiscardedError = error?.name === 'AuthRefreshDiscardedError' || error?.message?.includes('mid-flight')

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isAuthRoute && !isDiscardedError) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    // Default to /dashboard for now
    url.pathname = '/dashboard'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}
