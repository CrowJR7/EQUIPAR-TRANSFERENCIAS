import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { LogOut, Bell } from 'lucide-react'
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

  let headerColor = "bg-blue-700"
  if (profile?.role === 'admin') headerColor = "bg-purple-700"
  else if (profile?.lojas?.nome === 'GOLD') headerColor = "bg-amber-500"
  else if (profile?.lojas?.nome === 'ONIX') headerColor = "bg-slate-800"
  else if (profile?.lojas?.nome === 'SORS') headerColor = "bg-teal-700"
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className={`${headerColor} shadow-md sticky top-0 z-40 transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Equipar Logo" width={160} height={50} className="object-contain mr-2" />
            <div className="hidden sm:block h-8 w-px bg-slate-700"></div>
            <h1 className="text-xl font-[Bebas_Neue] text-white tracking-wider mt-1 hidden sm:block uppercase">
              {profile?.role === 'admin' ? 'ADM TOTAL' : `LOJA ${profile?.lojas?.nome || 'NÃO VINCULADA'}`}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-300 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-blue-700"></span>
            </button>
            <form action="/auth/signout" method="post">
              <button className="flex items-center gap-2 text-sm text-slate-300 hover:text-white font-medium transition-colors">
                <LogOut size={18} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}
