import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { LogOut, ArrowRightLeft } from 'lucide-react'
import Image from 'next/image'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile to know if it's admin or loja
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, lojas(nome)')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fa] overflow-hidden font-sans">
      {/* Unified Top Navigation */}
      <header className="h-20 bg-primary text-white flex items-center justify-between px-6 md:px-10 shrink-0 sticky top-0 z-20 shadow-md">
        {/* Left: Logo & Nav */}
        <div className="flex items-center gap-8">
          <Image src="/logo.png" alt="Equipar Logo" width={140} height={40} className="object-contain" priority />
          
          <nav className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-white font-medium text-sm border border-white/5">
              <ArrowRightLeft size={16} />
              <span>Transferências</span>
            </div>
          </nav>
        </div>

        {/* Right: Profile & Actions */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 text-right hidden sm:flex">
            <div>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mb-0.5">Atuando em</p>
              <h1 className="text-sm font-display font-bold text-white tracking-tight">
                {profile?.role === 'admin' ? 'Administração Geral' : `Loja ${profile?.lojas?.nome || 'Não Vinculada'}`}
              </h1>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 shadow-inner flex items-center justify-center text-white font-bold text-lg ml-2">
              {profile?.role === 'admin' ? 'AD' : profile?.lojas?.nome?.charAt(0) || 'L'}
            </div>
          </div>

          <div className="w-px h-8 bg-white/10 hidden sm:block"></div>

          <form action="/auth/signout" method="post">
            <button className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium">
              <LogOut size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto w-full">
        <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-10 w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
