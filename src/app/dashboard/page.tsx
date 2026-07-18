import { createClient } from '@/utils/supabase/server'
import { DashboardClient } from './components/DashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  const { data: lojas, error: lojasError } = await supabase.from('lojas').select('*').order('nome')

  if (lojasError) {
    console.error('Erro buscando lojas:', lojasError)
  }

  let enviandoQuery = supabase
    .from('transferencias')
    .select('*, destino:lojas!transferencias_destino_loja_id_fkey(nome), origem:lojas!transferencias_origem_loja_id_fkey(nome)')
    .order('created_at', { ascending: false })

  let recebendoQuery = supabase
    .from('transferencias')
    .select('*, destino:lojas!transferencias_destino_loja_id_fkey(nome), origem:lojas!transferencias_origem_loja_id_fkey(nome)')
    .order('created_at', { ascending: false })

  if (profile?.role !== 'admin' && profile?.loja_id) {
    enviandoQuery = enviandoQuery.eq('origem_loja_id', profile.loja_id)
    recebendoQuery = recebendoQuery.eq('destino_loja_id', profile.loja_id)
  }

  // Fetch all rows bypassing the 1000 limit
  async function fetchAll(query: any) {
    let allData: any[] = []
    let currentFrom = 0
    const step = 999
    
    while (true) {
      const { data, error } = await query.range(currentFrom, currentFrom + step)
      if (error || !data || data.length === 0) break
      allData = allData.concat(data)
      if (data.length <= step) break
      currentFrom += step + 1
    }
    return allData
  }

  const enviando = await fetchAll(enviandoQuery)
  const recebendo = profile?.role === 'admin' ? [] : await fetchAll(recebendoQuery)

  return (
    <DashboardClient 
      lojas={lojas || []} 
      enviando={enviando || []} 
      recebendo={recebendo || []} 
      profile={profile}
    />
  )
}
